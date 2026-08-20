import { afterEach, describe, expect, it, vi } from "vitest";
import { transcribeAudio } from "./voiceTranscription";

describe("transcribeAudio", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns a clear error when Whisper does not answer before the request deadline", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "audio/mpeg" } }))
      .mockImplementationOnce((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await transcribeAudio({ audioUrl: "https://media.example.test/audio.mp3" }, 10);

    expect(result).toMatchObject({
      error: "Voice transcription failed",
      code: "SERVICE_ERROR",
      details: "Whisper transcription request timed out after 0 seconds.",
    });
  });
});
