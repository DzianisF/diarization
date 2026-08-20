type DownloadPhase = "connecting" | "saving" | "complete";

export type DownloadProgress = {
  phase: DownloadPhase;
  receivedBytes: number;
  totalBytes?: number;
};

type WritableHandle = { write: (data: Uint8Array) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> };
type SaveHandle = { createWritable: () => Promise<WritableHandle> };
type BrowserWithFileSave = Window & { showSaveFilePicker?: (options: { suggestedName: string; types: Array<{ description: string; accept: Record<string, string[]> }> }) => Promise<SaveHandle> };

export function supportsMeasuredBrowserDownload(): boolean {
  return typeof window !== "undefined" && typeof (window as BrowserWithFileSave).showSaveFilePicker === "function";
}

export async function savePlatformDownload(
  url: string,
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  const picker = (window as BrowserWithFileSave).showSaveFilePicker;
  if (!picker) throw new Error("This browser does not expose direct file saving.");
  const handle = await picker({ suggestedName: "diarize-video.webm", types: [{ description: "Video", accept: { "video/webm": [".webm"], "video/mp4": [".mp4"] } }] });
  const writer = await handle.createWritable();
  let closed = false;
  try {
    onProgress({ phase: "connecting", receivedBytes: 0 });
    const response = await fetch(url);
    if (!response.ok || !response.body) throw new Error("The video stream could not start.");
    const totalBytes = Number(response.headers.get("x-diarize-estimated-bytes") ?? response.headers.get("content-length") ?? 0) || undefined;
    const reader = response.body.getReader();
    let receivedBytes = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      receivedBytes += next.value.byteLength;
      await writer.write(next.value);
      onProgress({ phase: "saving", receivedBytes, totalBytes });
    }
    await writer.close();
    closed = true;
    onProgress({ phase: "complete", receivedBytes, totalBytes });
  } catch (error) {
    if (!closed) await writer.abort?.();
    throw error;
  }
}
