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
