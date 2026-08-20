import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readdir, rename, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { MAX_AUDIO_BYTES, MAX_DURATION_SECONDS, buildAudioArgs, buildYouTubeDownloadArgs, friendlyYouTube403, parseManualPreparationArgs } from "./lib.mjs";

function run(command, args, timeoutMs) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", chunk => { stdout += String(chunk); });
    child.stderr.on("data", chunk => { stderr += String(chunk); });
    child.on("error", error => { clearTimeout(timer); reject(error); });
    child.on("close", code => { clearTimeout(timer); code === 0 ? resolveRun({ stdout, stderr }) : reject(new Error(stderr || `${command} exited with code ${code}`)); });
  });
}

function usage() {
  console.log("Usage: npm run prepare -- --rights-confirmed [--output-dir /path/to/folder] https://www.youtube.com/watch?v=...");
}

let tempDir;
try {
  const { sourceUrl, outputDir } = parseManualPreparationArgs(process.argv.slice(2));
  const targetDir = resolve(outputDir);
  await mkdir(targetDir, { recursive: true });
  console.log("Inspecting permitted public media locally…");
  const inspected = await run("yt-dlp", ["--no-config", "--no-playlist", "--skip-download", "--print-json", "--format", "worstaudio/worst", sourceUrl], 45_000);
  const metadata = JSON.parse(inspected.stdout.trim());
  const duration = Number(metadata.duration ?? 0);
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DURATION_SECONDS) throw new Error("The companion accepts videos from 1 second to 60 minutes.");
  tempDir = await mkdtemp(join(tmpdir(), "diarize-companion-cli-"));
  console.log("Downloading audio locally…");
  try {
    await run("yt-dlp", buildYouTubeDownloadArgs(sourceUrl, join(tempDir, "source.%(ext)s")), 180_000);
  } catch (error) {
    if (!/HTTP Error 403|Forbidden/i.test(error instanceof Error ? error.message : String(error))) throw error;
    console.log("YouTube returned 403. Retrying with the alternate supported Android player client…");
    try {
      await run("yt-dlp", buildYouTubeDownloadArgs(sourceUrl, join(tempDir, "source.%(ext)s"), true), 180_000);
    } catch (retryError) { throw new Error(friendlyYouTube403(retryError)); }
  }
  const sourceName = (await readdir(tempDir)).find(name => name.startsWith("source."));
  if (!sourceName) throw new Error("The companion could not create a local source file.");
  const preparedPath = join(tempDir, "speech.mp3");
  console.log("Extracting compact speech audio locally…");
  await run("ffmpeg", buildAudioArgs(join(tempDir, sourceName), preparedPath), 120_000);
  if ((await stat(preparedPath)).size > MAX_AUDIO_BYTES) throw new Error("The compact audio is still above the 16 MB Diarize analysis limit. Use a shorter recording.");
  const title = String(metadata.title || "youtube-audio").replace(/[^\w.-]+/g, "-").slice(0, 80) || "youtube-audio";
  const finalPath = join(targetDir, `${title}-${randomUUID().slice(0, 8)}.mp3`);
  await rename(preparedPath, finalPath);
  console.log(`Prepared audio: ${finalPath}`);
  console.log("Open Diarize, choose Local file, and select this MP3.");
} catch (error) {
  console.error(friendlyYouTube403(error));
  usage();
  process.exitCode = 1;
} finally {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}
