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
