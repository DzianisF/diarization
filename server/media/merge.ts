import type { DiarizedUtterance } from "./deepgram";
import { makeSpeakerName, type TranscriptTurn } from "./types";

type WhisperSegment = {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
};

type MergeInput = {
  segments: WhisperSegment[];
  utterances: DiarizedUtterance[];
};

function overlapMs(leftStart: number, leftEnd: number, rightStart: number, rightEnd: number): number {
  return Math.max(0, Math.min(leftEnd, rightEnd) - Math.max(leftStart, rightStart));
}

function assignSpeaker(segmentStart: number, segmentEnd: number, utterances: DiarizedUtterance[]): string {
  const best = utterances.reduce<{ speakerKey: string; overlap: number } | null>((candidate, utterance) => {
    const overlap = overlapMs(segmentStart, segmentEnd, utterance.startMs, utterance.endMs);
    return candidate === null || overlap > candidate.overlap
      ? { speakerKey: utterance.speakerKey, overlap }
      : candidate;
  }, null);
  return best?.overlap ? best.speakerKey : utterances[0]?.speakerKey ?? "dg:0";
}

export function mergeSpeakerTurns({ segments, utterances }: MergeInput): TranscriptTurn[] {
  const orderedSpeakerKeys = Array.from(new Set(utterances.map(utterance => utterance.speakerKey)));
  const pending = segments
    .map(segment => {
      const startMs = Math.round(segment.start * 1_000);
      const endMs = Math.round(segment.end * 1_000);
      const speakerKey = assignSpeaker(startMs, endMs, utterances);
      const speakerIndex = Math.max(0, orderedSpeakerKeys.indexOf(speakerKey));
      return {
        speakerKey,
        speakerName: makeSpeakerName(speakerIndex),
        startMs,
        endMs,
        text: segment.text.trim(),
        confidence: segment.avg_logprob === undefined ? undefined : Math.round(Math.exp(segment.avg_logprob) * 100),
      };
    })
    .filter(turn => turn.text.length > 0);

  const merged: Omit<TranscriptTurn, "position">[] = [];
  for (const turn of pending) {
    const previous = merged.at(-1);
    if (previous && previous.speakerKey === turn.speakerKey && turn.startMs - previous.endMs <= 600) {
      previous.text = `${previous.text} ${turn.text}`;
      previous.endMs = turn.endMs;
      continue;
    }
    merged.push(turn);
  }

  return merged.map((turn, position) => ({ ...turn, position }));
}
