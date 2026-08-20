# Research Notes

## Superpowers workflow

The user requested that the project follow the methodology in `obra/superpowers`. Its documented core sequence is: clarify and approve a design, write an implementation plan, work test-first, review code, then finish the branch. The project is a new architectural application, so implementation must wait for a design approval.

Source: <https://github.com/obra/superpowers>

## Speech and speaker labeling feasibility

The scaffold's built-in Whisper helper accepts a URL to an uploaded audio file, imposes a 16 MB transcription limit, and returns segment-level timestamps. It does not itself offer acoustic speaker diarization.

Deepgram's current diarization API attributes a numeric speaker identifier to each recognized word and can produce utterance-level transcript groups when used with punctuation and utterances. The documented batch request uses `diarize_model=latest`; its labels are numeric, not real-world speaker identities.

Source: <https://developers.deepgram.com/docs/diarization>

## Initial architectural implication

The requirements combine a Node web interface with audio extraction, durable object storage, asynchronous status reporting, transcription, and acoustic diarization. The design must separate these concerns and explicitly address the managed host's memory and request-time limits before implementation.

## 2026-08-20 — YouTube best-effort retrieval

The originally reviewed `node-ytdl-core` repository states that active development has been paused since 2023-07-14 and directs users to maintained forks. Its documentation nevertheless confirms the relevant mechanics for a downloader: a selected audio-only format may be streamed, platform URLs can be validated, and YouTube can rate-limit or block requests. It also documents that private, sign-in-required, regional, rental, Premium, and some live sources are not generally retrievable without additional access material.

The implementation therefore uses `yt-dlp` within the custom runtime image as a best-effort, server-only adapter rather than exposing any cookie or platform credential to the browser. It restricts requests to public HTTPS YouTube URLs, disables playlists/config files, requests `worstaudio/worst`, and caps selected media to 16 MB / 60 minutes / a short process timeout. Any upstream refusal must surface as a failed job with local-file upload as the fallback.

Source: <https://github.com/fent/node-ytdl-core>

Piped documents an unauthenticated `/streams/:videoId` endpoint returning an `audioStreams` list containing stream URLs, MIME types, and bitrates. The implementation uses it only as a last-resort public relay, selecting the lowest reported bitrate after the direct `yt-dlp` attempt fails. Its published instance list expressly warns that public instances are not guaranteed to be properly configured, so this cannot be a reliable production dependency.

Sources: <https://docs.piped.video/docs/api-documentation/> and <https://raw.githubusercontent.com/TeamPiped/documentation/refs/heads/main/content/docs/public-instances/index.md>
