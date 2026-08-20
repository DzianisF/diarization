import { describe, expect, it } from "vitest";

describe("Deepgram credential", () => {
  it("authenticates against the lightweight projects endpoint", async () => {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    expect(apiKey, "DEEPGRAM_API_KEY must be configured for diarization").toBeTruthy();

    const response = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });

    expect(response.status, await response.text()).toBeGreaterThanOrEqual(200);
    expect(response.status, "Deepgram key must authenticate").toBeLessThan(300);
  }, 15_000);
});
