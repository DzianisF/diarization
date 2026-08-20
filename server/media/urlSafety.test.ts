import { describe, expect, it } from "vitest";
import { validatePublicMediaUrl } from "./urlSafety";

describe("validatePublicMediaUrl", () => {
  it("accepts a direct public HTTPS media URL", () => {
    expect(validatePublicMediaUrl("https://cdn.example.org/call.mp3").hostname).toBe("cdn.example.org");
  });

  it.each([
    "http://example.org/a.mp3",
    "https://127.0.0.1/a.mp3",
    "https://user:pass@example.org/a.mp3",
    "https://youtube.com/watch?v=123",
  ])("rejects unsafe or unsupported source %s", input => {
    expect(() => validatePublicMediaUrl(input)).toThrow();
  });
});
