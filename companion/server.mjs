import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { COMPANION_PORT, MAX_AUDIO_BYTES, MAX_DURATION_SECONDS, buildAudioArgs, buildYouTubeDownloadArgs, friendlyYouTube403, isAllowedWebOrigin, publicJob, validateCompanionRequest } from "./lib.mjs";

const jobs = new Map();
const handshakes = new Map();
const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function json(res, status, value) { res.writeHead(status, JSON_HEADERS); res.end(JSON.stringify(value)); }
function setCors(req, res) {
  const origin = String(req.headers.origin ?? "");
  if (isAllowedWebOrigin(origin)) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type, x-diarize-companion, x-diarize-handshake");
    res.setHeader("access-control-allow-private-network", "true");
    return true;
  }
  return false;
}
function issueHandshake(origin) {
  const nonce = randomUUID();
  handshakes.set(nonce, { origin, expiresAt: Date.now() + 60_000 });
  setTimeout(() => handshakes.delete(nonce), 61_000).unref();
  return nonce;
}
function consumeHandshake(req) {
  const nonce = typeof req.headers["x-diarize-handshake"] === "string" ? req.headers["x-diarize-handshake"] : "";
  const record = handshakes.get(nonce);
  handshakes.delete(nonce);
  if (!record || record.expiresAt < Date.now() || record.origin !== req.headers.origin) throw new Error("A fresh Diarize companion handshake is required.");
}
function run(command, args, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || `${command} exited with code ${code}`)); });
  });
}
async function readBody(req) {
  let body = "";
  for await (const chunk of req) { body += chunk; if (body.length > 20_000) throw new Error("Request payload is too large."); }
  return JSON.parse(body || "{}");
}
function fail(job, error) { job.stage = "failed"; job.progress = 100; job.error = friendlyYouTube403(error); }
async function processJob(job) {
  try {
    job.stage = "inspecting"; job.progress = 8;
    const metadataResult = await run("yt-dlp", ["--no-config", "--no-playlist", "--skip-download", "--print-json", "--format", "worstaudio/worst", job.sourceUrl], 45_000);
    const metadata = JSON.parse(metadataResult.stdout.trim());
    const duration = Number(metadata.duration ?? 0);
    if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) throw new Error("The companion accepts videos from 1 second to 60 minutes.");
    job.stage = "downloading"; job.progress = 20;
    job.dir = await mkdtemp(join(tmpdir(), "diarize-companion-"));
    try {
      await run("yt-dlp", buildYouTubeDownloadArgs(job.sourceUrl, join(job.dir, "source.%(ext)s")), 180_000);
    } catch (error) {
      if (!/HTTP Error 403|Forbidden/i.test(error instanceof Error ? error.message : String(error))) throw error;
      job.stage = "downloading"; job.progress = 35;
      await run("yt-dlp", buildYouTubeDownloadArgs(job.sourceUrl, join(job.dir, "source.%(ext)s"), true), 180_000);
    }
    const sourceName = (await readdir(job.dir)).find(name => name.startsWith("source."));
    if (!sourceName) throw new Error("The companion could not create a local source file.");
    job.stage = "extracting_audio"; job.progress = 68;
    const outputPath = join(job.dir, "speech.mp3");
    await run("ffmpeg", buildAudioArgs(join(job.dir, sourceName), outputPath), 120_000);
    const output = await stat(outputPath);
    if (output.size > MAX_AUDIO_BYTES) throw new Error("The compact audio is still above the 16 MB Diarize analysis limit. Use a shorter recording.");
    job.audioPath = outputPath; job.filename = `${String(metadata.title || "youtube-audio").replace(/[^\w.-]+/g, "-").slice(0, 80) || "youtube-audio"}.mp3`;
    job.stage = "ready"; job.progress = 100;
    setTimeout(() => cleanup(job.id), 30 * 60_000).unref();
  } catch (error) { fail(job, error); }
}
async function cleanup(id) { const job = jobs.get(id); if (!job) return; jobs.delete(id); if (job.dir) await rm(job.dir, { recursive: true, force: true }); }

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${COMPANION_PORT}`);
  if (url.pathname === "/v1/status" && req.method === "GET" && !req.headers.origin) return json(res, 200, { ok: true, version: "0.1.0" });
  if (!setCors(req, res)) return json(res, 403, { error: "This companion accepts requests only from an approved Diarize web origin." });
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  if (url.pathname === "/v1/status" && req.method === "GET") return json(res, 200, { ok: true, version: "0.1.0" });
  if (url.pathname === "/v1/handshake" && req.method === "POST") return json(res, 200, { nonce: issueHandshake(String(req.headers.origin)) });
  if (url.pathname === "/v1/jobs" && req.method === "POST") {
    try {
      if (req.headers["x-diarize-companion"] !== "1") throw new Error("Missing companion request marker.");
      consumeHandshake(req);
      const sourceUrl = validateCompanionRequest(await readBody(req));
      const job = { id: randomUUID(), sourceUrl, stage: "queued", progress: 0, error: null, dir: null, audioPath: null, filename: null };
      jobs.set(job.id, job); void processJob(job); return json(res, 202, publicJob(job));
    } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Invalid companion request." }); }
  }
  const match = url.pathname.match(/^\/v1\/jobs\/([\w-]+)(?:\/(audio))?$/);
  if (match && req.method === "GET") {
    const job = jobs.get(match[1]); if (!job) return json(res, 404, { error: "Companion job not found or expired." });
    if (!match[2]) return json(res, 200, publicJob(job));
    if (job.stage !== "ready" || !job.audioPath) return json(res, 409, { error: "Audio is not ready yet." });
    res.writeHead(200, { "content-type": "audio/mpeg", "content-disposition": `attachment; filename="${job.filename}"`, "cache-control": "no-store" });
    createReadStream(job.audioPath).pipe(res); return;
  }
  return json(res, 404, { error: "Local companion endpoint not found." });
});

server.listen(COMPANION_PORT, "127.0.0.1", () => console.log(`Diarize local companion is listening at http://127.0.0.1:${COMPANION_PORT}`));
