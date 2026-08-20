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

## If Diarize says `Failed to fetch`

That error means the web page cannot reach the companion on your own computer yet; it does **not** mean that YouTube rejected the media. The companion only works when the **published Diarize URL** is open in a browser on the same computer as the terminal. It cannot be reached from the Manus Preview pane or from another device, because `127.0.0.1` means the machine running that browser. First make sure the `npm start` terminal remains open and says it is listening on `http://127.0.0.1:38491`. Then open `http://127.0.0.1:38491/v1/status` in the same browser; it should display JSON with `"ok": true`. If your browser asks for local-network permission, allow it. Finally, reload the published Diarize page and open **Use local companion** again.

If the status URL is `ok` but the panel still cannot connect, the browser has likely denied the published Diarize site permission to use the local network. Open the site-controls icon next to the address bar on `https://diarizeweb-iwtgqu2f.manus.space`, set **Local network access** to **Allow**, and reload the page. This permission is requested by current Chromium browsers for a public HTTPS site that connects to loopback services.

## Comet-compatible manual route

If Comet does not expose a Local Network Access control, bypass the browser-to-localhost connection entirely. From the `companion` directory, run the following command after confirming you have the right to process the public media:

```bash
npm run prepare -- --rights-confirmed --output-dir ~/Downloads "https://www.youtube.com/watch?v=..."
```

The companion downloads and extracts a compact MP3 locally, verifies the 60-minute and 16 MB limits, saves it in the chosen output directory, and deletes its temporary working files. In Diarize, choose **Local file** and select that saved MP3. This fallback works in Comet because the browser only uses its normal file picker; it does not need to make a localhost network request.

### YouTube HTTP 403

The manual command first uses the ordinary public audio route and, only after a YouTube HTTP 403, retries once with yt-dlp's alternate Android player client. If YouTube still rejects the media, update the macOS yt-dlp installation and retry:

```bash
brew update && brew upgrade yt-dlp
```

YouTube can still reject a request based on its current source-side policies or a required browser session. The companion reports that outcome explicitly; it does not claim to bypass such restrictions.

On macOS, run `brew install node yt-dlp ffmpeg`; on Ubuntu/Debian, install Node.js 20+, `yt-dlp`, and `ffmpeg` with your preferred trusted package source; on Windows, install Node.js LTS and then `yt-dlp` plus FFmpeg using `winget` or another trusted package manager. Confirm each command is available with `node --version`, `yt-dlp --version`, and `ffmpeg -version` before running `npm start`.
