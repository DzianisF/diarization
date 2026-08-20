import assert from "node:assert/strict";
import test from "node:test";
import { buildAudioArgs, buildYouTubeDownloadArgs, friendlyYouTube403, isAllowedWebOrigin, parseManualPreparationArgs, validateCompanionRequest } from "./lib.mjs";

test("validates an authorized public YouTube request", () => {
  assert.equal(validateCompanionRequest({ sourceUrl: "https://www.youtube.com/watch?v=8bMXdkVpHn4", rightsConfirmed: true }), "https://www.youtube.com/watch?v=8bMXdkVpHn4");
  assert.throws(() => validateCompanionRequest({ sourceUrl: "https://example.org/video", rightsConfirmed: true }), /YouTube/);
  assert.throws(() => validateCompanionRequest({ sourceUrl: "https://youtu.be/abcdefghijk", rightsConfirmed: false }), /Confirm/);
});

test("limits browser callers and produces audio-only ffmpeg arguments", () => {
  assert.equal(isAllowedWebOrigin("https://diarizeweb-iwtgqu2f.manus.space"), true);
  assert.equal(isAllowedWebOrigin("https://another-project.manus.space"), false);
  assert.equal(isAllowedWebOrigin("https://malicious.example"), false);
  assert.deepEqual(buildAudioArgs("input.webm", "output.mp3"), ["-y", "-i", "input.webm", "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "mp3", "output.mp3"]);
});

test("requires explicit confirmation and parses a local manual-preparation target", () => {
  assert.deepEqual(parseManualPreparationArgs(["--rights-confirmed", "--output-dir", "/tmp/diarize", "https://www.youtube.com/watch?v=8bMXdkVpHn4"]), { sourceUrl: "https://www.youtube.com/watch?v=8bMXdkVpHn4", outputDir: "/tmp/diarize" });
  assert.throws(() => parseManualPreparationArgs(["https://www.youtube.com/watch?v=8bMXdkVpHn4"]), /Confirm/);
});

test("uses a supported alternate YouTube player only after the default download is rejected", () => {
  assert.deepEqual(buildYouTubeDownloadArgs("https://youtu.be/example", "/tmp/source.%(ext)s", true), ["--no-config", "--no-playlist", "--format", "worstaudio/worst", "--output", "/tmp/source.%(ext)s", "--extractor-args", "youtube:player_client=android", "https://youtu.be/example"]);
  assert.match(friendlyYouTube403(new Error("HTTP Error 403: Forbidden")), /brew update/);
});
