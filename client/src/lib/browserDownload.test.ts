// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { savePlatformDownload, supportsMeasuredBrowserDownload } from "./browserDownload";

afterEach(() => vi.unstubAllGlobals());

describe("measured browser download", () => {
  it("writes received stream chunks and reports real byte progress", async () => {
    const write = vi.fn(async () => undefined); const close = vi.fn(async () => undefined);
    const picker = vi.fn(async () => ({ createWritable: async () => ({ write, close }) }));
    Object.defineProperty(window, "showSaveFilePicker", { configurable: true, value: picker });
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(encoder.encode("abc")); controller.enqueue(encoder.encode("de")); controller.close(); } });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200, headers: { "x-diarize-estimated-bytes": "5" } })));
    const progress: number[] = [];
    await savePlatformDownload("/api/platform-download?url=x", update => progress.push(update.receivedBytes));
    expect(supportsMeasuredBrowserDownload()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledTimes(1);
    expect(progress).toEqual([0, 3, 5, 5]);
  });
});
