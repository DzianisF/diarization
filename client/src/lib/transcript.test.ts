import { describe, expect, it } from "vitest";
import { timestampLabel } from "./transcript";

describe("timestampLabel", () => {
  it("renders export-compatible zero-padded clock labels", () => {
    expect(timestampLabel(0)).toBe("00:00:00");
    expect(timestampLabel(3_661_000)).toBe("01:01:01");
  });
});
