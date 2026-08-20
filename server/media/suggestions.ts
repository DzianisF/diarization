import { invokeLLM } from "../_core/llm";
import type { SpeakerSuggestion, TranscriptTurn } from "./types";

type SuggestionSpeaker = { speakerKey: string; defaultName: string };
type Invoke = typeof invokeLLM;

function parseSuggestions(content: unknown, speakerKeys: Set<string>): SpeakerSuggestion[] {
  if (typeof content !== "string") return [];
  try {
    const parsed = JSON.parse(content) as { suggestions?: unknown[] };
    return (parsed.suggestions ?? []).flatMap(item => {
      if (!item || typeof item !== "object") return [];
      const value = item as Record<string, unknown>;
      const speakerKey = typeof value.speakerKey === "string" ? value.speakerKey : "";
      const suggestedRole = typeof value.suggestedRole === "string" ? value.suggestedRole.trim().slice(0, 48) : "";
      const rationale = typeof value.rationale === "string" ? value.rationale.trim().slice(0, 180) : "";
      const confidence = value.confidence === "medium" ? "medium" : value.confidence === "low" ? "low" : null;
      if (!speakerKeys.has(speakerKey) || !suggestedRole || !rationale || !confidence) return [];
      return [{ speakerKey, suggestedRole, rationale, confidence }];
    });
  } catch {
    return [];
  }
}

export async function suggestSpeakerRoles({
  speakers,
  turns,
  invoke = invokeLLM,
}: {
  speakers: SuggestionSpeaker[];
  turns: TranscriptTurn[];
  invoke?: Invoke;
}): Promise<SpeakerSuggestion[]> {
  if (!speakers.length || !turns.length) return [];
  const transcript = turns.map(turn => `${turn.speakerKey}: ${turn.text}`).join("\n").slice(0, 18_000);
  const response = await invoke({
    messages: [
      {
        role: "system",
        content: "Analyze only the supplied anonymized dialogue. Suggest conversational roles, not real-world identities. Return JSON only, with a suggestions array. Each item must include speakerKey, suggestedRole, rationale, and confidence ('low' or 'medium'). Do not use external information.",
      },
      {
        role: "user",
        content: `Known speakers: ${speakers.map(speaker => `${speaker.speakerKey} (${speaker.defaultName})`).join(", ")}\n\nDialogue:\n${transcript}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "speaker_roles",
        strict: true,
        schema: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  speakerKey: { type: "string" },
                  suggestedRole: { type: "string" },
                  rationale: { type: "string" },
                  confidence: { type: "string", enum: ["low", "medium"] },
                },
                required: ["speakerKey", "suggestedRole", "rationale", "confidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    },
  });
  return parseSuggestions(response.choices?.[0]?.message?.content, new Set(speakers.map(speaker => speaker.speakerKey)));
}
