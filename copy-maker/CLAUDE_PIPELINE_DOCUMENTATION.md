# Copy Maker Pipeline Documentation (Claude Handoff)

This file explains how the current pipeline works from transcript interview import onward, what prompts are involved, and how data flows into copy/image generation.

Use this as the source context when asking Claude to debug or extend the system.

---

## 1) High-Level System Map

There are 3 connected but separate tracks:

1. Transcript processing pipeline (import -> clean -> classify -> relabel -> grade -> quote extraction -> persona patch).
2. Interview browsing APIs/UI (list/detail/export for processed interviews and demos).
3. Copy + image generation workflow (uses UI state, not direct automatic interview ingestion).

Core app path: `copy-maker/`.

---

## 2) Transcript Pipeline: End-to-End Flow

Main orchestrator:

- `copy-maker/server/transcript-pipeline/runPipeline.mjs`
- Function: `runTranscriptPipeline(rawText, originalFilename)`

Step sequence emitted to UI as SSE events:

1. `upload`
   - Saves raw input in pipeline job folder.
2. `clean`
   - Normalizes transcript text.
3. `classify_call`
   - Predicts `callType` (`interview` or `demo`) and speaker mode (`two` or `three`).
4. `relabel`
   - Uses LLM + transcript-cleaning prompt file to fix speaker attribution.
5. `speakers`
   - Parses relabeled transcript into normalized dialogue markdown.
6. `upsert_person`
   - Creates/updates person row in Supabase (`people`) before persistence.
7. `save_transcript`
   - Writes canonical transcript markdown to presentations folder.
   - Also inserts transcript row in Supabase (`transcripts`).
8. `chunk_pass1`
   - Runs universal chunking pass and stores rows in `chunks`.
9. `chunk_pass2`
   - Runs hypothesis interpretation pass and stores rows in `chunk_interpretations`.
10. `grade` (interview only)
   - Runs scoring rubric prompt and writes `.score.md`.
11. `extract_scores` (interview only)
   - Parses score output into structured row(s) in `scores`.
12. `grading_sheet` (interview only)
   - Rebuilds grading rollup markdown if script exists.
13. `extract_quotes`
   - Produces per-interview JSON quote snippets.
   - Also writes marketing-ready quote rows into Supabase (`quotes`).
14. `quote_docs`
   - Rebuilds quote rollup markdown if script exists.
15. `classify_persona` (interview only)
   - LLM TOFU/MOFU/BOFU classification.
   - Also updates `people.persona_stage` and quote persona backfill.
16. `update_persona` (interview only)
   - Appends deduped quotes into persona markdown file.
17. `complete`
   - Writes final job metadata.
   - Marks processing run complete in Supabase (`processing_runs`).

Errors:

- Any thrown error in orchestrator is converted to step event `status: error` with `step: "error"`.
- No full automatic retry loop exists.

---

## 3) Where Files Are Written

Resolved in:

- `copy-maker/server/transcript-pipeline/paths.mjs`

Important directories:

- `Problem Presentations/`
- `Problem Presentations/scores/`
- `Problem Presentations/copy_mining/per_interview/`
- `Problem Presentations/pipeline/jobs/<jobId>/`

Common artifacts per run:

- Job folder: `raw.txt`, `cleaned.txt`, `call-type.json`, `relabeled.txt`, `dialogue.md`, `meta.json`
- Canonical transcript: `Problem Presentations/<stem>.md`
- Score: `Problem Presentations/scores/<stem>.score.md` (interviews only)
- Quotes JSON: `Problem Presentations/copy_mining/per_interview/<stem>.json`
- Persona metadata: `Problem Presentations/copy_mining/per_interview/<stem>.meta.json`

---

## 4) API + UI Trigger Flow

Server endpoint:

- `POST /api/transcript-pipeline/run`
- Implemented by Vite middleware plugin:
  - `copy-maker/vite-plugin-transcript-pipeline.ts`

Accepted payload formats:

- `multipart/form-data` (file upload)
- `application/json` with `{ text, filename }`
- raw text body fallback

Client trigger path:

- `copy-maker/src/components/TranscriptImportModal.tsx`
- calls `copy-maker/src/services/transcriptPipelineClient.ts`
- parses SSE `step`, `error`, `done` events

---

## 5) Prompt Inventory (Pipeline)

## 5.1 Call type classification prompt

File: `copy-maker/server/transcript-pipeline/classifyCallType.mjs`
Function: `classifyCallTypeWithLlm`

System prompt:

```text
You classify Vantum customer call transcripts.

**interview** — Problem discovery: Tabarak (CEO) explores a fractional operator's pain. No full product UI walkthrough. Usually 2 speakers (Tabarak + interviewee). Sometimes says "Connect" in title.

**demo** — Product demonstration: Brian (CTO) walks through Vantum screens; Tabarak may bridge to prior problem interview; customer reacts. Usually 3 speakers (Brian, Tabarak, customer). Look for "let me show you", feature names, UI language.

Output JSON only:
{
  "callType": "interview" | "demo",
  "speakerMode": "two" | "three",
  "confidence": number,
  "rationale": "one sentence"
}
```

User prompt content includes:

- heuristic guess
- detected speakers
- title
- transcript excerpt (first 24k chars)

---

## 5.2 Speaker relabel prompt

File: `copy-maker/server/transcript-pipeline/relabelSpeakers.mjs`
Function: `relabelSpeakersWithLlm`

System prompt source files loaded dynamically:

- `Skills/Transcript_Clean_Two_Speaker_Interview_v1.md`
- `Skills/Transcript_Clean_Three_Speaker_Demo_v1.md`

Runtime substitutions applied:

- `{{INTERVIEWEE_NAME}}`
- `{{INTERVIEWEE_LABEL}}`
- `{{INTERVIEWEE_ROLE}}` (currently fixed as `"operator"`)

User prompt includes:

- inferred call type mode
- interviewee name hint
- full cleaned transcript under raw transcript marker

---

## 5.3 Scoring prompt

File: `copy-maker/server/transcript-pipeline/grade.mjs`
Function: `gradeTranscript`

Inline system prompt:

```text
You are a rigorous customer discovery analyst. The user message contains the full Vantum Interview Scoring rubric (v2) followed by an interview transcript in Markdown.

Apply the rubric exactly: fill every section and table in the template with substantive content.
Use transcript evidence only for numeric scores and quotes. When in doubt, score lower (per rubric).
For OUTPUT 6 (Post-Call Commitment): you only have the transcript — mark post-call behavior as **N/A — transcript only** and apply the rubric's interim rule (redistribute that weight to Hypothesis Fit for the composite).
Output a single Markdown document (no JSON wrapper). Preserve the rubric's headings and structure.
```

Rubric injected into user message from:

- `Skills/Vantum_Scoring_Prompt_v2.md`

Then transcript markdown is appended under `## TRANSCRIPT (Markdown)`.

---

## 5.4 Quote extraction prompt

File: `copy-maker/server/transcript-pipeline/extractQuotes.mjs`
Function: `extractQuotesJson`

Inline system prompt (strict JSON schema) requires:

- interview label
- interview weight (0..1)
- snippets array with:
  - `theme_tag`
  - `pull_quote`
  - `website_angle`
  - `intensity_1_to_5`

Rule highlights:

- 8-14 snippets when possible
- participant voice only
- prioritize specific painful lines

---

## 5.5 Persona classification prompt

File: `copy-maker/server/transcript-pipeline/classifyPersona.mjs`
Function: `classifyPersonaStage`

Inline system prompt defines strict persona choices:

- `tofu`
- `mofu`
- `bofu`

User prompt includes:

- participant
- excerpted persona documents
- optional score excerpt
- transcript excerpt

Persona source files:

- `OS/Customer Personas/vantum-persona-tofu.md`
- `OS/Customer Personas/vantum-persona-mofu.md`
- `OS/Customer Personas/vantum-persona-bofu.md`

---

## 6) OpenRouter Runtime and Reliability

File:

- `copy-maker/server/transcript-pipeline/openRouter.mjs`

Environment variables:

- required: `OPENROUTER_API_KEY`
- optional: `OPENROUTER_MODEL`
  - default: `anthropic/claude-sonnet-4.6`

Behavior:

- non-stream chat calls only for transcript pipeline
- AbortController timeout per call
- throws on HTTP non-OK or empty content
- no built-in retry policy

---

## 7) Interviews Catalog APIs (Post-Pipeline Browsing)

Server plugin:

- `copy-maker/vite-plugin-interviews-data.ts`

Catalog backend:

- `copy-maker/server/interviews-data/interviewsCatalog.mjs`
- `copy-maker/server/interviews-data/inferPersona.mjs`

Endpoints include:

- `GET /api/interviews`
- `GET /api/demos`
- `GET /api/interviews/:stem`
- `GET /api/interviews/:stem/export.md`

Client:

- `copy-maker/src/services/interviewsClient.ts`

UI readers:

- `copy-maker/src/components/InterviewsPage.tsx`
- `copy-maker/src/components/DemosPage.tsx`
- `copy-maker/src/components/InterviewDetailModal.tsx`

---

## 8) Copy Generation Flow (Separate Track)

Important: Auto-query helpers now exist for Supabase-backed copy context, but they are not yet auto-called in `buildCopyPrompt`.

Copy generation uses `CopyMakerState` fields only.

Main files:

- `copy-maker/src/services/copyPromptBuilder.ts`
- `copy-maker/src/services/copyGenerationService.ts`
- `copy-maker/src/services/openRouterCopyStream.ts`
- `copy-maker/src/hooks/useCopyMakerWorkflow.ts`

Prompt structure builder:

- topic
- customer persona text
- writer voice text
- style guide text
- writing framework block (custom/framework/reference-post pattern)

System message for copy:

```text
You write high-signal social posts. Output valid JSON only matching the schema in the user message.
```

Output contract expected from model:

```json
{
  "body": "full post text with appropriate line breaks"
}
```

Transport:

- client calls `/api/openrouter/v1/chat/completions`
- streaming SSE consumes `choices[0].delta.content`

On parse/stream failure:

- fallback mock post is generated locally

---

## 9) Image Generation Flow

Files:

- `copy-maker/src/services/imagePromptBuilder.ts`
- `copy-maker/src/services/nanoBananaService.ts`
- `copy-maker/src/services/geminiClient.ts`

Prompt builder uses:

- selected final post
- image context text
- optional one-off regenerate instructions

Core image brief line:

```text
Create a visual companion for this post.
Do not simply turn the post into text on an image.
```

Transport:

- `/api/gemini/v1beta/models/{model}:generateContent`
- sends multimodal `parts`:
  - optional reference images first
  - text brief second

---

## 10) Important Current Limitation (Very Relevant for Claude Tasks)

As implemented today:

- Transcript pipeline outputs are stored on disk **and** written to Supabase.
- `copyPromptBuilder.ts` includes Supabase query helpers:
  - `getQuotesByPersonaAndEmotion()`
  - `getTopQuotesByIntensity()`
  - `getCompetitiveLandscape()`
  - `getActivePersonaWithQuotes()`
- `buildCopyPrompt()` still requires explicit orchestration to inject fetched DB context into the final prompt body.

If asking Claude to "wire interview insights directly into copy generation," this is the exact gap to implement.

---

## 11) External Prompt Files You Should Include in Claude Context

For full prompt fidelity, also include these files directly when prompting Claude:

- `Skills/Vantum_Scoring_Prompt_v2.md`
- `Skills/Transcript_Clean_Two_Speaker_Interview_v1.md`
- `Skills/Transcript_Clean_Three_Speaker_Demo_v1.md`
- `OS/Customer Personas/vantum-persona-tofu.md`
- `OS/Customer Personas/vantum-persona-mofu.md`
- `OS/Customer Personas/vantum-persona-bofu.md`

If your active run uses the `apps/copy-maker` tree, equivalent prompt files are under:

- `data/skills/`
- `data/os/Customer Personas/`

---

## 12) Quick "Ask Claude" Starter Prompt

```text
Use the attached CLAUDE_PIPELINE_DOCUMENTATION.md as source-of-truth.
Task: [describe your task].
Constraints:
1) Preserve current pipeline step contract and SSE event shapes.
2) Keep changes minimal and modular.
3) Explain exactly which file(s) you changed and why.
4) Add tests or verification steps for each changed behavior.
5) If prompt behavior changes, show old vs new prompt sections explicitly.
```

