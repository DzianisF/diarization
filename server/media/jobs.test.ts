import { describe, expect, it, vi } from "vitest";
import { createJobAdvancer } from "./jobs";

describe("job advancement", () => {
  it("advances one stage rather than completing all provider calls in one request", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const advance = createJobAdvancer({
      save,
      prepare: vi.fn(),
      extract: vi.fn(),
      transcribe: vi.fn(),
      diarize: vi.fn(),
      merge: vi.fn(),
    });

    const result = await advance({
      id: "job-1",
      sessionId: "session-1",
      stage: "extracting_audio",
      progress: 25,
      sourceKey: "source.mp4",
    });

    expect(result).toMatchObject({ stage: "transcribing", progress: 50 });
    expect(save).toHaveBeenCalledTimes(1);
    expect(vi.mocked(advance)).toBeTypeOf("function");
  });
});
