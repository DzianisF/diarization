import assert from "node:assert/strict";
import test from "node:test";
import { buildAudioArgs, isAllowedWebOrigin, validateCompanionRequest } from "./lib.mjs";

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
