# Verification Notes

## 2026-08-20 UI review

The Diarize intake workspace rendered successfully at desktop width (1280 px) and mobile width (375 px). The desktop view preserves the three-region composition of session archive, central media intake, and participant panel. The mobile view stacks the intake, participants, then archive without horizontal overflow. Navy primary text remains readable against the cream surface, while gold geometry stays decorative rather than competing with controls.

The current release gate also passed 19 Vitest checks, static type checking, and the production build. A historic development-console hook error occurred during an intermediate hot-update while the page was being replaced; subsequent fresh screenshots rendered correctly with no visible error boundary.

## 2026-08-20 Production YouTube retrieval check

With explicit user authorization, the published application accepted `https://www.youtube.com/watch?v=8bMXdkVpHn4`, showed the `Getting YouTube media` stage at 8%, and attempted both the `yt-dlp` primary path and public Piped fallback. The job then transitioned cleanly to `Needs attention` without running transcription or diarization. The observed upstream result was YouTube browser-verification/sign-in blocking together with unavailable public relays. This validates status reporting, bounded failure, and the local-file fallback, but **does not validate successful public YouTube retrieval on the current free host**.

The user explicitly accepted this confirmed constraint for the test application on 2026-08-20. The free-host implementation therefore remains best-effort, while local audio/video upload remains the reliable path.

## 2026-08-20 Streaming save-to-device check

The `Save a video` dock is visible in the lower-right corner of the desktop intake workspace and does not obscure the principal local-file or direct-URL controls. Its component checks verify that the native download link stays unavailable until both an HTTPS URL and a rights confirmation are present. The link targets the server download route, which streams `yt-dlp` output to the browser with an attachment response rather than accumulating the complete media file in S3 or in page memory.

The same dock now includes **Choose a saved file for Diarize**. Selecting a local audio/video file dispatches it to the intake workspace, selects the Local file source mode, and lets the user continue through the ordinary upload and analysis flow. This handoff was covered by a component test. The local processing limit remains 16 MB; streaming a larger source to the device does not enlarge the transcription-service limit.

The 2026-08-20 release gate passed 20 Vitest files with 44 tests, `pnpm check`, and `pnpm run build`. The Home-level UI integration test additionally verifies the event-driven handoff from a saved local file back to the populated Local file intake. Successful source delivery is not asserted here: YouTube anti-bot verification occurs before an accessible source stream exists, so output chunking cannot overcome that upstream restriction.

## 2026-08-20 Export and local-preparation check

The transcript formatter produces SRT cues with comma milliseconds and WebVTT cues with dot milliseconds; both preserve speaker labels and prevent a cue from ending before its start time. The completed-record controls expose TXT, SRT, and VTT downloads.

The left-side **Prepare long video** entry point is visible without overlapping the central intake or the right-side **Save a video** action. On browsers exposing `captureStream` and `MediaRecorder`, it creates an audio-only copy locally and reports real-time local-playback progress. It refuses a result over the same 16 MB intake limit and gives an explicit fallback for unsupported browsers; it does not claim to circumvent the source-side YouTube anti-bot constraint.

The final gate for this change passed 23 Vitest files with 50 tests, `pnpm check`, and `pnpm run build`. A stream test writes multiple received chunks through a mocked File System Access handle and verifies the reported byte counts. The jsdom test environment logs an expected warning when it simulates navigation from the native download anchor; production uses the browser download manager for that fallback path.

At 375 px width, the two secondary actions are rendered in the document flow between the explanatory notice and the intake card. The action row is visible and the Local file selector remains unobscured; fixed versions are retained only at `sm` widths and above.

## 2026-08-20 Russian interface check

The header now exposes an RU/EN control. Its preference persists in browser storage and applies Russian text to the main intake, history, processing stages, participant actions, transcript export, platform download, and local video-preparation messages. Dynamic browser-download and local-preparation progress text is also observed and translated after state changes.

The localization release gate passed 25 Vitest files with 54 tests, `pnpm check`, and `pnpm run build`. Tests cover bidirectional dictionary lookup, persistence of the selected Russian locale, visible Russian intake controls on the full Home page, plus translated processing, SRT/VTT export, platform-download, and local-preparation panels.

## 2026-08-20 Recheck of `8bMXdkVpHn4`

With the rights-confirmed browser-download route, `https://www.youtube.com/watch?v=8bMXdkVpHn4` returned HTTP 422 before a response stream was created. The upstream diagnostic was: `YouTube requested browser verification and rejected this free server.` Therefore neither direct server-side audio extraction nor writing a temporary video file can begin for this source in the current hosting environment. The existing Piped fallback is also best-effort and was unavailable during the original production verification.

The stream-to-browser feature is an **egress** path only: it passes bytes to the device after `yt-dlp` has already obtained an accessible stream. It does not make YouTube grant source access and cannot bypass browser verification. A server-local temporary file would have the same prerequisite and would additionally be constrained by the serverless request lifetime and ephemeral disk.

## 2026-08-20 Local companion check

The `companion` package starts a localhost-only HTTP service on `127.0.0.1:38491`. Its health endpoint returned `{ "ok": true, "version": "0.1.0" }` in the smoke check. The service accepts explicit rights confirmation, validates public HTTPS YouTube URLs, uses the device’s own network to retrieve media, creates an audio-only 16 kHz mono 32 kbps MP3 with local `ffmpeg`, rejects outputs over 16 MB, and removes each temporary directory after 30 minutes.

The web-panel test verifies both an authorized local-job request and the ready-audio handoff back into Diarize’s Local file event. The companion’s unit tests verify origin controls, URL/rights validation, and audio-only ffmpeg arguments. This confirms the local protocol and UI handoff, not YouTube’s willingness to serve a particular video on every user network.

The companion now rejects a foreign origin with HTTP 403. A direct test of the published Diarize origin received a valid handshake response; a job request without its fresh nonce was rejected with HTTP 400 before any source retrieval began. The API’s CORS allowlist is exact rather than a wildcard for unrelated Manus sites.

The manual `GET /v1/status` endpoint now returns its minimal `ok` response without an Origin header, so it can be opened directly in a browser for setup diagnostics. `POST /v1/jobs` without Origin remains rejected with HTTP 403; origin checks and the single-use handshake therefore continue to protect all work-creating routes.

## 2026-08-20 Local Network Access permission check

The companion already responds correctly to the historical PNA OPTIONS preflight: the approved Diarize origin receives `Access-Control-Allow-Origin`, supported request headers, and `Access-Control-Allow-Private-Network: true`. Current Chromium documentation explains that this earlier PNA experiment has been replaced by a Local Network Access permission prompt for public websites connecting to loopback or local services. The companion panel now checks that permission where the browser exposes it, gives a direct recovery instruction when it is denied, and explains the site-controls setting next to the address bar.

The final gate for this change passed 26 Vitest files with 58 tests, `pnpm check`, `pnpm run build`, companion unit tests, and a Node syntax check.

## 2026-08-20 Companion startup diagnostic check

The companion panel now displays the exact startup command (`cd companion && npm start`) before a request is submitted and explains that the terminal must remain open. A browser `Failed to fetch` is converted to a clear local-service diagnostic rather than being shown as raw technical text. The test suite validates this error path, and the companion README explains the localhost status check and browser local-network permission.

The release gate passed 26 Vitest files with 57 tests, `pnpm check`, `pnpm run build`, the companion unit tests, and a Node syntax check.
