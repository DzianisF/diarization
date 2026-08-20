# Diarize Serverless Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-end serverless browser workspace that stores submitted media, extracts audio, transcribes with Whisper, aligns an external acoustic diarization result, and exports an editable conversation.

**Architecture:** The browser holds a random session identifier and operates on durable job records through tRPC. A bounded server-side state machine advances a job through upload/download, audio extraction, Whisper transcription, and Deepgram diarization. S3 stores file bytes; MySQL stores job metadata, merged speaker turns, user display names, and optional LLM suggestions. The interface polls an active job and renders the persisted dialogue.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind 4, shadcn/ui, Express 4, tRPC 11, Drizzle/MySQL, managed S3 helpers, built-in Whisper helper, built-in LLM helper, Deepgram REST API, ffmpeg, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-20-diarize-serverless-design.md`

## Global Constraints

- Accept local upload and direct public `https:` media URLs only; page URLs from YouTube, Vimeo, and social platforms are deliberately unsupported in this release.
- Do not expose storage, Whisper, LLM, or Deepgram credentials to the browser.
- Keep raw file bytes in S3 only. The database stores object keys and structured metadata, never media BLOBs.
- Surface the exact stage labels `uploading`, `extracting audio`, `transcribing`, and `diarizing` in order before `complete` or `failed`.
- Default display labels are `Speaker 1`, `Speaker 2`, and so on, regardless of provider numbering.
- Use only transcript text and existing speaker labels for role suggestions; do not identify real people.
- Constrain all media work to serverless-safe duration, file-size, and concurrency limits; never create a detached worker or indefinite in-process queue.
- Use `process.env.PORT`; do not hardcode a port. Add a root `Dockerfile` only because production requires `ffmpeg`.
- Update `todo.md` when a feature is completed; write and run Vitest coverage before delivery.

---

## File map

| File | Responsibility |
| --- | --- |
| `drizzle/schema.ts` | Persistent job, transcript-turn, and speaker-profile schema. |
| `server/media/types.ts` | Domain types and bounded state-transition rules. |
| `server/media/urlSafety.ts` | Direct public media URL validation and private-network rejection. |
| `server/media/format.ts` | Timestamp formatting and canonical TXT export renderer. |
| `server/media/deepgram.ts` | Server-only Deepgram request/response adapter. |
| `server/media/merge.ts` | Alignment of Whisper segments with diarizer words/utterances. |
| `server/media/ffmpeg.ts` | Bounded audio extraction wrapper. |
| `server/media/jobs.ts` | Database helpers and one-stage job advancement. |
| `server/media/suggestions.ts` | Structured, transcript-only LLM role suggestions. |
| `server/media/upload.ts` | Multipart upload and bounded direct-URL acquisition to S3. |
| `server/media/*.test.ts` | Unit and adapter tests for the corresponding server modules. |
| `server/routers.ts` | Public session-scoped tRPC job procedures. |
| `server/_core/index.ts` | Registration of the bounded media-upload Express route. |
| `client/src/lib/session.ts` | Browser session identifier creation and persistence. |
| `client/src/lib/transcript.ts` | Client export/download and clipboard helpers. |
| `client/src/pages/Home.tsx` | Workspace composition, query polling, and job interactions. |
| `client/src/components/diarize/*.tsx` | Focused input, status, history, participant, and transcript components. |
| `client/src/index.css` | Sacred-geometry background, type tokens, responsive behavior, and motion. |
| `client/index.html` | Font imports and meaningful page title. |
| `Dockerfile` | Node build image with production `ffmpeg`. |
| `README.md` | Local setup, direct URL limits, secrets, usage, testing, and deploy notes. |

---

### Task 1: Persisted job and transcript domain

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `server/media/types.ts`
- Create: `server/media/types.test.ts`
- Modify: `todo.md`

**Interfaces:**
- Produces `JobStage`, `MediaJob`, `TranscriptTurn`, `SpeakerProfile`, `assertNextStage()`, and `makeSpeakerName()` from `server/media/types.ts`.
- Produces Drizzle tables `transcriptionJobs`, `transcriptTurns`, and `speakerProfiles` for later database helpers.

- [ ] **Step 1: Write the failing domain test**

```ts
import { describe, expect, it } from "vitest";
import { assertNextStage, makeSpeakerName } from "./types";

describe("media job state", () => {
  it("accepts the required ordered stages and rejects skipping", () => {
    expect(assertNextStage("uploading", "extracting_audio")).toBe(true);
    expect(() => assertNextStage("uploading", "diarizing")).toThrow("Invalid job transition");
  });

  it("creates user-facing speaker labels from one", () => {
    expect(makeSpeakerName(0)).toBe("Speaker 1");
    expect(makeSpeakerName(2)).toBe("Speaker 3");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run server/media/types.test.ts`

Expected: FAIL because `server/media/types.ts` does not exist.

- [ ] **Step 3: Add the smallest state module and schema**

```ts
export const jobStages = ["uploading", "extracting_audio", "transcribing", "diarizing", "complete", "failed"] as const;
export type JobStage = (typeof jobStages)[number];

const next: Record<Exclude<JobStage, "complete" | "failed">, JobStage> = {
  uploading: "extracting_audio",
  extracting_audio: "transcribing",
  transcribing: "diarizing",
  diarizing: "complete",
};

export function assertNextStage(current: JobStage, target: JobStage): true {
  if (current === "failed" || current === "complete" || next[current] !== target) {
    throw new Error(`Invalid job transition: ${current} -> ${target}`);
  }
  return true;
}

export function makeSpeakerName(index: number): string {
  return `Speaker ${index + 1}`;
}
```

Add schema rows with `jobId` foreign keys, a `sessionId` index on jobs, structured JSON columns for provider metadata/suggestions, and a unique `(jobId, position)` index for transcript order. Generate a Drizzle migration, review its SQL, and apply it with one schema migration call.

- [ ] **Step 4: Run the focused test and type check**

Run: `pnpm vitest run server/media/types.test.ts && pnpm check`

Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit the self-contained domain change**

```bash
git add drizzle/schema.ts drizzle/migrations drizzle/meta server/media/types.ts server/media/types.test.ts todo.md
git commit -m "feat: persist diarization job domain"
```

### Task 2: Safe media URL intake and canonical transcript formatting

**Files:**
- Create: `server/media/urlSafety.ts`
- Create: `server/media/urlSafety.test.ts`
- Create: `server/media/format.ts`
- Create: `server/media/format.test.ts`

**Interfaces:**
- Produces `validatePublicMediaUrl(input: string): URL`, called before remote retrieval.
- Produces `formatTranscript(turns, { timestamps }): string`, used by both UI copy and `TXT` download.

- [ ] **Step 1: Write failing safety and formatter tests**

```ts
import { describe, expect, it } from "vitest";
import { validatePublicMediaUrl } from "./urlSafety";
import { formatTranscript } from "./format";

describe("validatePublicMediaUrl", () => {
  it("accepts a direct public HTTPS URL", () => {
    expect(validatePublicMediaUrl("https://cdn.example.org/call.mp3").hostname).toBe("cdn.example.org");
  });
  it.each(["http://example.org/a.mp3", "https://127.0.0.1/a.mp3", "https://user:pass@example.org/a.mp3"])(
    "rejects unsafe source %s", input => expect(() => validatePublicMediaUrl(input)).toThrow()
  );
});

describe("formatTranscript", () => {
  const turns = [{ speakerName: "Alice", startMs: 65_000, text: "Hello." }];
  it("uses the same readable dialogue shape with timestamps", () => {
    expect(formatTranscript(turns, { timestamps: true })).toBe("[00:01:05] Alice: Hello.");
  });
  it("omits only timestamps", () => {
    expect(formatTranscript(turns, { timestamps: false })).toBe("Alice: Hello.");
  });
});
```

- [ ] **Step 2: Run the focused tests to verify failure**

Run: `pnpm vitest run server/media/urlSafety.test.ts server/media/format.test.ts`

Expected: FAIL because both modules are missing.

- [ ] **Step 3: Implement explicit validation and formatter behavior**

Implement URL parsing with `new URL`, require protocol `https:`, reject usernames/passwords, literals in private IPv4 ranges, IPv6 loopback/unique-local ranges, `localhost`, and non-media pathname extensions. Follow redirects manually, re-validating every location before fetching in Task 3. Format timestamp milliseconds as zero-padded `[HH:MM:SS]` and join nonempty turns with `\n`.

- [ ] **Step 4: Run the focused tests and complete test suite**

Run: `pnpm vitest run server/media/urlSafety.test.ts server/media/format.test.ts && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit the intake and output primitives**

```bash
git add server/media/urlSafety.ts server/media/urlSafety.test.ts server/media/format.ts server/media/format.test.ts
git commit -m "feat: validate direct media URLs and format transcripts"
```

### Task 3: Bounded media acquisition and S3 persistence

**Files:**
- Create: `server/media/upload.ts`
- Create: `server/media/upload.test.ts`
- Modify: `server/_core/index.ts`
- Modify: `server/routers.ts`

**Interfaces:**
- Consumes `validatePublicMediaUrl()` and `storagePut()`.
- Produces `storeRemoteMedia({ jobId, sourceUrl }): Promise<{ key, mimeType, byteLength }>`.
- Produces a `POST /api/media-upload` multipart endpoint accepting one `media` file and `jobId`.
- Produces `jobs.create` tRPC mutation that creates a session-scoped record before transfer.

- [ ] **Step 1: Write failing storage-boundary tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { storeRemoteMedia } from "./upload";

it("stops a remote read at the configured byte limit", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(new Uint8Array(17), { headers: { "content-length": "17" } }));
  await expect(storeRemoteMedia({ jobId: "job-a", sourceUrl: "https://cdn.example.org/a.mp3", fetcher, maxBytes: 16 }))
    .rejects.toThrow("Media exceeds 16 bytes");
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm vitest run server/media/upload.test.ts`

Expected: FAIL because `storeRemoteMedia` does not exist.

- [ ] **Step 3: Implement bounded acquisition and upload route**

Install `multer` and its types. Use memory storage with an explicit `limits.fileSize` matching `MAX_SOURCE_BYTES`; reject missing file, missing job ID, wrong session ownership, or unsupported MIME type. Persist each accepted object as `sessions/<sessionId>/jobs/<jobId>/source-<random>`. For remote sources, use an abortable fetch, reject oversize `content-length`, stream/accumulate no more than `MAX_SOURCE_BYTES`, check the final content type, and call `storagePut`. Return only job metadata to the browser.

- [ ] **Step 4: Run tests and manually verify the route contract**

Run: `pnpm vitest run server/media/upload.test.ts && pnpm check`

Expected: PASS.

Start dev server, create a job through the UI client once it exists, POST an unsupported file, and verify a 4xx JSON error without a stored object.

- [ ] **Step 5: Commit the S3 acquisition boundary**

```bash
git add package.json pnpm-lock.yaml server/media/upload.ts server/media/upload.test.ts server/_core/index.ts server/routers.ts
git commit -m "feat: store bounded media sources in object storage"
```

### Task 4: Audio extraction and provider adapters

**Files:**
- Create: `server/media/ffmpeg.ts`
- Create: `server/media/ffmpeg.test.ts`
- Create: `server/media/deepgram.ts`
- Create: `server/media/deepgram.test.ts`
- Modify: `server/_core/env.ts`

**Interfaces:**
- Produces `extractCompatibleAudio(input: ExtractInput): Promise<StoredAudio>`.
- Produces `diarizeAudio(input: { audioUrl: string }): Promise<DiarizedUtterance[]>`.
- Requires private server-only `DEEPGRAM_API_KEY`.

- [ ] **Step 1: Write failing adapter tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { diarizeAudio } from "./deepgram";

it("maps Deepgram utterances to stable numeric source keys", async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: { utterances: [
    { speaker: 1, start: 3.2, end: 4.6, transcript: "Yes." }
  ] } }), { status: 200 }));
  await expect(diarizeAudio({ audioUrl: "https://signed.example/audio.mp3", fetcher, apiKey: "test" }))
    .resolves.toEqual([{ speakerKey: "dg:1", startMs: 3200, endMs: 4600, text: "Yes." }]);
});
```

- [ ] **Step 2: Run the adapter tests to verify failure**

Run: `pnpm vitest run server/media/ffmpeg.test.ts server/media/deepgram.test.ts`

Expected: FAIL because modules are missing.

- [ ] **Step 3: Implement bounded audio and Deepgram calls**

Download a signed storage object into a unique `/tmp` directory, invoke `ffmpeg` with `execFile` (not a shell) using an allowlisted argument set such as `-vn -ac 1 -ar 16000 -c:a libmp3lame -b:a 32k`, enforce a process timeout, inspect output size, persist output to S3, and finally remove both temporary files. For native audio, still produce the normalized audio object so both speech services operate on the same asset.

Call `https://api.deepgram.com/v1/listen` with `model=nova-3`, `diarize_model=latest`, `punctuate=true`, and `utterances=true`; send `{ url: audioUrl }` with a server-only `Authorization: Token` header. Map provider errors to actionable typed errors and parse every utterance to milliseconds.

- [ ] **Step 4: Run tests and type check**

Run: `pnpm vitest run server/media/ffmpeg.test.ts server/media/deepgram.test.ts && pnpm check`

Expected: PASS.

- [ ] **Step 5: Commit audio and provider adapters**

```bash
git add server/media/ffmpeg.ts server/media/ffmpeg.test.ts server/media/deepgram.ts server/media/deepgram.test.ts server/_core/env.ts
git commit -m "feat: extract audio and request speaker diarization"
```

### Task 5: Merge transcript timing and add safe role suggestions

**Files:**
- Create: `server/media/merge.ts`
- Create: `server/media/merge.test.ts`
- Create: `server/media/suggestions.ts`
- Create: `server/media/suggestions.test.ts`

**Interfaces:**
- Consumes Whisper `segments` and `DiarizedUtterance[]`.
- Produces `mergeSpeakerTurns({ segments, utterances }): MergedTurn[]`.
- Produces `suggestSpeakerRoles({ turns, speakers }): Promise<SpeakerSuggestion[]>`.

- [ ] **Step 1: Write failing merge and suggestion tests**

```ts
import { describe, expect, it } from "vitest";
import { mergeSpeakerTurns } from "./merge";

it("uses the speaker with the largest overlapping duration", () => {
  const result = mergeSpeakerTurns({
    segments: [{ start: 1, end: 4, text: "Question" }],
    utterances: [
      { speakerKey: "dg:0", startMs: 1000, endMs: 1800, text: "" },
      { speakerKey: "dg:1", startMs: 1800, endMs: 4000, text: "" },
    ],
  });
  expect(result[0]).toMatchObject({ speakerKey: "dg:1", speakerName: "Speaker 2", text: "Question" });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm vitest run server/media/merge.test.ts server/media/suggestions.test.ts`

Expected: FAIL because merge and suggestion modules do not exist.

- [ ] **Step 3: Implement deterministic merging and constrained JSON suggestions**

Compute overlap in milliseconds, choose the highest overlap, order source speaker keys by first appearance, and apply `makeSpeakerName()` to that order. Merge neighboring equal-speaker segments only when gap is at most 600 ms. Build an LLM prompt that contains the transcript and anonymized labels only. Request strict JSON shaped as:

```ts
type SpeakerSuggestion = {
  speakerKey: string;
  suggestedRole: string;
  rationale: string;
  confidence: "low" | "medium";
};
```

Reject output for an unknown speaker key, omit a suggestion rather than failing the transcript, and never write suggestions into display-name fields.

- [ ] **Step 4: Run focused tests and all server tests**

Run: `pnpm vitest run server/media/merge.test.ts server/media/suggestions.test.ts && pnpm test`

Expected: PASS.

- [ ] **Step 5: Commit the dialogue intelligence modules**

```bash
git add server/media/merge.ts server/media/merge.test.ts server/media/suggestions.ts server/media/suggestions.test.ts
git commit -m "feat: merge diarization and suggest speaker roles"
```

### Task 6: Durable state-machine job procedures

**Files:**
- Create: `server/media/jobs.ts`
- Create: `server/media/jobs.test.ts`
- Modify: `server/db.ts`
- Modify: `server/routers.ts`

**Interfaces:**
- Produces `advanceJob({ jobId, sessionId }): Promise<MediaJob>` that performs exactly one current state stage.
- Produces tRPC procedures `jobs.create`, `jobs.get`, `jobs.list`, `jobs.advance`, `jobs.renameSpeaker`, and `jobs.suggestRoles`.

- [ ] **Step 1: Write a failing lifecycle test**

```ts
import { describe, expect, it, vi } from "vitest";
import { createJobAdvancer } from "./jobs";

it("advances one stage rather than completing every provider call in one request", async () => {
  const save = vi.fn();
  const advance = createJobAdvancer({ save, extract: vi.fn(), transcribe: vi.fn(), diarize: vi.fn() });
  const job = await advance({ id: "job-1", stage: "extracting_audio", sessionId: "session-1" });
  expect(job.stage).toBe("transcribing");
  expect(save).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm vitest run server/media/jobs.test.ts`

Expected: FAIL because `createJobAdvancer` does not exist.

- [ ] **Step 3: Implement query helpers and session-scoped procedures**

Create DB helpers that always select/update jobs by `(id, sessionId)`. The `advanceJob` switch only executes the present stage: normalize audio, call Whisper using the signed audio URL, call `diarizeAudio`, merge/persist turns and profiles, then mark complete. On an exception, persist `failed` and a safe message. `jobs.renameSpeaker` checks session ownership, validates a trimmed 1–48-character name, updates the profile, and returns refreshed turns. `jobs.suggestRoles` is callable only after completed turns exist.

- [ ] **Step 4: Run tests, type check, and inspect an unauthorised lookup**

Run: `pnpm vitest run server/media/jobs.test.ts && pnpm test && pnpm check`

Expected: PASS.

Call `jobs.get` with a second generated session ID and verify that the original job returns `NOT_FOUND`.

- [ ] **Step 5: Commit the state machine**

```bash
git add server/media/jobs.ts server/media/jobs.test.ts server/db.ts server/routers.ts
git commit -m "feat: advance session-scoped transcription jobs"
```

### Task 7: Workspace components and interaction helpers

**Files:**
- Create: `client/src/lib/session.ts`
- Create: `client/src/lib/transcript.ts`
- Create: `client/src/components/diarize/MediaIntake.tsx`
- Create: `client/src/components/diarize/JobHistory.tsx`
- Create: `client/src/components/diarize/ProcessingStatus.tsx`
- Create: `client/src/components/diarize/ParticipantPanel.tsx`
- Create: `client/src/components/diarize/TranscriptDialog.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- `getSessionId(): string` stores an opaque UUID under `sessionStorage` key `diarize.session.v1`.
- `downloadTranscript(filename, content): void` and `copyTranscript(content): Promise<void>` are the shared output actions.
- Components receive typed job/turn data from the tRPC API and never receive API credentials.

- [ ] **Step 1: Write failing helper tests**

```ts
import { describe, expect, it } from "vitest";
import { formatTranscript } from "@server/media/format";

it("uses the canonical formatter for exported content", () => {
  expect(formatTranscript([{ speakerName: "Speaker 1", startMs: 0, text: "Start" }], { timestamps: false }))
    .toBe("Speaker 1: Start");
});
```

- [ ] **Step 2: Run test to verify failure at the intended module boundary**

Run: `pnpm vitest run client/src/lib/transcript.test.ts`

Expected: FAIL until the browser helper test and public formatting adapter exist.

- [ ] **Step 3: Implement the interaction flow**

Create one page-level state object containing source mode, selected file, source URL, rights confirmation, timestamp visibility, and active job ID. Generate a session ID once. First call `jobs.create`, then either post `FormData` to `/api/media-upload` or invoke bounded remote acquisition, and begin calling `jobs.advance` only when an active job is at its current stage. Query job history at a stable `sessionId` and display each stage. Use the built-in button, input, card, dialog, switch, progress, scroll-area, and tooltip components instead of recreating primitives.

The transcript UI must render readable speaker names and optional `[HH:MM:SS]` labels, offer an inline speaker-name editor with an accessible save action, display suggestions as proposed roles rather than facts, expose copy/download buttons, and present errors without losing available persisted transcript content.

- [ ] **Step 4: Run unit tests and verify the UI in a browser**

Run: `pnpm test && pnpm check`

Expected: PASS.

Verify manually: local intake prevents submit without rights confirmation; URL mode rejects an invalid protocol; an active job shows one exact stage label; timestamp toggle changes only time labels; rename immediately updates all turns; copy/download use identical plain-text content.

- [ ] **Step 5: Commit the workspace flow**

```bash
git add client/src/lib/session.ts client/src/lib/transcript.ts client/src/lib/transcript.test.ts client/src/components/diarize client/src/pages/Home.tsx client/src/App.tsx
git commit -m "feat: add diarization workspace and transcript controls"
```

### Task 8: Sacred-geometry visual system and accessibility pass

**Files:**
- Modify: `client/src/index.css`
- Modify: `client/index.html`
- Modify: `client/src/pages/Home.tsx`

**Interfaces:**
- Produces CSS variables for cream, navy, gold, muted gold, and focus colors.
- Produces presentational geometry via CSS pseudo-elements only; no external image dependency is required.

- [ ] **Step 1: Add a visual-regression acceptance checklist**

Create a checklist in `README.md` under “Visual verification” that requires desktop and 375 px screenshots, readable navy-on-cream text, noninterfering decorative geometry, keyboard focus visibility, and reduced-motion behavior.

- [ ] **Step 2: Verify baseline behavior before style changes**

Run: `pnpm test && pnpm check`

Expected: PASS before visual work.

- [ ] **Step 3: Implement restrained geometry and responsive layout**

Set `@theme inline` tokens in OKLCH. Add an oversized fixed `::before` composition of conic/radial gradients that implies intersecting circles and a golden-ratio spiral at low opacity, set `pointer-events: none`, and preserve high-contrast solid surfaces beneath text. Load `Manrope` for UI copy and `Space Grotesk` for commanding navy headings. Apply a three-column desktop grid that collapses into content, participants, then history on narrow widths. Add transitions under 220 ms only in a `prefers-reduced-motion: no-preference` block.

- [ ] **Step 4: Capture desktop and mobile screenshots and fix issues**

Run: `pnpm test && pnpm check`

Expected: PASS.

Capture `/` at 1280×720 and 375×812. Confirm all task controls are visible and tab focus is evident without relying on geometry contrast.

- [ ] **Step 5: Commit the visual system**

```bash
git add client/src/index.css client/index.html client/src/pages/Home.tsx README.md
git commit -m "style: add sacred geometry workspace identity"
```

### Task 9: Production image, documentation, and release verification

**Files:**
- Create: `Dockerfile`
- Create: `README.md`
- Modify: `todo.md`

**Interfaces:**
- Defines a deployable image that runs `node dist/index.js` after installing `ffmpeg`.
- Documents `DEEPGRAM_API_KEY`, external service constraints, local run steps, supported inputs, and exact test commands.

- [ ] **Step 1: Add a deployment configuration validation test**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

it("keeps the production image focused on the built Node server and ffmpeg", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  expect(dockerfile).toContain("ffmpeg");
  expect(dockerfile).toContain('CMD ["node", "dist/index.js"]');
  expect(dockerfile).not.toContain("DEEPGRAM_API_KEY=");
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm vitest run server/deployment.test.ts`

Expected: FAIL because the Dockerfile is absent.

- [ ] **Step 3: Write deployment, operations, and user documentation**

Use this minimal production image structure:

```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm install -g corepack@latest && corepack pnpm install && corepack pnpm run build
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
```

Document how to add `DEEPGRAM_API_KEY` as a managed secret, configure the allowed file size/duration, run `pnpm test`, and publish through the project UI after the final checkpoint. State plainly that URL intake needs the final bytes of a direct public media file and that YouTube/social-page URLs are rejected by design.

- [ ] **Step 4: Run the full release gate**

Run: `pnpm test && pnpm check && pnpm run build`

Expected: all commands exit 0. Then inspect development-server logs for errors and capture desktop/mobile screenshots of the complete workspace.

- [ ] **Step 5: Mark completed items and commit release-ready source**

```bash
git add Dockerfile README.md server/deployment.test.ts todo.md
git commit -m "docs: prepare diarization app for serverless deployment"
```

---

## Plan self-review

| Specification requirement | Covering task |
| --- | --- |
| File/direct-URL media input, direct-only restriction, and rights confirmation | Tasks 2, 3, and 7 |
| S3 source persistence and durable session job metadata | Tasks 1, 3, and 6 |
| ffmpeg extraction | Task 4 |
| Whisper transcription and stage reporting | Tasks 4 and 6 |
| Acoustic diarization with canonical Speaker N labels | Tasks 4, 5, and 6 |
| User rename and transcript formatting | Tasks 2, 6, and 7 |
| Transcript-only LLM suggestions | Task 5 |
| Timestamp visibility and identical copy/TXT export | Tasks 2 and 7 |
| High-end sacred-geometry UI and accessibility | Task 8 |
| Tests, README, Docker image, and final validation | Tasks 1–9 |

The plan contains no placeholder work items. Types used by later tasks are defined in Tasks 1–6 before their consumers. It deliberately keeps source-page downloaders and persistent queues out of scope because the approved design selects serverless direct-media intake.
