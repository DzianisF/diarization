import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { storagePut } from "../storage";

const MAX_PLATFORM_BYTES = 16 * 1024 * 1024;
const MAX_PLATFORM_DURATION_SECONDS = 60 * 60;
const PLATFORM_TIMEOUT_MS = 105_000;
const PIPED_APIS = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.leptons.xyz",
  "https://pipedapi.nosebs.ru",
  "https://pipedapi-libre.kavin.rocks",
  "https://piped-api.privacy.com.de",
  "https://api.piped.private.coffee",
];

export type PlatformMetadata = { title: string; durationSeconds: number; estimatedBytes?: number };
type StoredPlatformMedia = { key: string; mimeType: string; byteLength: number; sourceName: string; durationSeconds: number };
export type PipedAudio = { bitrate?: number; mimeType?: string; url?: string };
type PipedResponse = { title?: string; duration?: number; audioStreams?: PipedAudio[] };

export function isYouTubeUrl(input: string): boolean {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.protocol === "https:" && (hostname === "youtube.com" || hostname === "m.youtube.com" || hostname === "youtu.be");
  } catch { return false; }
}

export function buildBrowserDownloadFilename(title: string, extension: string): string {
  const safeTitle = title.replace(/[\\/:*?"<>|\s]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 96) || "diarize-video";
  const safeExtension = /^[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : "webm";
  return `${safeTitle}.${safeExtension}`;
}

export function createYouTubeStreamArgs(sourceUrl: string): string[] {
  if (!isYouTubeUrl(sourceUrl)) throw new Error("Use a public YouTube video URL for browser download.");
  return ["--format", "worst[acodec!=none][vcodec!=none]/worst", "--output", "-", sourceUrl];
}

function getYouTubeId(input: string): string {
  const url = new URL(input);
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const id = hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v") ?? "";
  if (!/^[\w-]{11}$/.test(id)) throw new Error("This YouTube URL does not contain a supported video identifier.");
  return id;
}

export function parsePlatformMetadata(raw: string): PlatformMetadata {
  let value: Record<string, unknown>;
  try { value = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("The platform did not return readable media metadata."); }
  const durationSeconds = Number(value.duration ?? 0);
  const estimatedBytes = Number(value.filesize_approx ?? value.filesize ?? 0) || undefined;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new Error("The platform did not provide a usable media duration.");
  if (durationSeconds > MAX_PLATFORM_DURATION_SECONDS) throw new Error("This platform video is longer than 60 minutes. Use a shorter recording or upload a local file.");
  if (estimatedBytes && estimatedBytes > MAX_PLATFORM_BYTES) throw new Error("This platform media is larger than 16 MB at the selected quality. Use a shorter recording or upload a local file.");
  return { title: typeof value.title === "string" ? value.title.slice(0, 255) : "Platform media", durationSeconds, estimatedBytes };
}

export function friendlyPlatformError(stderr: string): Error {
  const text = stderr.toLowerCase();
  if (text.includes("not a bot") || text.includes("browser verification")) return new Error("YouTube requested browser verification and rejected this free server.");
  if (text.includes("private")) return new Error("This platform video is private. Use a permitted public video or upload a local file.");
  if (text.includes("sign in") || text.includes("login")) return new Error("This platform video requires sign-in. Download the permitted file locally, then upload it here.");
  if (text.includes("429") || text.includes("rate limit") || text.includes("too many requests")) return new Error("The platform is temporarily limiting requests.");
  if (text.includes("unsupported url")) return new Error("This platform URL is not currently supported.");
  return new Error("The platform could not provide downloadable media.");
}

async function runYtDlp(args: string[], timeoutMs = PLATFORM_TIMEOUT_MS): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("yt-dlp", ["--no-config", "--no-playlist", "--no-warnings", ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve({ stdout, stderr }) : reject(friendlyPlatformError(stderr)); });
  });
}

export async function inspectYouTubeBrowserDownload(sourceUrl: string): Promise<PlatformMetadata> {
  const raw = (await runYtDlp(["--skip-download", "--print-json", "--format", "worst[acodec!=none][vcodec!=none]/worst", sourceUrl], 30_000)).stdout.trim();
  let value: Record<string, unknown>;
  try { value = JSON.parse(raw) as Record<string, unknown>; } catch { throw new Error("The platform did not return readable video metadata."); }
  const durationSeconds = Number(value.duration ?? 0);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_PLATFORM_DURATION_SECONDS) {
    throw new Error("This platform video must be between 1 second and 60 minutes for browser download.");
  }
  const estimatedBytes = Number(value.filesize_approx ?? value.filesize ?? 0) || undefined;
  return { title: typeof value.title === "string" ? value.title.slice(0, 255) : "Platform video", durationSeconds, estimatedBytes };
}

export function spawnYouTubeBrowserDownload(sourceUrl: string) {
  return spawn("yt-dlp", ["--no-config", "--no-playlist", "--no-warnings", ...createYouTubeStreamArgs(sourceUrl)], { stdio: ["ignore", "pipe", "pipe"] });
}

function mimeTypeFor(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (extension === "m4a") return "audio/mp4";
  if (extension === "mp3") return "audio/mpeg";
  if (extension === "opus") return "audio/opus";
  if (extension === "ogg") return "audio/ogg";
  return "audio/webm";
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "m4a";
  if (mimeType.includes("mpeg")) return "mp3";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export function selectLowestPipedAudio(streams: PipedAudio[]): PipedAudio | undefined {
  return [...streams]
    .filter(item => typeof item.url === "string" && item.url.startsWith("https://"))
    .sort((a, b) => (a.bitrate ?? Number.MAX_SAFE_INTEGER) - (b.bitrate ?? Number.MAX_SAFE_INTEGER))[0];
}

export async function withPipedFailover<T>(apis: string[], attempt: (api: string) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const api of apis) {
    try { return await attempt(api); }
    catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Free public platform relays are currently unavailable.");
}

async function downloadWithYtDlp({ jobId, sourceUrl }: { jobId: string; sourceUrl: string }): Promise<StoredPlatformMedia> {
  const metadata = parsePlatformMetadata((await runYtDlp(["--skip-download", "--print-json", "--format", "worstaudio/worst", sourceUrl], 30_000)).stdout.trim());
  const tempDir = await mkdtemp(join(tmpdir(), "diarize-platform-"));
  try {
    await runYtDlp(["--format", "worstaudio/worst", "--max-filesize", "16M", "--output", join(tempDir, "source.%(ext)s"), sourceUrl]);
    const [filename] = (await readdir(tempDir)).filter(name => name.startsWith("source."));
    if (!filename) throw new Error("The platform did not create an audio file.");
    const filePath = join(tempDir, filename); const fileStat = await stat(filePath);
    if (fileStat.size > MAX_PLATFORM_BYTES) throw new Error("The downloaded platform media is larger than 16 MB.");
    const mimeType = mimeTypeFor(filename);
    const stored = await storagePut(`jobs/${jobId}/platform.${filename.split(".").pop() ?? "webm"}`, await readFile(filePath), mimeType);
    return { key: stored.key, mimeType, byteLength: fileStat.size, sourceName: metadata.title, durationSeconds: metadata.durationSeconds };
  } finally { await rm(tempDir, { recursive: true, force: true }); }
}

async function fetchPipedJson(api: string, videoId: string): Promise<PipedResponse | undefined> {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`${api}/streams/${videoId}`, { signal: controller.signal, headers: { accept: "application/json" } });
    return response.ok ? await response.json() as PipedResponse : undefined;
  } catch { return undefined; } finally { clearTimeout(timer); }
}

async function downloadPipedAudio(url: string): Promise<{ data: Buffer; mimeType: string }> {
  const streamUrl = new URL(url);
  if (streamUrl.protocol !== "https:") throw new Error("A Piped instance returned an unsafe audio URL.");
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(streamUrl, { signal: controller.signal });
    if (!response.ok || !response.body) throw new Error("The Piped audio stream is unavailable.");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > MAX_PLATFORM_BYTES) throw new Error("The selected platform audio is larger than 16 MB.");
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
    while (true) {
      const next = await reader.read(); if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_PLATFORM_BYTES) { await reader.cancel(); throw new Error("The selected platform audio is larger than 16 MB."); }
      chunks.push(next.value);
    }
    return { data: Buffer.concat(chunks), mimeType: response.headers.get("content-type")?.split(";")[0] || "audio/webm" };
  } finally { clearTimeout(timer); }
}

async function downloadWithPiped({ jobId, sourceUrl }: { jobId: string; sourceUrl: string }): Promise<StoredPlatformMedia> {
  const videoId = getYouTubeId(sourceUrl);
  return withPipedFailover(PIPED_APIS, async api => {
    const data = await fetchPipedJson(api, videoId); const durationSeconds = Number(data?.duration ?? 0);
    if (!data || !Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > MAX_PLATFORM_DURATION_SECONDS) throw new Error("This public relay did not return usable media metadata.");
    const stream = selectLowestPipedAudio(data.audioStreams ?? []);
    if (!stream?.url) throw new Error("This public relay did not expose a usable audio stream.");
    const audio = await downloadPipedAudio(stream.url); const mimeType = stream.mimeType || audio.mimeType;
    const stored = await storagePut(`jobs/${jobId}/platform.${extensionForMime(mimeType)}`, audio.data, mimeType);
    return { key: stored.key, mimeType, byteLength: audio.data.byteLength, sourceName: (data.title || "YouTube media").slice(0, 255), durationSeconds };
  });
}

export async function downloadYouTubeMedia({ jobId, sourceUrl }: { jobId: string; sourceUrl: string }): Promise<StoredPlatformMedia> {
  if (!isYouTubeUrl(sourceUrl)) throw new Error("Use a public YouTube video URL or a direct audio/video file URL.");
  try { return await downloadWithYtDlp({ jobId, sourceUrl }); }
  catch (primaryError) {
    try { return await downloadWithPiped({ jobId, sourceUrl }); }
    catch {
      const primary = primaryError instanceof Error ? primaryError.message : "The platform could not provide downloadable media.";
      throw new Error(`${primary} Free fallback relays were also unavailable. Download the permitted file locally, then upload it here.`);
    }
  }
}
