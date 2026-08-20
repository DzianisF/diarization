export function timestampLabel(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000));
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map(value => String(value).padStart(2, "0")).join(":");
}

type SubtitleTurn = { speakerKey: string; startMs: number; endMs?: number; text: string };

export function subtitleTimestamp(milliseconds: number, separator: "," | "."): string {
  const totalMilliseconds = Math.max(0, Math.floor(milliseconds));
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMilliseconds % 60_000) / 1_000);
  const remainder = totalMilliseconds % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${separator}${String(remainder).padStart(3, "0")}`;
}

function subtitleCues(turns: SubtitleTurn[], getName: (speakerKey: string) => string, separator: "," | "."): string[] {
  return turns.map((turn, index) => {
    const endMs = Math.max(turn.endMs ?? turn.startMs + 1_000, turn.startMs + 250);
    return `${index + 1}\n${subtitleTimestamp(turn.startMs, separator)} --> ${subtitleTimestamp(endMs, separator)}\n${getName(turn.speakerKey)}: ${turn.text.trim()}`;
  });
}

export function makeSrt(turns: SubtitleTurn[], getName: (speakerKey: string) => string): string {
  return subtitleCues(turns, getName, ",").join("\n\n");
}

export function makeVtt(turns: SubtitleTurn[], getName: (speakerKey: string) => string): string {
  return `WEBVTT\n\n${subtitleCues(turns, getName, ".").map(cue => cue.replace(/^\d+\n/, "")).join("\n\n")}`;
}

export function downloadTranscript(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function copyTranscript(content: string): Promise<void> {
  await navigator.clipboard.writeText(content);
}
