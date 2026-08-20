type FormattableTurn = {
  speakerName: string;
  startMs: number;
  text: string;
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatTimestamp(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return `[${pad(hours)}:${pad(minutes)}:${pad(seconds)}]`;
}

export function formatTranscript(
  turns: FormattableTurn[],
  options: { timestamps: boolean },
): string {
  return turns
    .filter(turn => turn.text.trim().length > 0)
    .map(turn => `${options.timestamps ? `${formatTimestamp(turn.startMs)} ` : ""}${turn.speakerName}: ${turn.text.trim()}`)
    .join("\n");
}
