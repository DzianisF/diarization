# Diarize

**Diarize** is a browser workspace for converting a recording into an editable, speaker-labelled dialogue. It accepts a local audio/video file, a direct public HTTPS URL to a media file, or a supported public YouTube page URL on a best-effort basis; it then normalizes the audio track with `ffmpeg`, transcribes it with Whisper, aligns an acoustic speaker-diarization response, and presents a copyable/downloadable transcript.

## What the first release supports

| Capability | Behaviour |
| --- | --- |
| Media input | A local file, final public `https://` media URL, or a public YouTube page URL. |
| Processing | Explicit stages: uploading, preparing a direct URL or YouTube media, extracting audio, transcribing, diarizing, then complete or failed. |
| Transcript | Whisper text with diarizer-aligned `Speaker 1`, `Speaker 2`, and later display-name editing. |
| Speaker assistance | Optional role suggestions generated from the completed dialogue only; they are not identity claims. |
| Output | Toggle timestamps, copy text, or download `.txt`, `.srt`, and `.vtt` exports with speaker names and cue timing. |
| History | Stored and shown within the current browser session only. |
| Interface language | The RU/EN control in the header switches the main interface language and remembers the choice in this browser. |

> **YouTube is best-effort.** A public YouTube page URL first attempts to retrieve the lightest available audio stream directly, then tries a short list of public Piped relays. Either route can fail when YouTube blocks the hosting IP, requires sign-in, changes its delivery format, or a relay is unavailable. The error message directs the user to upload a permitted local file instead. Vimeo and other platform pages remain unsupported in this release.

### Russian interface

Use the compact **RU/EN** control in the header to choose Russian or English. The preference is stored only in the browser, and the user can return to English at any time. The central intake, processing stages, history, participant actions, video download, local video preparation, and transcript export controls are included in the Russian translation layer.

### Save a supported video to the device

The floating **Save a video** action sends the lowest available progressive YouTube stream directly to the browser. In browsers exposing the File System Access API, Diarize writes verified response chunks directly to the file selected by the user and reports received-byte progress without assembling a large `Blob` or storing the video in S3. Other browsers use a standard attachment download; their own download UI remains the source of truth for start, progress, cancellation, and errors, and Diarize does not infer a successful transfer. A downloaded file can then be selected through **Local file** for transcription, subject to the 16 MB processing limit of the current free-host transcription flow.

This is also best-effort: YouTube browser verification, private/sign-in-only videos, unavailable public relays, 60-minute duration, and the serverless request-time limit can prevent saving a video. Splitting an outgoing response into chunks does not bypass source-side browser verification because the source must first provide an accessible stream.

### Prepare a long video locally

The floating **Prepare long video** action can turn an oversized video into a compact, audio-only speech copy inside a current Chromium or Firefox browser. It uses browser media capture and `MediaRecorder`; the original video remains on the device, and the output targets the same 16 MB upload limit as the server. Preparation is real-time, so the tab should remain open until its visible local-playback progress finishes. If the browser does not expose media capture, or the compact audio result still exceeds 16 MB, the user must trim or prepare the permitted media locally before upload.

### Subtitle export

For a completed conversation, Diarize can export `.srt` and WebVTT `.vtt` cue files. Each cue includes the diarized speaker name and the recorded start/end timing; the standard TXT and copy controls remain available for plain transcript workflows.

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
