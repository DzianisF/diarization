import { describe, expect, it } from "vitest";
import { timestampLabel } from "./transcript";
import { makeTranscriptText, validateIntake } from "./workflow";

describe("intake and export workflow", () => {
  it("blocks a local upload until a file and rights confirmation are provided", () => {
    expect(validateIntake({ sourceType: "upload", hasFile: false, sourceUrl: "", rightsConfirmed: false }))
      .toBe("Confirm you have the right to process this media.");
    expect(validateIntake({ sourceType: "upload", hasFile: false, sourceUrl: "", rightsConfirmed: true }))
      .toBe("Choose an audio or video file.");
    expect(validateIntake({ sourceType: "upload", hasFile: true, sourceUrl: "", rightsConfirmed: true })).toBeNull();
  });

  it("blocks an empty direct URL while allowing a prepared URL flow", () => {
    expect(validateIntake({ sourceType: "url", hasFile: false, sourceUrl: "", rightsConfirmed: true }))
      .toBe("Paste a direct HTTPS media URL.");
    expect(validateIntake({ sourceType: "url", hasFile: false, sourceUrl: "https://cdn.example.org/call.mp3", rightsConfirmed: true })).toBeNull();
  });

  it("creates matching export dialogue with and without timestamps", () => {
    const turns = [{ speakerKey: "dg:0", startMs: 65_000, text: "Hello." }];
    expect(makeTranscriptText(turns, () => "Alice", timestampLabel, true)).toBe("[00:01:05] Alice: Hello.");
    expect(makeTranscriptText(turns, () => "Alice", timestampLabel, false)).toBe("Alice: Hello.");
  });
});
