import { describe, expect, it } from "vitest";
import { MAX_CLIENT_UPLOAD_BYTES, formatMediaBytes, isMediaWithinUploadLimit, isVideoFile } from "./mediaPreparation";

describe("client media preparation limits", () => {
  it("keeps the browser preparation target aligned with the 16 MB intake ceiling", () => {
    expect(isMediaWithinUploadLimit({ size: MAX_CLIENT_UPLOAD_BYTES })).toBe(true);
    expect(isMediaWithinUploadLimit({ size: MAX_CLIENT_UPLOAD_BYTES + 1 })).toBe(false);
    expect(formatMediaBytes(MAX_CLIENT_UPLOAD_BYTES)).toBe("16.0 MB");
  });

  it("only offers in-browser compression for video sources", () => {
    expect(isVideoFile({ type: "video/mp4" })).toBe(true);
    expect(isVideoFile({ type: "audio/webm" })).toBe(false);
  });
});
