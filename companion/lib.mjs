export const COMPANION_PORT = 38491;
export const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
export const MAX_DURATION_SECONDS = 60 * 60;
export const DEFAULT_ALLOWED_ORIGINS = ["https://diarizeweb-iwtgqu2f.manus.space", "http://localhost:3000", "http://127.0.0.1:3000"];

function configuredOrigins() {
  const custom = process.env.DIARIZE_COMPANION_ALLOWED_ORIGINS?.split(",").map(value => value.trim()).filter(Boolean) ?? [];
  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...custom]);
}

export function isAllowedWebOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return configuredOrigins().has(url.origin);
  } catch { return false; }
}

export function validateCompanionRequest(body) {
  if (!body || body.rightsConfirmed !== true) throw new Error("Confirm that you have the right to process this media.");
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim() : "";
  let url;
  try { url = new URL(sourceUrl); } catch { throw new Error("Paste a valid public YouTube URL."); }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (url.protocol !== "https:" || !["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) throw new Error("The local companion currently supports public YouTube URLs only.");
  return sourceUrl;
}

export function parseManualPreparationArgs(args) {
  const values = [...args];
  const rightsConfirmed = values.includes("--rights-confirmed");
  const outputFlag = values.indexOf("--output-dir");
  const outputDir = outputFlag >= 0 ? values[outputFlag + 1] : "output";
  const sourceUrl = values.find(value => /^https:\/\//i.test(value));
  if (outputFlag >= 0 && (!outputDir || outputDir.startsWith("--"))) throw new Error("Provide a folder after --output-dir.");
  return { sourceUrl: validateCompanionRequest({ sourceUrl, rightsConfirmed }), outputDir };
}

export function buildAudioArgs(inputPath, outputPath) {
  return ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "mp3", outputPath];
}

export function buildYouTubeDownloadArgs(sourceUrl, outputTemplate, useAndroidClient = false) {
  const args = ["--no-config", "--no-playlist", "--format", "worstaudio/worst", "--output", outputTemplate];
  if (useAndroidClient) args.push("--extractor-args", "youtube:player_client=android");
  return [...args, sourceUrl];
}

export function friendlyYouTube403(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/HTTP Error 403|Forbidden/i.test(message)) {
    return "YouTube rejected the requested media stream. Update yt-dlp (`brew update && brew upgrade yt-dlp`) and retry. If the current release still returns 403, YouTube may require a browser session or may temporarily reject this source.";
  }
  return message;
}

export function publicJob(job) {
  return { id: job.id, stage: job.stage, progress: job.progress, error: job.error ?? null, filename: job.filename ?? null };
}
