# Vantum Image Generation System

> **OS path:** `OS/Image Generation/vantum-image-generation-system.md`
> **Voice:** Read `OS/Voices/vantum.md` before writing scene copy or captions.
> **Style:** Align with `OS/Style Guide/vantum_style_guide.md` and `OS/Style Guide/vantum_pdf_design_system_v2.html`.
> **House rules:** No em dashes. No exclamation marks in learner-visible copy.

> **Purpose:** Single reference for generating Vantum lesson whiteboard images  - style rules, prompt structure, batch pipeline, API usage, and website integration.
>
> **Current production style:** Manifest 7 (v7 whiteboard + dry-erase marker)
> **Current production model:** `gemini-3.1-flash-image-preview` (Google Gemini “Nano Banana 2”)
> **Scope:** 202 newsletter lesson images across 7 courses (C1–C7)

Use this document in Claude (or any LLM) when writing prompts, reviewing outputs, wiring a website, or running batch generation.

---

## Table of contents

1. [System overview](#1-system-overview)
2. [What Manifest 7 is](#2-what-manifest-7-is)
3. [Style bible (v7 whiteboard)](#3-style-bible-v7-whiteboard)
4. [Prompt anatomy](#4-prompt-anatomy)
5. [Standard PREFIX and SUFFIX (copy-paste)](#5-standard-prefix-and-suffix-copy-paste)
6. [Writing a new scene block](#6-writing-a-new-scene-block)
7. [Diagram types and reference layouts](#7-diagram-types-and-reference-layouts)
8. [File locations in the repo](#8-file-locations-in-the-repo)
9. [Batch pipeline (how we generate at scale)](#9-batch-pipeline-how-we-generate-at-scale)
10. [API: `/api/iterate`](#10-api-apiiterate)
11. [Manifest JSON row shape](#11-manifest-json-row-shape)
12. [Website integration](#12-website-integration)
13. [Quality control / rejection criteria](#13-quality-control--rejection-criteria)
14. [What this system is NOT](#14-what-this-system-is-not)
15. [Full example prompt](#15-full-example-prompt)
16. [Quick command reference](#16-quick-command-reference)

---

## 1. System overview

Images are **not** generated one-off in the UI for lessons. They follow a manifest pipeline:

```
Manifest7/c*_image_manifest.md
        ↓  (npm run manifest7:build)
newsletters-manifest-style7.json
        ↓  (npm run manifest7:run)
POST /api/iterate  →  Gemini image model
        ↓
data/manifest7/c1 … c7/{slug}-1.jpg
```

**Stack:**

| Layer | Technology |
|-------|------------|
| Image model | Google Gemini via `@google/genai` |
| Model ID (Manifest 7) | `gemini-3.1-flash-image-preview` |
| Server | Node/Express (`server.js`) on port 3000 |
| Batch runner | `scripts/newsletter-batch.js` |
| Auth | `GEMINI_API_KEY` in `.env` |

**Fallback:** On quota/rate errors, the server retries once with `GEMINI_IMAGE_FALLBACK_MODEL` (default: `gemini-3.1-flash-image-preview`).

---

## 2. What Manifest 7 is

Manifest 7 is the **current production image style** for Vantum newsletter lesson pages.

- **Prompts:** Same whiteboard + legibility prompts as Manifest 5
- **Style spec:** `Manifest7/v7_whiteboard_style_bible.md`
- **Source markdown:** `Manifest7/c1_image_manifest.md` through `c7_image_manifest.md` (21 lessons × 7 courses = **202 images**)
- **Machine manifest:** `newsletters-manifest-style7.json`
- **Exports:** `data/manifest7/c1/` … `data/manifest7/c7/`
- **Resume state:** `data/newsletter-batch-state-manifest7.json`

Manifest 7 evolved from v4 chalkboard diagrams → whiteboard marker style (Manifest 4/5) → Gemini 3.1 Flash Image rendering (Manifest 7).

To refresh Manifest 7 markdown from Manifest 5 edits:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/_manifest7-from-manifest5.ps1
npm run manifest7:build
```

---

## 3. Style bible (v7 whiteboard)

### Brand alignment

- **Design system source:** `vantum_pdf_design_system_v2.html` (Vantum PDF Design System v2)
- **Instructional structure:** Same as v4 chalk  - title, dense labels, bottom caption, stick figures without faces when needed
- **Substrate:** Light whiteboard for lead-magnet lesson pages (not dark green chalkboard)

### Surfaces

| Element | Value |
|---------|-------|
| Board background | `#f7f8fa` (lesson page bg) or `#ffffff` (card white) |
| Optional frame | `rgba(15,23,42,0.08)` hairline at edge |
| Texture | Faint dry-erase smudges only  - crisp, not chalk dust, not photo noise |

### Primary linework

| Element | Value |
|---------|-------|
| Diagram + labels | `#0f172a`  - bold marker, slight wobble, glossy streak at stroke ends |
| Muted / ghost elements | `#64748b` or `#94a3b8` (slate only) |
| Never | Hairline CAD vectors, neon rainbow, low-contrast gray-on-gray body text |

### Accent colors (Vantum roles)

Use **one dominant highlight** per image. Paired contrast may use **two** (problem vs go).

| Role | Hex | Use |
|------|-----|-----|
| **Emerald** | `#059669` | Go / win / right path / “do this” |
| **Ochre** | `#C97B00` | Insight / value / diagnostic / money punchline |
| **Terracotta** | `#B34A3F` | Stop / wrong / friction / mistake |
| **Cyan** (sparing) | `#0891b2` | System / AI / tooling layer |

**Legacy v4 chalk → brand remap:**

| v4 hex | → | Brand |
|--------|---|--------|
| `#F4D35E` (yellow) | → | `#C97B00` ochre |
| `#7DC4A1` (mint) | → | `#059669` emerald |
| `#E8826E` (coral) | → | `#B34A3F` terracotta |
| `#7DAEC4` (sky) | → | `#0891b2` cyan |

### Typography

- **PDFs:** Montserrat only
- **Raster whiteboard images:** Hand-lettered marker  - do **not** render literal Montserrat. Match weight hierarchy (heavy title, clear body, no decorative serif)

### Stick figures

- Round heads, **NO facial features**  - no eyes, no mouth
- Only when role-contrast or human-in-loop is the lesson

---

## 4. Prompt anatomy

Every lesson image prompt has **three parts**. Concatenate them in order.

```
[PREFIX]   - style anchor (always the same)
[SCENE]    - specific composition (unique per lesson)
[SUFFIX]   - constraints (always the same, with per-image accent note)
```

Each manifest entry in `Manifest7/c*_image_manifest.md` also documents:

- **ManifestIndex**  - batch order (001–202)
- **Composition**  - structural diagram description
- **Accent color**  - which element gets the hero highlight
- **Labels**  - exact quoted strings that must appear in the image
- **Reference**  - layout anchor PNG name (composition only; see note below)

> **Reference PNGs:** Entries cite `v4_ref_01_funnel.png` through `v4_ref_05_quadrant.png` for **composition inspiration**. The batch runner sends **text-only prompts** (no reference images attached). Attach refs manually only if experimenting in the UI.

---

## 5. Standard PREFIX and SUFFIX (copy-paste)

### PREFIX (paste verbatim at the start of every prompt)

```
Hand-drawn whiteboard illustration. Vantum lesson-page whiteboard: surface #f7f8fa or #ffffff (clean, bright), optional hairline frame rgba(15,23,42,0.08). Very faint dry-erase smudges - keep it tidy, not dirty. Primary diagram linework in bold dry-erase ink #0f172a (Vantum text-primary) with confident hand-drawn strokes - slight wobble, varying pressure, occasional overshoot at intersections, slight glossy marker streak at stroke ends. Hand-lettered marker labels in casual instructor's handwriting style, letters slightly varied in size and slant.
Legibility (Manifest7): All text the learner must read (titles, captions, callouts, diagram labels, card text) must be hand-lettered in bold, even-coverage dry-erase ink #0f172a at full contrast - no patchy or watery strokes on those phrases, and do not alternate random pale-gray words with dark words inside the same readable line. Faded #94a3b8 (or similar) is only for explicitly ghosted / de-emphasized visuals that this prompt says are background or "not the point" - never for punchlines or captions. Copy fidelity: render every quoted phrase in this prompt exactly as written - no synonyms, abbreviations, or shortened variants.
```

### SUFFIX (paste verbatim at the end; adjust accent sentence per image)

**Base suffix:**

```
Hormozi-style teaching diagram - labels teach the lesson, the structural diagram carries the meaning. Mobile-thumbnail readable in 2 seconds. Stick figures (if any) have round heads with NO facial features - no eyes, no mouth. No 3D, no photorealism, no gradients except very subtle board smudge, no cartoon styling, no AI-art look. Vantum PDF palette for marker accents: emerald #059669 (go/win), ochre #C97B00 (insight/value), terracotta #B34A3F (stop/problem), cyan #0891b2 sparingly for system/AI. One dominant highlight unless explicit paired contrast (prefer terracotta vs emerald). All other linework #0f172a. Background #f7f8fa or #ffffff throughout.
```

**Per-image accent line (customize one sentence before the base suffix):**

Examples from existing prompts:

- `Single accent color (ochre dry-erase marker on right column box) used only on the punchline element; all non-accent linework is deep dry-erase ink #0f172a. Background stays lesson whiteboard #f7f8fa throughout.`
- `Single accent color (emerald dry-erase marker on right figure and card)  - left row stays in faded light-gray marker #94a3b8. Background stays lesson whiteboard #f7f8fa throughout.`

---

## 6. Writing a new scene block

Between PREFIX and SUFFIX, write the **scene block** using this structure:

```
Title "[TITLE TEXT]" hand-lettered at top center in deep dry-erase ink #0f172a with hand-drawn underline curve beneath.

[CORE COMPOSITION]
- Diagram type: funnel / paired contrast / equation / 2x2 / hierarchy / hub-and-spoke / stack / cascade / iceberg / doors / etc.
- Labeled elements and spatial arrangement
- Stick figures only if the lesson requires human role contrast
- Accent: which single element gets emerald / ochre / terracotta / cyan, and why

Bottom caption hand-lettered in bold dry-erase ink #0f172a (full opacity, even coverage): "[EXACT PUNCHLINE TEXT]"
```

### Scene block rules

1. **Quote all learner-visible text** in double quotes  - the model must render it exactly
2. **One dominant accent** unless the lesson is explicitly paired contrast (then terracotta vs emerald)
3. **Bottom caption** = one short punchline takeaway, always bold `#0f172a`
4. **Title** = slightly larger than body, with hand-drawn underline curve
5. **Mobile thumbnail test:** composition must read in ~2 seconds at small size
6. **Dense labels teach**  - the diagram structure carries meaning; Hormozi-style instructional density

### Manifest entry template (for adding to markdown)

```markdown
## C1_1.1  - Lesson title here
**ManifestIndex:** 001 | **Tier:** Paid | **ImageCount:** 1 | **Image Relationship:** Single | **Reference:** v4_ref_04_paired.png

**Composition:** [structural description]

**Accent color:** [role + hex + which element]

**Labels:** [list of exact strings]

**Gemini prompt:**
> [PREFIX line 1]
> [PREFIX line 2  - legibility block]
>
> [SCENE BLOCK]
>
> [Per-image accent sentence + base SUFFIX]

**Grading rubric notes:** [what must pass visual QA]
```

---

## 7. Diagram types and reference layouts

Reference PNGs live in `Maifest 3/` (chalk-era layouts; use for **composition only**, insist on whiteboard + Vantum colors in the prompt):

| Reference file | Layout type |
|----------------|-------------|
| `v4_ref_01_funnel.png` | Funnel / tier bars |
| `v4_ref_02_doors.png` | Two doors / binary choice |
| `v4_ref_03_formula.png` | Equation / iceberg / stacked phases |
| `v4_ref_04_paired.png` | Side-by-side contrast (wide vs narrow, title vs outcome) |
| `v4_ref_05_quadrant.png` | 2×2 matrix |

---

## 8. File locations in the repo

| Path | Purpose |
|------|---------|
| `Manifest7/v7_whiteboard_style_bible.md` | Style rules and failure modes |
| `Manifest7/c1_image_manifest.md` … `c7_image_manifest.md` | Human-editable prompts (202 lessons) |
| `newsletters-manifest-style7.json` | Batch manifest (prompts + model per row) |
| `scripts/manifest2-md-to-json.js` | Builds JSON from markdown |
| `scripts/newsletter-batch.js` | Batch runner → `/api/iterate` |
| `scripts/_manifest7-from-manifest5.ps1` | Syncs Manifest7 MD from Manifest5 |
| `server.js` | Express API + Gemini image generation |
| `data/manifest7/c1/` … `c7/` | Exported JPEGs (`{slug}-1.jpg`) |
| `data/newsletter-batch-state-manifest7.json` | Resume checkpoint |
| `.env` | `GEMINI_API_KEY`, optional model overrides |

**Slug convention:** `C1_1_1` = Course 1, Module 1, Lesson 1 → export file like `001_C1_1_1-1.jpg` in flat-by-course layout under `data/manifest7/c1/`.

---

## 9. Batch pipeline (how we generate at scale)

### Prerequisites

1. `npm install`
2. Copy `.env.example` → `.env`, set `GEMINI_API_KEY`
3. Start server: `npm run dev` (port 3000)

### Commands

```bash
# Build JSON from Manifest7 markdown (pins model on every row)
npm run manifest7:build

# Generate all images (resume-safe)
npm run manifest7:run -- --expect-jobs 202

# Full reset (ignore checkpoint, regenerate everything)
npm run manifest7:run -- --reset-state --expect-jobs 202

# Refresh markdown from Manifest5, then rebuild
npm run manifest7:from-m5
npm run manifest7:build
```

### What the batch runner does per row

1. Reads prompt from `newsletters-manifest-style7.json`
2. POSTs to `http://127.0.0.1:3000/api/iterate` with:
   - `prompt`  - full assembled string
   - `model`  - `gemini-3.1-flash-image-preview`
   - `outputCount`  - 1
   - **No reference images** (`--no-characters`, `characterRefs: []`)
   - **No aspectRatio / resolution** (Gemini defaults)
3. Copies output to `data/manifest7/c{N}/{slug}-1.jpg`
4. Saves progress to state file (safe to stop and resume)

### Switch to Pro model

Rebuild JSON with Pro model pinned:

```bash
node scripts/manifest2-md-to-json.js --manifest-dir Manifest7 --out newsletters-manifest-style7.json --default-model gemini-3-pro-image-preview
```

---

## 10. API: `/api/iterate`

**Endpoint:** `POST /api/iterate`

**Request body:**

```json
{
  "prompt": "Full PREFIX + SCENE + SUFFIX string",
  "model": "gemini-3.1-flash-image-preview",
  "outputCount": 1,
  "aspectRatio": "16:9",
  "resolution": "2K",
  "sessionId": null,
  "projectId": null,
  "images": []
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `prompt` | Yes | Full assembled prompt string |
| `model` | No | Defaults to `GEMINI_IMAGE_MODEL` env; Manifest 7 pins `gemini-3.1-flash-image-preview` |
| `outputCount` | No | 1–4, default 1 |
| `aspectRatio` | No | e.g. `"16:9"`, `"4:3"`, `"1:1"` |
| `resolution` | No | `"1K"`, `"2K"`, or `"4K"` |
| `images` | No | Optional reference images: `[{ "base64": "...", "mimeType": "image/jpeg" }]`  - Manifest 7 batch sends none |
| `sessionId` | No | UUID for iteration context; batch creates one per row |

**Response:**

```json
{
  "message": "Done. Here are your generated images.",
  "model": "gemini-3.1-flash-image-preview",
  "sessionId": "uuid",
  "generationId": 123,
  "images": [
    {
      "id": 456,
      "url": "/generated/{sessionId}/{generationId}-1.jpg",
      "base64": "...",
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Allowed Gemini models:** `gemini-3.1-flash-image-preview`, `gemini-3-pro-image-preview`, `gemini-2.5-flash-image`, and Imagen 4 variants.

**OpenRouter alternative:** Set `model` to `openai/gpt-5.4-image-2` (requires `OPENROUTER_API_KEY`)  - used by Manifest 6, not Manifest 7.

---

## 11. Manifest JSON row shape

Each row in `newsletters-manifest-style7.json`:

```json
{
  "lessonKey": "001",
  "newsletterSlug": "C1_1_1",
  "topic": "The fractional title is a ceiling",
  "prompts": ["...full prompt string..."],
  "characterRefs": [],
  "model": "gemini-3.1-flash-image-preview"
}
```

- **`lessonKey`**  - zero-padded index (001–202)
- **`newsletterSlug`**  - maps to newsletter markdown in `newsletters/c1/` etc.
- **`prompts`**  - array; most rows have one prompt; multi-image lessons can have multiple
- **`characterRefs`**  - always `[]` for Manifest 7 (no Warrior/King/Magician/Lover refs)

---

## 12. Website integration

**Never expose `GEMINI_API_KEY` in the browser.** Generate server-side or pre-bake assets.

### Option A  - Pre-baked CDN (recommended for production)

1. Run `npm run manifest7:run -- --expect-jobs 202`
2. Upload `data/manifest7/c1/` … `c7/` to your CDN
3. Map lesson slug → static URL:

```
C1_1_1 → https://cdn.example.com/lesson-images/c1/001_C1_1_1-1.jpg
```

Cheapest, fastest page loads, no runtime API cost.

### Option B  - On-demand via Nano Banana server

Your website backend proxies to the running Nano Banana server:

```javascript
const row = manifest.find(r => r.newsletterSlug === "C1_1_1");

const res = await fetch("https://your-nano-banana-host/api/iterate", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    prompt: row.prompts[0],
    model: "gemini-3.1-flash-image-preview",
    outputCount: 1
  })
});

const { images } = await res.json();
// Serve images[0].url or upload images[0].base64 to your storage
```

### Option C  - Direct Gemini from your backend

Use `@google/genai` with the same prompt strings and model ID. Mirror the logic in `server.js` → `generateGeminiImageContent()`.

### Lookup table for your site

Build a map from `newsletters-manifest-style7.json`:

| Field | Use on site |
|-------|-------------|
| `newsletterSlug` | Primary key (`C1_1_1`) |
| `topic` | Alt text / caption fallback |
| `prompts[0]` | Regeneration or admin preview |
| Export path | `data/manifest7/c{N}/{lessonKey}_{newsletterSlug}-1.jpg` |

---

## 13. Quality control / rejection criteria

### Reject if any of these appear

1. Dark green chalkboard background (v4 chalk sneaking back)
2. Primary linework too light on white (must be `#0f172a` range)
3. Random non-brand accent hues (purple, off-brand teal, etc.)
4. More than one dominant accent (unless explicit paired contrast)
5. Faces on stick figures
6. Thumbnail unreadable in ~2 seconds
7. Patchy, watery, or randomly pale words in readable lines
8. Paraphrased or shortened copy vs the prompt quoted strings

### Optional automated QA

Add `--verify-openai` to the batch run for vision-model APPROVE/REJECT loops (requires `OPENAI_API_KEY` or `OPENROUTER_API_KEY`).

Manual review: batch appends prompts + file paths to `data/chatgpt-grading-log.txt` for paste-into-Claude/ChatGPT review.

---

## 14. What this system is NOT

| System | Purpose | Do not confuse with Manifest 7 |
|--------|---------|-------------------------------|
| `website-assets/manifest.jobs.js` | Landing page UI mockups (Montserrat, dashboard screenshots) | Different style entirely |
| Manifest 3 / v4 chalk | Dark green chalkboard `#2A3D33` | Legacy; replaced by whiteboard |
| Manifest 6 | OpenRouter `openai/gpt-5.4-image-2` | Different model backend |
| `Charectors/` (Warrior, King, etc.) | Character reference images for archetype newsletters | Manifest 7 uses `--no-characters` |

---

## 15. Full example prompt

**Lesson:** C1_1.1  - The fractional title is a ceiling  
**ManifestIndex:** 001  
**Reference layout:** v4_ref_04_paired.png (paired contrast)

```
Hand-drawn whiteboard illustration. Vantum lesson-page whiteboard: surface #f7f8fa or #ffffff (clean, bright), optional hairline frame rgba(15,23,42,0.08). Very faint dry-erase smudges - keep it tidy, not dirty. Primary diagram linework in bold dry-erase ink #0f172a (Vantum text-primary) with confident hand-drawn strokes - slight wobble, varying pressure, occasional overshoot at intersections, slight glossy marker streak at stroke ends. Hand-lettered marker labels in casual instructor's handwriting style, letters slightly varied in size and slant.
Legibility (Manifest7): All text the learner must read (titles, captions, callouts, diagram labels, card text) must be hand-lettered in bold, even-coverage dry-erase ink #0f172a at full contrast - no patchy or watery strokes on those phrases, and do not alternate random pale-gray words with dark words inside the same readable line. Faded #94a3b8 (or similar) is only for explicitly ghosted / de-emphasized visuals that this prompt says are background or "not the point" - never for punchlines or captions. Copy fidelity: render every quoted phrase in this prompt exactly as written - no synonyms, abbreviations, or shortened variants.

Title "TWO POSITIONINGS" hand-lettered at top center in deep dry-erase ink #0f172a with hand-drawn underline curve beneath. Below, two side-by-side columns separated by a faint dashed vertical marker line. Left column header "TITLE-LED" with small terracotta dry-erase marker X above. Inside left column: a small marker-outlined box labeled "FRACTIONAL CMO" hand-lettered, with three short hand-lettered lines beneath: "competes on price / easy to ignore / rate plateaus." Right column header "OUTCOME-LED" with small emerald dry-erase marker check above. Inside right column: a larger marker-outlined box outlined in ochre dry-erase marker #C97B00 labeled "I HELP SERIES A SAAS HIT SERIES B IN 6 MONTHS" hand-lettered, with three short hand-lettered lines beneath: "attracts right buyers / commands rate / compounds." Bottom caption hand-lettered in bold dry-erase ink #0f172a (full opacity, even coverage): "TITLE IS A CEILING. OUTCOME IS A LADDER."

Hormozi-style teaching diagram  - labels teach the lesson, the structural diagram carries the meaning. Mobile-thumbnail readable in 2 seconds. No 3D, no photorealism, no gradients except very subtle board smudge, no cartoon styling, no AI-art look. Single accent color (ochre dry-erase marker on right column box) used only on the punchline element; all non-accent linework is deep dry-erase ink #0f172a. Background stays lesson whiteboard #f7f8fa throughout.
```

---

## 16. Quick command reference

```bash
# Setup
npm install
cp .env.example .env   # add GEMINI_API_KEY
npm run dev            # start server on :3000

# Manifest 7 workflow
npm run manifest7:from-m5          # sync MD from Manifest5
npm run manifest7:build            # MD → JSON
npm run manifest7:run -- --expect-jobs 202   # generate all images

# Resume after interruption (same command, no --reset-state)
npm run manifest7:run -- --expect-jobs 202

# Interactive UI (single image iteration)
# Open http://localhost:3000  - paste any full prompt from Manifest7
```

---

## Claude usage notes

When working with this system in Claude:

- **Writing a new lesson image:** Use Section 5 PREFIX + your scene (Section 6) + Section 5 SUFFIX with a custom accent line
- **Reviewing a generated image:** Check against Section 13 rejection criteria
- **Website work:** Use Section 12; prefer pre-baked CDN for production
- **Finding an existing prompt:** Look up `newsletterSlug` in `newsletters-manifest-style7.json` or the matching `Manifest7/c*_image_manifest.md` entry
- **Regenerating one lesson:** POST the prompt from that entry to `/api/iterate` with model `gemini-3.1-flash-image-preview`

---

*Last aligned with Manifest 7 / Nano Banana repo. Model: `gemini-3.1-flash-image-preview`. Image count: 202 lessons (C1–C7).*
