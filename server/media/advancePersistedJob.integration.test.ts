import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionJob: vi.fn(),
  updateSessionJob: vi.fn(),
  saveCompletedTranscript: vi.fn(),
  storageGetSignedUrl: vi.fn(),
  extractCompatibleAudio: vi.fn(),
  transcribeAudio: vi.fn(),
  diarizeAudio: vi.fn(),
  mergeSpeakerTurns: vi.fn(),
}));

vi.mock("../db", () => ({ getSessionJob: mocks.getSessionJob, updateSessionJob: mocks.updateSessionJob, saveCompletedTranscript: mocks.saveCompletedTranscript, saveSessionSuggestions: vi.fn() }));
vi.mock("../storage", () => ({ storageGetSignedUrl: mocks.storageGetSignedUrl }));
vi.mock("../_core/voiceTranscription", () => ({ transcribeAudio: mocks.transcribeAudio }));
vi.mock("./ffmpeg", () => ({ extractCompatibleAudio: mocks.extractCompatibleAudio }));
vi.mock("./deepgram", () => ({ diarizeAudio: mocks.diarizeAudio }));
vi.mock("./merge", () => ({ mergeSpeakerTurns: mocks.mergeSpeakerTurns }));
vi.mock("./suggestions", () => ({ suggestSpeakerRoles: vi.fn() }));
import { advancePersistedJob } from "./jobs";

describe("advancePersistedJob integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSessionJob.mockResolvedValue({ job: { id: "job-1", stage: "complete" }, turns: [], speakers: [] });
  });

  it("extracts, transcribes, diarizes, merges, and persists a completed transcript through adapters", async () => {
    const base = { id: "job-1", sessionId: "session-1", sourceKey: "source.mp4", audioKey: "audio.mp3", sourceMimeType: "video/mp4", stage: "diarizing", providerMetadata: { whisper: { segments: [{ start: 0, end: 1, text: "Hello" }] } } };
    mocks.getSessionJob.mockResolvedValue({ job: base, turns: [], speakers: [] });
    mocks.storageGetSignedUrl.mockResolvedValue("https://signed.example/audio.mp3");
    mocks.diarizeAudio.mockResolvedValue([{ speakerKey: "dg:0", startMs: 0, endMs: 1000, text: "Hello" }]);
    mocks.mergeSpeakerTurns.mockReturnValue([{ position: 0, speakerKey: "dg:0", speakerName: "Speaker 1", startMs: 0, endMs: 1000, text: "Hello" }]);

    await advancePersistedJob("job-1", "session-1");

    expect(mocks.storageGetSignedUrl).toHaveBeenCalledWith("audio.mp3");
    expect(mocks.diarizeAudio).toHaveBeenCalledWith({ audioUrl: "https://signed.example/audio.mp3" });
    expect(mocks.mergeSpeakerTurns).toHaveBeenCalled();
    expect(mocks.saveCompletedTranscript).toHaveBeenCalledWith("job-1", "session-1", expect.any(Array));
    expect(mocks.updateSessionJob).toHaveBeenCalledWith("job-1", "session-1", expect.objectContaining({ stage: "complete", progress: 100 }));
  });

  it("persists normalized audio before starting Whisper transcription", async () => {
    const job = { id: "job-1", sessionId: "session-1", sourceKey: "source.mp4", sourceMimeType: "video/mp4", stage: "extracting_audio" };
    mocks.getSessionJob.mockResolvedValue({ job, turns: [], speakers: [] });
    mocks.extractCompatibleAudio.mockResolvedValue({ key: "normalized.mp3", mimeType: "audio/mpeg", byteLength: 1024 });

    await advancePersistedJob("job-1", "session-1");

    expect(mocks.extractCompatibleAudio).toHaveBeenCalledWith(expect.objectContaining({ sourceKey: "source.mp4" }));
    expect(mocks.updateSessionJob).toHaveBeenCalledWith("job-1", "session-1", expect.objectContaining({ audioKey: "normalized.mp3", stage: "transcribing", progress: 50 }));
  });

  it("persists Whisper segments before starting acoustic diarization", async () => {
    const job = { id: "job-1", sessionId: "session-1", audioKey: "normalized.mp3", stage: "transcribing" };
    mocks.getSessionJob.mockResolvedValue({ job, turns: [], speakers: [] });
    mocks.storageGetSignedUrl.mockResolvedValue("https://signed.example/normalized.mp3");
    mocks.transcribeAudio.mockResolvedValue({ language: "en", text: "Hello", segments: [{ start: 0, end: 1, text: "Hello" }] });

    await advancePersistedJob("job-1", "session-1");

    expect(mocks.transcribeAudio).toHaveBeenCalledWith({ audioUrl: "https://signed.example/normalized.mp3" });
    expect(mocks.updateSessionJob).toHaveBeenCalledWith("job-1", "session-1", expect.objectContaining({ transcriptText: "Hello", stage: "diarizing", progress: 75 }));
  });
});
