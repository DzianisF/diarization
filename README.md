# Diarize

**Diarize** is a browser workspace for converting a recording into an editable, speaker-labelled dialogue. It accepts a local audio/video file or a direct public HTTPS URL to a media file, normalizes its audio track with `ffmpeg`, transcribes it with Whisper, aligns an acoustic speaker-diarization response, and presents a copyable/downloadable transcript.

## What the first release supports

| Capability | Behaviour |
| --- | --- |
| Media input | A local audio/video file or a final public `https://` URL to a media file. |
| Processing | Explicit stages: uploading, extracting audio, transcribing, diarizing, then complete or failed. |
| Transcript | Whisper text with diarizer-aligned `Speaker 1`, `Speaker 2`, and later display-name editing. |
| Speaker assistance | Optional role suggestions generated from the completed dialogue only; they are not identity claims. |
| Output | Toggle timestamps, copy text, or download a `.txt` file using the same format. |
| History | Stored and shown within the current browser session only. |

> **Direct media only.** This serverless release intentionally rejects YouTube, Vimeo, social-media, and other page URLs. Provide the final audio/video file URL instead. The interface asks the person submitting media to confirm their right to process it.

## Serverless limits

The built-in Whisper integration accepts audio up to **16 MB**, so the source upload and direct download are bounded at that size. `ffmpeg` converts video or audio to a 16 kHz mono MP3 before speech services run. Very long recordings or media that cannot be compressed below the limit will receive an explicit failure message; shorten or pre-compress them before retrying.

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

The root `Dockerfile` is deliberately small and adds only `ffmpeg` to the Node build image. The production server listens on the hosting platform’s `PORT` environment variable. After a verified project checkpoint, publish from the project management interface to use the included hosted URL.

## Visual verification

Before release, verify the home screen at desktop and 375 px mobile widths. Text must remain readable navy-on-cream, the gold geometry must remain decorative, all controls must be keyboard-reachable with a visible focus state, and reduced-motion preferences must suppress nonessential motion.
