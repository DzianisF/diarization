import { describe, expect, it } from "vitest";
import { mergeSpeakerTurns } from "./merge";

describe("mergeSpeakerTurns", () => {
  it("uses the speaker with the greatest temporal overlap", () => {
    const result = mergeSpeakerTurns({
      segments: [{ start: 1, end: 4, text: "Question" }],
      utterances: [
        { speakerKey: "dg:0", startMs: 1_000, endMs: 1_800, text: "" },
        { speakerKey: "dg:1", startMs: 1_800, endMs: 4_000, text: "" },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({ speakerKey: "dg:1", speakerName: "Speaker 2", text: "Question" }),
    ]);
  });

  it("joins close consecutive segments from the same speaker", () => {
    const result = mergeSpeakerTurns({
      segments: [
        { start: 1, end: 2, text: "Hello" },
        { start: 2.2, end: 3, text: "again" },
      ],
      utterances: [{ speakerKey: "dg:0", startMs: 900, endMs: 3_100, text: "" }],
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ text: "Hello again", startMs: 1_000, endMs: 3_000 });
  });
});
