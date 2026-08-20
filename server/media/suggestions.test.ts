import { describe, expect, it, vi } from "vitest";
import { suggestSpeakerRoles } from "./suggestions";

describe("suggestSpeakerRoles", () => {
  it("keeps only proposed roles for known transcript speakers", async () => {
    const invoke = vi.fn().mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ suggestions: [
      { speakerKey: "dg:0", suggestedRole: "Interviewer", rationale: "Asks opening questions.", confidence: "medium" },
      { speakerKey: "unknown", suggestedRole: "Guest", rationale: "Ignored", confidence: "low" },
    ] }) } }] });

    await expect(suggestSpeakerRoles({
      speakers: [{ speakerKey: "dg:0", defaultName: "Speaker 1" }],
      turns: [{ speakerKey: "dg:0", speakerName: "Speaker 1", startMs: 0, endMs: 1000, text: "Could you introduce yourself?", position: 0 }],
      invoke,
    })).resolves.toEqual([
      { speakerKey: "dg:0", suggestedRole: "Interviewer", rationale: "Asks opening questions.", confidence: "medium" },
    ]);
  });
});
