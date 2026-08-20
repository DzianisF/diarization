import { describe, expect, it, vi } from "vitest";
import { buildBrowserDownloadFilename, createYouTubeStreamArgs, friendlyPlatformError, isYouTubeUrl, parsePlatformMetadata, selectLowestPipedAudio, withPipedFailover } from "./platform";

describe("platform media", () => {
  it("recognizes supported public YouTube page URLs", () => {
    expect(isYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
    expect(isYouTubeUrl("https://example.org/video.mp4")).toBe(false);
  });

  it("accepts brief metadata below processing limits", () => {
    expect(parsePlatformMetadata(JSON.stringify({ title: "Public video", duration: 90, filesize_approx: 1_500_000 }))).toMatchObject({
      title: "Public video", durationSeconds: 90,
    });
  });

  it("rejects platform media that exceeds duration or file limits", () => {
    expect(() => parsePlatformMetadata(JSON.stringify({ title: "Long video", duration: 3601, filesize_approx: 1_500_000 }))).toThrow("longer than 60 minutes");
    expect(() => parsePlatformMetadata(JSON.stringify({ title: "Large video", duration: 10, filesize_approx: 17 * 1024 * 1024 }))).toThrow("larger than 16 MB");
  });

  it("selects the smallest secure Piped audio stream and ignores invalid candidates", () => {
    expect(selectLowestPipedAudio([
      { bitrate: 128_000, url: "https://relay.example/audio-high" },
      { bitrate: 48_000, url: "https://relay.example/audio-low" },
      { bitrate: 16_000, url: "http://relay.example/insecure" },
      { bitrate: 8_000 },
    ])).toMatchObject({ bitrate: 48_000, url: "https://relay.example/audio-low" });
  });

  it("fails over from a refused Piped instance to the next working instance", async () => {
    const attempt = vi.fn(async (api: string) => {
      if (api === "https://first.example") throw new Error("unavailable");
      return `${api}/audio`;
    });
    await expect(withPipedFailover(["https://first.example", "https://second.example"], attempt)).resolves.toBe("https://second.example/audio");
    expect(attempt).toHaveBeenNthCalledWith(1, "https://first.example");
    expect(attempt).toHaveBeenNthCalledWith(2, "https://second.example");
  });

  it("describes YouTube anti-bot rejection without mislabeling a public video as private", () => {
    expect(friendlyPlatformError("Sign in to confirm you’re not a bot").message).toContain("browser verification");
  });

  it("creates a bounded progressive-video streaming plan for browser download", () => {
    expect(createYouTubeStreamArgs("https://www.youtube.com/watch?v=aqz-KE-bpKQ")).toEqual(expect.arrayContaining([
      "--format", "worst[acodec!=none][vcodec!=none]/worst", "--output", "-",
    ]));
    expect(buildBrowserDownloadFilename("A / title: sample", "mp4")).toBe("A-title-sample.mp4");
  });
});
