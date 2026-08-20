# Diarize Local Companion

The companion runs **only on your device** at `http://127.0.0.1:38491`. With your explicit confirmation, it can request a public YouTube URL through your own network, extract a compact mono MP3 locally with `ffmpeg`, and hand the resulting file to the Diarize web page. It does not upload the original video to a third-party service and deletes temporary media after 30 minutes.

The localhost API allows only the published Diarize origin (`https://diarizeweb-iwtgqu2f.manus.space`) plus local development origins. Before creating a job, the web page must obtain a single-use handshake nonce that expires after one minute. If you bind a custom Diarize domain, add it explicitly before starting the companion, for example: `DIARIZE_COMPANION_ALLOWED_ORIGINS=https://diarize.example.com npm start`.

## Requirements

Install Node.js 20+, `yt-dlp`, and `ffmpeg` on the same computer where you open Diarize. The simplest options are `brew install yt-dlp ffmpeg` on macOS, or your package manager on Linux. On Windows, install the official Node.js LTS, then install `yt-dlp` and FFmpeg with a trusted package manager such as `winget`.

## Start

From this `companion` folder, run:

```bash
npm start
```

Keep the terminal open. In the Diarize web app, open **Use local companion**, paste a public YouTube URL, confirm you have permission, and start preparation. The companion is best-effort: YouTube can still reject its request, require a sign-in, or change delivery rules. It intentionally does not import browser cookies or attempt to bypass verification.
