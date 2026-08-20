import { describe, expect, it } from "vitest";
import { formatTranscript } from "./format";

describe("formatTranscript", () => {
  const turns = [{ speakerName: "Alice", startMs: 65_000, text: "Hello." }];

  it("uses a readable dialogue shape with timestamps", () => {
    expect(formatTranscript(turns, { timestamps: true })).toBe("[00:01:05] Alice: Hello.");
  });

  it("omits only timestamps", () => {
    expect(formatTranscript(turns, { timestamps: false })).toBe("Alice: Hello.");
  });
});
