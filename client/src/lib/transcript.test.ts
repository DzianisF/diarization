import { describe, expect, it } from "vitest";
import { makeSrt, makeVtt, subtitleTimestamp, timestampLabel } from "./transcript";

describe("timestampLabel", () => {
  it("renders export-compatible zero-padded clock labels", () => {
    expect(timestampLabel(0)).toBe("00:00:00");
    expect(timestampLabel(3_661_000)).toBe("01:01:01");
  });

  it("formats subtitle cues with end times, speaker labels, and format-specific milliseconds", () => {
    const turns = [{ speakerKey: "speaker-1", startMs: 2_500, endMs: 4_125, text: "Welcome." }];
    const speaker = () => "Alice";
    expect(subtitleTimestamp(3_661_007, ",")).toBe("01:01:01,007");
    expect(makeSrt(turns, speaker)).toBe("1\n00:00:02,500 --> 00:00:04,125\nAlice: Welcome.");
    expect(makeVtt(turns, speaker)).toBe("WEBVTT\n\n00:00:02.500 --> 00:00:04.125\nAlice: Welcome.");
  });
});
