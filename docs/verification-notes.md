# Verification Notes

## 2026-08-20 UI review

The Diarize intake workspace rendered successfully at desktop width (1280 px) and mobile width (375 px). The desktop view preserves the three-region composition of session archive, central media intake, and participant panel. The mobile view stacks the intake, participants, then archive without horizontal overflow. Navy primary text remains readable against the cream surface, while gold geometry stays decorative rather than competing with controls.

The current release gate also passed 19 Vitest checks, static type checking, and the production build. A historic development-console hook error occurred during an intermediate hot-update while the page was being replaced; subsequent fresh screenshots rendered correctly with no visible error boundary.

## 2026-08-20 Production YouTube retrieval check

With explicit user authorization, the published application accepted `https://www.youtube.com/watch?v=8bMXdkVpHn4`, showed the `Getting YouTube media` stage at 8%, and attempted both the `yt-dlp` primary path and public Piped fallback. The job then transitioned cleanly to `Needs attention` without running transcription or diarization. The observed upstream result was YouTube browser-verification/sign-in blocking together with unavailable public relays. This validates status reporting, bounded failure, and the local-file fallback, but **does not validate successful public YouTube retrieval on the current free host**.

The user explicitly accepted this confirmed constraint for the test application on 2026-08-20. The free-host implementation therefore remains best-effort, while local audio/video upload remains the reliable path.
