import { describe, expect, it, vi } from "vitest";
import { createJobAdvancer } from "./jobs";

describe("processing pipeline", () => {
  it("runs remote preparation, extraction, transcription, diarization, and merge in durable step order", async () => {
    const calls: string[] = [];
    const advance = createJobAdvancer({
      save: vi.fn().mockResolvedValue(undefined),
      prepare: vi.fn(async () => calls.push("prepare")),
      extract: vi.fn(async () => calls.push("extract")),
      transcribe: vi.fn(async () => calls.push("transcribe")),
      diarize: vi.fn(async () => calls.push("diarize")),
      merge: vi.fn(async () => calls.push("merge")),
    });

    let job = { id: "job-1", sessionId: "session-1", stage: "preparing_source" as const, progress: 12, sourceKey: "source.mp4" };
    job = await advance(job) as typeof job;
    job = await advance({ ...job, stage: "extracting_audio" }) as typeof job;
    job = await advance({ ...job, stage: "transcribing" }) as typeof job;
    await advance({ ...job, stage: "diarizing" });

    expect(calls).toEqual(["prepare", "extract", "transcribe", "diarize", "merge"]);
  });
});
