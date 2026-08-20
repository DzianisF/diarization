export const MAX_CLIENT_UPLOAD_BYTES = 16 * 1024 * 1024;

export function formatMediaBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isMediaWithinUploadLimit(file: Pick<File, "size">): boolean {
  return file.size <= MAX_CLIENT_UPLOAD_BYTES;
}

export function isVideoFile(file: Pick<File, "type">): boolean {
  return file.type.startsWith("video/");
}

type CaptureVideo = HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream };

function audioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
}

export function canPrepareMediaInBrowser(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  return typeof (HTMLVideoElement.prototype as CaptureVideo).captureStream === "function" || typeof (HTMLVideoElement.prototype as CaptureVideo).mozCaptureStream === "function";
}

export async function prepareAudioForUpload(file: File, onProgress: (percent: number) => void): Promise<File> {
  if (isMediaWithinUploadLimit(file)) return file;
  if (!isVideoFile(file)) throw new Error("Only oversized video files can be prepared in this browser. Choose a shorter audio file or prepare it locally.");
  if (!canPrepareMediaInBrowser()) throw new Error("This browser cannot create a local audio copy. Use a current Chromium or Firefox browser, or prepare a smaller file locally.");
  const mimeType = audioMimeType();
  if (!mimeType) throw new Error("This browser cannot record a compatible compressed audio stream.");

  return new Promise((resolve, reject) => {
    const video = document.createElement("video") as CaptureVideo;
    const url = URL.createObjectURL(file);
    const chunks: BlobPart[] = [];
    let sourceStream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      sourceStream?.getTracks().forEach(track => track.stop());
      URL.revokeObjectURL(url);
      video.remove();
      if (error) reject(error);
      else {
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size > MAX_CLIENT_UPLOAD_BYTES) reject(new Error(`The compressed audio copy is ${formatMediaBytes(blob.size)}, still above the 16 MB analysis limit. Trim the recording and try again.`));
        else {
          const baseName = file.name.replace(/\.[^.]+$/, "") || "recording";
          resolve(new File([blob], `${baseName}-speech.webm`, { type: mimeType }));
        }
      }
    };

    video.preload = "metadata";
    video.playsInline = true;
    video.volume = 0;
    video.style.display = "none";
    video.src = url;
    document.body.append(video);
    video.onerror = () => finish(new Error("The browser could not read this video file."));
    video.onloadedmetadata = async () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) return finish(new Error("The video does not expose a usable duration for browser preparation."));
      sourceStream = video.captureStream?.() ?? video.mozCaptureStream?.();
      const audioTracks = sourceStream?.getAudioTracks() ?? [];
      if (!audioTracks.length) return finish(new Error("The browser could not access an audio track in this video. Choose a file with audio or prepare it locally."));
      try {
        recorder = new MediaRecorder(new MediaStream(audioTracks), { mimeType, audioBitsPerSecond: 48_000 });
      } catch {
        return finish(new Error("The browser could not start a compressed audio recording for this video."));
      }
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data);
        const produced = chunks.reduce((size, chunk) => size + (chunk instanceof Blob ? chunk.size : 0), 0);
        if (produced > MAX_CLIENT_UPLOAD_BYTES && recorder?.state === "recording") {
          video.pause();
          recorder.stop();
        }
      };
      recorder.onerror = () => finish(new Error("Browser audio preparation stopped unexpectedly."));
      recorder.onstop = () => finish(chunks.reduce((size, chunk) => size + (chunk instanceof Blob ? chunk.size : 0), 0) > MAX_CLIENT_UPLOAD_BYTES ? new Error("The compressed audio copy is still above the 16 MB analysis limit. Trim the recording and try again.") : undefined);
      video.ontimeupdate = () => onProgress(Math.min(99, Math.max(1, Math.round((video.currentTime / video.duration) * 100))));
      video.onended = () => recorder?.state === "recording" && recorder.stop();
      recorder.start(1_000);
      onProgress(1);
      try { await video.play(); } catch { recorder.stop(); finish(new Error("The browser prevented local video playback needed for preparation. Start again from this panel.")); }
    };
  });
}
