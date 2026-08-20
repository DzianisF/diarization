import { describe, expect, it, vi } from "vitest";
import { storeRemoteMedia } from "./upload";

describe("storeRemoteMedia", () => {
  it("stops a remote read at the configured byte limit", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array(17), {
      headers: { "content-length": "17", "content-type": "audio/mpeg" },
    }));

    await expect(storeRemoteMedia({
      jobId: "job-a",
      sourceUrl: "https://cdn.example.org/a.mp3",
      fetcher,
      maxBytes: 16,
      put: vi.fn(),
    })).rejects.toThrow("Media exceeds 16 bytes");
  });

  it("stores a validated remote media response", async () => {
    const put = vi.fn().mockResolvedValue({ key: "stored.mp3", url: "/manus-storage/stored.mp3" });
    const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "audio/mpeg" },
    }));

    await expect(storeRemoteMedia({
      jobId: "job-a",
      sourceUrl: "https://cdn.example.org/a.mp3",
      fetcher,
      put,
      maxBytes: 16,
    })).resolves.toEqual({ key: "stored.mp3", mimeType: "audio/mpeg", byteLength: 3 });
  });
});
