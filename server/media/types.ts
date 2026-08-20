export const jobStages = [
  "uploading",
  "preparing_source",
  "getting_platform_media",
  "extracting_audio",
  "transcribing",
  "diarizing",
  "complete",
  "failed",
] as const;

export type JobStage = (typeof jobStages)[number];

export type SpeakerSuggestion = {
  speakerKey: string;
  suggestedRole: string;
  rationale: string;
  confidence: "low" | "medium";
};

export type TranscriptTurn = {
  position: number;
  speakerKey: string;
  speakerName: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

export type MediaJob = {
  id: string;
  sessionId: string;
  stage: JobStage;
  progress: number;
  sourceUrl?: string | null;
  sourceKey?: string | null;
  audioKey?: string | null;
  errorMessage?: string | null;
};

const nextStage: Record<Exclude<JobStage, "complete" | "failed">, JobStage> = {
  uploading: "extracting_audio",
  preparing_source: "extracting_audio",
  getting_platform_media: "extracting_audio",
  extracting_audio: "transcribing",
  transcribing: "diarizing",
  diarizing: "complete",
};

export function assertNextStage(current: JobStage, target: JobStage): true {
  if (current === "complete" || current === "failed" || nextStage[current] !== target) {
    throw new Error(`Invalid job transition: ${current} -> ${target}`);
  }
  return true;
}

export function makeSpeakerName(index: number): string {
  return `Speaker ${index + 1}`;
}

export function userFacingStage(stage: JobStage): string {
  const labels: Record<JobStage, string> = {
    uploading: "uploading",
    preparing_source: "preparing direct URL",
    getting_platform_media: "getting YouTube media",
    extracting_audio: "extracting audio",
    transcribing: "transcribing",
    diarizing: "diarizing",
    complete: "complete",
    failed: "failed",
  };
  return labels[stage];
}
