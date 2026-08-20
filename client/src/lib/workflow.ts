export type IntakeSource = {
  sourceType: "upload" | "url";
  hasFile: boolean;
  sourceUrl: string;
  rightsConfirmed: boolean;
};

export function validateIntake(source: IntakeSource): string | null {
  if (!source.rightsConfirmed) return "Confirm you have the right to process this media.";
  if (source.sourceType === "upload" && !source.hasFile) return "Choose an audio or video file.";
  if (source.sourceType === "url" && !source.sourceUrl.trim()) return "Paste a public media or YouTube URL.";
  return null;
}

export function makeTranscriptText(
  turns: Array<{ speakerKey: string; startMs: number; text: string }>,
  getName: (speakerKey: string) => string,
  timestamp: (milliseconds: number) => string,
  includeTimestamps: boolean,
): string {
  return turns
    .map(turn => `${includeTimestamps ? `[${timestamp(turn.startMs)}] ` : ""}${getName(turn.speakerKey)}: ${turn.text}`)
    .join("\n");
}
