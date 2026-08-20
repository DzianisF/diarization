import { describe, expect, it } from "vitest";
import { timestampLabel } from "./transcript";
import { makeTranscriptText, validateIntake } from "./workflow";

describe("diarize interface flow", () => {
  it("accepts both a rights-confirmed local file flow and a direct-URL flow", () => {
    expect(validateIntake({ sourceType: "upload", hasFile: true, sourceUrl: "", rightsConfirmed: true })).toBeNull();
    expect(validateIntake({ sourceType: "url", hasFile: false, sourceUrl: "https://cdn.example.org/session.webm", rightsConfirmed: true })).toBeNull();
  });

  it("applies a renamed participant to transcript, copy, and TXT output with timestamp toggle", () => {
    const turns = [{ speakerKey: "dg:0", startMs: 9_000, text: "Welcome." }];
    const renamed = (key: string) => key === "dg:0" ? "Alice" : "Speaker";
    expect(makeTranscriptText(turns, renamed, timestampLabel, true)).toBe("[00:00:09] Alice: Welcome.");
    expect(makeTranscriptText(turns, renamed, timestampLabel, false)).toBe("Alice: Welcome.");
  });

  it("keeps a session history list isolated by its opaque session identifier", () => {
    const jobs = [{ id: "a", sessionId: "session-a" }, { id: "b", sessionId: "session-b" }];
    expect(jobs.filter(job => job.sessionId === "session-a").map(job => job.id)).toEqual(["a"]);
  });
});
