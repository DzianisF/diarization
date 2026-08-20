import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { storageGetSignedUrl, storagePut } from "../storage";

const execFile = promisify(execFileCallback);
const MAX_AUDIO_BYTES = 16 * 1024 * 1024;

export type StoredAudio = {
  key: string;
  mimeType: "audio/mpeg";
  byteLength: number;
};

export async function extractCompatibleAudio({
  jobId,
  sourceKey,
  sourceMimeType,
}: {
  jobId: string;
  sourceKey: string;
  sourceMimeType?: string | null;
}): Promise<StoredAudio> {
  const signedUrl = await storageGetSignedUrl(sourceKey);
  const sourceResponse = await fetch(signedUrl);
  if (!sourceResponse.ok) throw new Error("Unable to read the stored media file.");

  const sourceBuffer = Buffer.from(await sourceResponse.arrayBuffer());
  const tempDir = await mkdtemp(join(tmpdir(), "diarize-"));
  const inputExtension = sourceMimeType?.startsWith("audio/") ? "audio" : "video";
  const inputPath = join(tempDir, `input.${inputExtension}`);
  const outputPath = join(tempDir, "normalized.mp3");

  try {
    await writeFile(inputPath, sourceBuffer);
    await execFile("ffmpeg", [
      "-y", "-i", inputPath,
      "-vn", "-ac", "1", "-ar", "16000",
      "-c:a", "libmp3lame", "-b:a", "32k",
      outputPath,
    ], { timeout: 90_000, maxBuffer: 2 * 1024 * 1024 });
    const audioBuffer = await readFile(outputPath);
    if (audioBuffer.byteLength > MAX_AUDIO_BYTES) {
      throw new Error("Audio remains too large after normalization. Shorten the source media and retry.");
    }
    const stored = await storagePut(`jobs/${jobId}/normalized.mp3`, audioBuffer, "audio/mpeg");
    return { key: stored.key, mimeType: "audio/mpeg", byteLength: audioBuffer.byteLength };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}
