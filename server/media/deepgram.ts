import { ENV } from "../_core/env";

export type DiarizedUtterance = {
  speakerKey: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
};

type DeepgramResponse = {
  results?: {
    utterances?: Array<{
      speaker?: number;
      start?: number;
      end?: number;
      transcript?: string;
      confidence?: number;
    }>;
  };
};

type DiarizeInput = {
  audioUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
};

const endpoint = new URL("https://api.deepgram.com/v1/listen");
endpoint.searchParams.set("model", "nova-3");
endpoint.searchParams.set("diarize_model", "latest");
endpoint.searchParams.set("punctuate", "true");
endpoint.searchParams.set("utterances", "true");
endpoint.searchParams.set("smart_format", "true");

export async function diarizeAudio({ audioUrl, apiKey = ENV.deepgramApiKey, fetcher = fetch }: DiarizeInput): Promise<DiarizedUtterance[]> {
  if (!apiKey) {
    throw new Error("Speaker diarization is not configured.");
  }

  const response = await fetcher(endpoint.toString(), {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: audioUrl }),
  });

  if (!response.ok) {
    throw new Error(`Speaker diarization service rejected the audio (${response.status}).`);
  }

  const payload = await response.json() as DeepgramResponse;
  const utterances = payload.results?.utterances ?? [];
  return utterances
    .filter((item): item is Required<Pick<typeof item, "speaker" | "start" | "end">> & typeof item =>
      typeof item.speaker === "number" && typeof item.start === "number" && typeof item.end === "number",
    )
    .map(item => ({
      speakerKey: `dg:${item.speaker}`,
      startMs: Math.round(item.start * 1_000),
      endMs: Math.round(item.end * 1_000),
      text: item.transcript?.trim() ?? "",
      confidence: item.confidence,
    }));
}
