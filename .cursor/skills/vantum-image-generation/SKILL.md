---
name: vantum-image-generation
description: >-
  Generate and review Vantum Manifest 7 lesson whiteboard images with Gemini
  (Nano Banana). Use when writing image prompts, running manifest7 batch jobs,
  wiring lesson images on a site, QAing whiteboard outputs, or working in the
  Nano Banana / content-os image pipeline.
---

# Vantum image generation (Manifest 7)

## Before you touch prompts

1. Read [OS/Image Generation/vantum-image-generation-system.md](../../OS/Image%20Generation/vantum-image-generation-system.md) for the full system.
2. Read [OS/Voices/vantum.md](../../OS/Voices/vantum.md) for copy tone on titles, labels, and captions.
3. Use [OS/Style Guide/vantum_style_guide.md](../../OS/Style%20Guide/vantum_style_guide.md) for brand colors and surfaces.

## House rules (non-negotiable)

- No em dashes in any prompt text or captions.
- No exclamation marks in learner-visible copy.
- Quote all on-image text exactly. No synonyms or shortened variants.
- One dominant accent per image unless the lesson is explicit paired contrast (terracotta vs emerald).
- Stick figures: round heads, no facial features.

## Prompt assembly (always this order)

```
[PREFIX]  copy verbatim from the system doc
[SCENE]   unique composition for the lesson
[SUFFIX]  per-image accent line + base suffix from the system doc
```

## Production defaults

| Item | Value |
|------|-------|
| Style | Manifest 7 whiteboard + dry-erase marker |
| Model | `gemini-3.1-flash-image-preview` |
| Batch manifest | `newsletters-manifest-style7.json` (Nano Banana repo) |
| Exports | `data/manifest7/c1/` … `c7/` |
| API | `POST /api/iterate` (never expose `GEMINI_API_KEY` in the browser) |

## When writing a new scene

- Mobile-thumbnail readable in ~2 seconds.
- Dense Hormozi-style labels. Structure carries meaning.
- Bottom caption = one bold punchline in `#0f172a`.
- Faded `#94a3b8` only for explicitly ghosted background elements, never punchlines.

## When reviewing output

Reject if any of these appear:

1. Dark green chalkboard background (legacy v4)
2. Primary linework too light on white
3. Off-brand accent hues
4. More than one dominant accent (unless paired contrast)
5. Faces on stick figures
6. Paraphrased copy vs quoted strings

## Website integration

Prefer pre-baked CDN assets for production. See Section 12 in the full system doc.

## Quick commands (Nano Banana repo)

```bash
npm run manifest7:build
npm run manifest7:run -- --expect-jobs 202
```

## Related systems (do not confuse)

- `website-assets/manifest.jobs.js` = landing UI mockups, not lesson whiteboards
- Manifest 6 = OpenRouter image model, not Manifest 7
- `Charectors/` refs = not used in Manifest 7 batch (`characterRefs: []`)
