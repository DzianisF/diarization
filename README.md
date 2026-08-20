# Diarize

**Diarize** is a browser workspace for converting a recording into an editable, speaker-labelled dialogue. It accepts a local audio/video file, a direct public HTTPS URL to a media file, or a supported public YouTube page URL on a best-effort basis; it then normalizes the audio track with `ffmpeg`, transcribes it with Whisper, aligns an acoustic speaker-diarization response, and presents a copyable/downloadable transcript.

## What the first release supports

| Capability | Behaviour |
| --- | --- |
| Media input | A local file, final public `https://` media URL, or a public YouTube page URL. |
| Processing | Explicit stages: uploading, preparing a direct URL or YouTube media, extracting audio, transcribing, diarizing, then complete or failed. |
| Transcript | Whisper text with diarizer-aligned `Speaker 1`, `Speaker 2`, and later display-name editing. |
| Speaker assistance | Optional role suggestions generated from the completed dialogue only; they are not identity claims. |
| Output | Toggle timestamps, copy text, or download a `.txt` file using the same format. |
| History | Stored and shown within the current browser session only. |

> **YouTube is best-effort.** A public YouTube page URL first attempts to retrieve the lightest available audio stream directly, then tries a short list of public Piped relays. Either route can fail when YouTube blocks the hosting IP, requires sign-in, changes its delivery format, or a relay is unavailable. The error message directs the user to upload a permitted local file instead. Vimeo and other platform pages remain unsupported in this release.

### Save a supported video to the device

The floating **Save a video** action prepares the lowest available progressive YouTube stream and sends it directly to the browser as an attachment. The browser download manager saves the response as it arrives; Diarize does not assemble a large `Blob` in page memory or store the complete video in S3. A downloaded file can then be selected through **Local file** for transcription, subject to the 16 MB processing limit of the current free-host transcription flow.

This is also best-effort: YouTube browser verification, private/sign-in-only videos, unavailable public relays, 60-minute duration, and the serverless request-time limit can prevent saving a video. Splitting an outgoing response into chunks does not bypass source-side browser verification because the source must first provide an accessible stream.

## Serverless limits

The built-in Whisper integration accepts audio up to **16 MB**, so the source upload, direct download, and selected platform stream are bounded at that size. Platform pages are additionally limited to **60 minutes** and a short request window. `ffmpeg` converts video or audio to a 16 kHz mono MP3 before speech services run. Very long recordings or media that cannot be compressed below the limit will receive an explicit failure message; shorten or pre-compress them before retrying.

Source and normalized media bytes are kept in managed S3 storage. Job metadata, transcript turns, editable speaker profiles, and suggestions are kept in the database. API credentials stay on the server.

## Required configuration

The project has a managed server secret named `DEEPGRAM_API_KEY`. It is used only by the server for acoustic diarization. Whisper, S3, and the role-suggestion LLM use the platform-provided server integrations.

Never put a Deepgram key in client-side code or a committed `.env` file.

## Local development

```bash
pnpm install
pnpm dev
```

Run checks before a release:

```bash
pnpm test
pnpm check
pnpm run build
```

## Deployment

The root `Dockerfile` adds `ffmpeg`, Python, and `yt-dlp` to the Node build image. The production server listens on the hosting platform’s `PORT` environment variable. After a verified project checkpoint, publish from the project management interface to use the included hosted URL.

## Visual verification

Before release, verify the home screen at desktop and 375 px mobile widths. Text must remain readable navy-on-cream, the gold geometry must remain decorative, all controls must be keyboard-reachable with a visible focus state, and reduced-motion preferences must suppress nonessential motion.
