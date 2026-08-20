import "dotenv/config";
import express from "express";
import multer from "multer";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getSessionJob, updateSessionJob } from "../db";
import { storagePut } from "../storage";
import { MAX_SOURCE_BYTES } from "../media/upload";
import { buildBrowserDownloadFilename, friendlyPlatformError, inspectYouTubeBrowserDownload, spawnYouTubeBrowserDownload } from "../media/platform";

const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SOURCE_BYTES, files: 1 },
});

function extensionFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]{1,8}$/.test(extension) ? extension : "bin";
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/media-upload", mediaUpload.single("media"), async (req, res) => {
    const sessionId = typeof req.body.sessionId === "string" ? req.body.sessionId : "";
    const jobId = typeof req.body.jobId === "string" ? req.body.jobId : "";
    const file = req.file;
    if (!sessionId || !jobId || !file) {
      res.status(400).json({ error: "A job, session, and media file are required." });
      return;
    }
    if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
      res.status(415).json({ error: "Upload an audio or video file." });
      return;
    }
    const job = await getSessionJob(jobId, sessionId);
    if (!job) {
      res.status(404).json({ error: "Job not found in this browser session." });
      return;
    }
    try {
      const stored = await storagePut(`jobs/${jobId}/source.${extensionFromFilename(file.originalname)}`, file.buffer, file.mimetype);
      const updated = await updateSessionJob(jobId, sessionId, {
        sourceKey: stored.key,
        sourceName: file.originalname.slice(0, 255),
        sourceMimeType: file.mimetype,
        sourceBytes: file.size,
        stage: "extracting_audio",
        progress: 20,
        errorMessage: null,
      });
      res.status(201).json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to store the uploaded file.";
      await updateSessionJob(jobId, sessionId, { stage: "failed", errorMessage: message });
      res.status(500).json({ error: message });
    }
  });
  app.get("/api/platform-download", async (req, res) => {
    const sourceUrl = typeof req.query.url === "string" ? req.query.url : "";
    if (req.query.rights !== "true") {
      res.status(400).json({ error: "Confirm that you have the right to save this media before requesting a download." });
      return;
    }
    try {
      const metadata = await inspectYouTubeBrowserDownload(sourceUrl);
      const filename = buildBrowserDownloadFilename(metadata.title, "webm");
      res.status(200);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Cache-Control", "no-store");
      const child = spawnYouTubeBrowserDownload(sourceUrl);
      let stderr = "";
      const timeout = setTimeout(() => child.kill("SIGKILL"), 165_000);
      child.stderr.on("data", chunk => { stderr += String(chunk); });
      child.stdout.pipe(res);
      const stop = () => { clearTimeout(timeout); if (!child.killed) child.kill("SIGKILL"); };
      req.on("close", stop);
      child.on("close", code => {
        clearTimeout(timeout);
        if (code !== 0 && !res.headersSent) res.status(502).json({ error: friendlyPlatformError(stderr).message });
        else if (!res.writableEnded) res.end();
      });
      child.on("error", () => { clearTimeout(timeout); if (!res.headersSent) res.status(502).json({ error: "The platform download process could not start." }); else res.end(); });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to prepare a browser download from this platform URL.";
      res.status(422).json({ error: message });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
