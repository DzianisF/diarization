import { describe, expect, it, vi } from "vitest";
import { diarizeAudio } from "./deepgram";

describe("diarizeAudio", () => {
  it("maps provider utterances to stable source keys and milliseconds", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      results: {
        utterances: [{ speaker: 1, start: 3.2, end: 4.6, transcript: "Yes." }],
      },
    }), { status: 200 }));

    await expect(diarizeAudio({
      audioUrl: "https://signed.example/audio.mp3",
      fetcher,
      apiKey: "test-key",
    })).resolves.toEqual([
      { speakerKey: "dg:1", startMs: 3200, endMs: 4600, text: "Yes.", confidence: undefined },
    ]);

    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("diarize_model=latest"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Token test-key" }),
      }),
    );
  });

  it("surfaces a safe upstream error", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 }));
    await expect(diarizeAudio({
      audioUrl: "https://signed.example/audio.mp3",
      fetcher,
      apiKey: "test-key",
    })).rejects.toThrow("Speaker diarization service rejected the audio (401)");
  });
});
