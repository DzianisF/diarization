import {
  getSessionJob,
  saveCompletedTranscript,
  saveSessionSuggestions,
  updateSessionJob,
} from "../db";
import { storageGetSignedUrl } from "../storage";
import { transcribeAudio, type WhisperResponse } from "../_core/voiceTranscription";
import { diarizeAudio } from "./deepgram";
import { extractCompatibleAudio } from "./ffmpeg";
import { mergeSpeakerTurns } from "./merge";
import { suggestSpeakerRoles } from "./suggestions";
import { storeRemoteMedia } from "./upload";
import { downloadYouTubeMedia } from "./platform";
import type { JobStage, MediaJob } from "./types";

type AdvancableJob = Pick<MediaJob, "id" | "sessionId" | "stage" | "progress" | "sourceKey">;

type JobDependencies = {
  save: (job: AdvancableJob) => Promise<void>;
  prepare: (job: AdvancableJob) => Promise<void>;
  extract: (job: AdvancableJob) => Promise<void>;
  transcribe: (job: AdvancableJob) => Promise<void>;
  diarize: (job: AdvancableJob) => Promise<void>;
  merge: (job: AdvancableJob) => Promise<void>;
};

const nextStage: Partial<Record<JobStage, { stage: JobStage; progress: number; run?: keyof Omit<JobDependencies, "save"> }>> = {
  preparing_source: { stage: "extracting_audio", progress: 25, run: "prepare" },
  getting_platform_media: { stage: "extracting_audio", progress: 25, run: "prepare" },
  extracting_audio: { stage: "transcribing", progress: 50, run: "extract" },
  transcribing: { stage: "diarizing", progress: 75, run: "transcribe" },
  diarizing: { stage: "complete", progress: 100, run: "diarize" },
};

export function createJobAdvancer(dependencies: JobDependencies) {
  return async function advance(job: AdvancableJob): Promise<AdvancableJob> {
    const transition = nextStage[job.stage];
    if (!transition) return job;

    if (transition.run) await dependencies[transition.run](job);
    if (job.stage === "diarizing") await dependencies.merge(job);

    const updated = { ...job, stage: transition.stage, progress: transition.progress };
    await dependencies.save(updated);
    return updated;
  };
}

type WhisperMetadata = { whisper?: WhisperResponse };

export async function advancePersistedJob(id: string, sessionId: string) {
  const record = await getSessionJob(id, sessionId);
  if (!record) return undefined;
  const { job } = record;

  try {
    switch (job.stage) {
      case "uploading":
        if (!job.sourceKey) return record;
        return updateSessionJob(id, sessionId, { stage: "extracting_audio", progress: 25, errorMessage: null });
      case "preparing_source": {
        if (!job.sourceUrl) throw new Error("No direct media URL is attached to this job.");
        const stored = await storeRemoteMedia({ jobId: job.id, sourceUrl: job.sourceUrl });
        return updateSessionJob(id, sessionId, {
          sourceKey: stored.key,
          sourceMimeType: stored.mimeType,
          sourceBytes: stored.byteLength,
          stage: "extracting_audio",
          progress: 25,
          errorMessage: null,
        });
      }
      case "getting_platform_media": {
        if (!job.sourceUrl) throw new Error("No platform URL is attached to this job.");
        const stored = await downloadYouTubeMedia({ jobId: job.id, sourceUrl: job.sourceUrl });
        return updateSessionJob(id, sessionId, {
          sourceKey: stored.key,
          sourceName: stored.sourceName,
          sourceMimeType: stored.mimeType,
          sourceBytes: stored.byteLength,
          stage: "extracting_audio",
          progress: 25,
          errorMessage: null,
        });
      }
      case "extracting_audio": {
        if (!job.sourceKey) throw new Error("No source media is attached to this job.");
        const audio = await extractCompatibleAudio({
          jobId: job.id,
          sourceKey: job.sourceKey,
          sourceMimeType: job.sourceMimeType,
        });
        return updateSessionJob(id, sessionId, {
          audioKey: audio.key,
          stage: "transcribing",
          progress: 50,
          errorMessage: null,
        });
      }
      case "transcribing": {
        if (!job.audioKey) throw new Error("Audio extraction did not produce a file.");
        const audioUrl = await storageGetSignedUrl(job.audioKey);
        const response = await transcribeAudio({ audioUrl });
        if ("error" in response) throw new Error(response.error);
        return updateSessionJob(id, sessionId, {
          transcriptText: response.text,
          detectedLanguage: response.language,
          providerMetadata: { whisper: response },
          stage: "diarizing",
          progress: 75,
          errorMessage: null,
        });
      }
      case "diarizing": {
        if (!job.audioKey) throw new Error("Audio extraction did not produce a file.");
        const metadata = (job.providerMetadata ?? {}) as WhisperMetadata;
        if (!metadata.whisper) throw new Error("A transcription is required before diarization.");
        const audioUrl = await storageGetSignedUrl(job.audioKey);
        const utterances = await diarizeAudio({ audioUrl });
        const turns = mergeSpeakerTurns({ segments: metadata.whisper.segments, utterances });
        await saveCompletedTranscript(id, sessionId, turns);
        return updateSessionJob(id, sessionId, { stage: "complete", progress: 100, errorMessage: null });
      }
      default:
        return record;
    }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Processing could not be completed.";
    return updateSessionJob(id, sessionId, { stage: "failed", errorMessage: safeMessage });
  }
}

export async function suggestPersistedRoles(id: string, sessionId: string) {
  const record = await getSessionJob(id, sessionId);
  if (!record || record.job.stage !== "complete") return undefined;
  const turns = record.turns.map(turn => ({
    position: turn.position,
    speakerKey: turn.speakerKey,
    speakerName: record.speakers.find(speaker => speaker.speakerKey === turn.speakerKey)?.displayName ||
      record.speakers.find(speaker => speaker.speakerKey === turn.speakerKey)?.defaultName || "Speaker",
    startMs: turn.startMs,
    endMs: turn.endMs,
    text: turn.text,
    confidence: turn.confidence ?? undefined,
  }));
  const suggestions = await suggestSpeakerRoles({
    speakers: record.speakers.map(speaker => ({ speakerKey: speaker.speakerKey, defaultName: speaker.defaultName })),
    turns,
  });
  return saveSessionSuggestions(id, sessionId, suggestions);
}
