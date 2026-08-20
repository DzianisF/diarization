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

export function buildAudioArgs(inputPath, outputPath) {
  return ["-y", "-i", inputPath, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "32k", "-f", "mp3", outputPath];
}

export function publicJob(job) {
  return { id: job.id, stage: job.stage, progress: job.progress, error: job.error ?? null, filename: job.filename ?? null };
}
