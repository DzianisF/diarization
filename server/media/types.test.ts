import { describe, expect, it } from "vitest";
import { assertNextStage, makeSpeakerName } from "./types";

describe("media job state", () => {
  it("accepts the required ordered stages and rejects skipping", () => {
    expect(assertNextStage("uploading", "extracting_audio")).toBe(true);
    expect(() => assertNextStage("uploading", "diarizing")).toThrow("Invalid job transition");
  });

  it("creates user-facing speaker labels from one", () => {
    expect(makeSpeakerName(0)).toBe("Speaker 1");
    expect(makeSpeakerName(2)).toBe("Speaker 3");
  });
});
