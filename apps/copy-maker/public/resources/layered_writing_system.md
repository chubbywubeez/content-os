# The Layered Writing System

A method for producing high-quality long-form writing at scale — extracted from how the Vantum content library was built.

The core idea: **never write prose first.** Build a skeleton, lock the voice, calibrate against exemplars, then assemble each piece from a constraint stack. Quality emerges from the layers, not from any single drafting pass.

Use this when you're producing more than ~5 pieces of related content (a course, a newsletter library, a book, a sales site, a content series). For one-off pieces, it's overkill.

---

## Phase 1 — Skeleton (structure before prose)

Before any sentences exist, build the structural map of everything you're going to write.

For a newsletter library: course → module → lesson, with one-line concept per lesson.
For a book: section → chapter → key point.
For a single long essay: argument → sub-arguments → evidence per sub-argument.
For a sales page: hook → problem → mechanism → proof → offer → close.

Two rules:

- **Every node has a concept, not a title.** "Closing is not what you think" is a title. "Closing is diagnostic listening, not theatrical persuasion" is a concept. Concepts can be written about; titles can't.
- **Nothing repeats.** If two nodes feel similar, merge them or sharpen the distinction. The skeleton fails if two pieces could be written interchangeably.

Output of Phase 1: a spreadsheet, doc, or list where every node is named with a concept. **No prose yet.** If you start drafting before this is done, you'll discover halfway through that two pieces are the same piece.

---

## Phase 2 — Voice profile (locked separately)

Before drafting, write the voice document. It lives separate from any specific piece — it's the "how we sound" anchor that every piece will match.

A voice profile names:

- **Vocabulary preferences** — words used (e.g., "operator" not "professional"), words banned, recurring phrases.
- **Sentence patterns** — short and declarative, or layered? Where does the rhythm break?
- **What we don't do** — no exclamation marks, no jargon, no fluff openers, no "leverage" or "synergy."
- **Three reference voices** — "writes like X meets Y meets Z" — concrete people whose work models the target.
- **One paragraph that exemplifies the voice at its peak** — written by you, hand-tuned, locked as the reference.

The voice profile is reusable across every piece. Lock it once; reference it always. If voice drifts mid-project, you fix the drift by re-anchoring on this doc, not by editing the drift.

---

## Phase 3 — Reference exemplars (calibrate before scaling)

Before producing the whole library, write 2-3 calibration pieces at the level of quality you want everything to be. These aren't throwaway drafts — they're the standard.

For our work, this was a few hand-crafted newsletters that proved the voice + structure + payoff could land. We graded them against ourselves, rewrote them, and only when they hit did we use them as templates for the rest.

Two rules:

- **Calibrate before scaling.** Producing 200 pieces at 60% quality is worse than producing 5 at 95% and then templating from them.
- **Calibration pieces are the floor, not the ceiling.** Every later piece has to meet or beat them. If a later piece doesn't, the piece is wrong — the standard isn't too high.

---

## Phase 4 — Per-piece constraint stack

For each individual piece, the prompt has three layers that combine:

**PREFIX (always-on)** — the style/voice anchor pulled from the voice profile. Identical across every piece in the project. Doesn't change.

**SCENE BLOCK (variable)** — the specific content of THIS piece:
- Concept (one sentence — from the skeleton)
- Structural shape (paired contrast, funnel, equation, hierarchy, case story, list-with-turn, etc.)
- The punchline — the one thing that has to land
- The opening hook
- The closing line / kicker

**SUFFIX (always-on)** — the constraint list. What this piece must NOT do. Pulled from the failure-mode list (Phase 6). Identical across every piece. Doesn't change.

The stack works because the variable middle is small — usually 5-10 lines. The repeating PREFIX + SUFFIX do most of the quality enforcement. The piece is built, not improvised.

---

## Phase 5 — Drafting in chunks

Don't write 30 pieces in one sitting. Don't even write one piece in one sitting if it's long.

For a library: write 5 pieces, stop, audit, then continue. If quality has drifted, fix the drift before continuing.
For a single long piece: write in 500-700 word sections that each stand on their own, then assemble.

Chunking does three things:

- **Prevents drift.** Quality drops as you write longer. Stopping and checking resets the bar.
- **Localizes failure.** If section 3 is wrong, you fix section 3, not the whole piece.
- **Makes assembly cheap.** Concatenating proven chunks is faster than rewriting prose that's almost-right.

If you're using an LLM, this also dodges crashes and context-window degradation. Small reliable chunks > large fragile ones.

---

## Phase 6 — Rubric per piece (written BEFORE drafting)

Every piece carries its own grading rubric — usually 3-5 falsifiable checks.

For a newsletter: "Opens with a specific moment? Turns by paragraph 3? Kicker is 7 words or shorter? Voice matches profile?"
For a sales page section: "Headline names the buyer's specific frustration? Mechanism is in 1 sentence? Three objections handled before the close?"

Two rules:

- **Rubric is written BEFORE the piece.** If you write the rubric after, you grade what you wrote instead of what you should have written. The rubric becomes a victory lap, not a check.
- **Rubric is binary, not subjective.** "Opens with a specific moment" can be checked. "Feels good" can't.

Maintain a **failure-mode list** alongside the rubric — the 5-10 ways pieces in this project tend to go wrong (too abstract, opens with throat-clearing, kicker is a summary not a turn, etc.). This feeds the SUFFIX in Phase 4.

---

## Phase 7 — Iteration loop (with rejection criteria)

When a piece fails, the rejection has a category, not a vibe.

For our image work, we burned three full iterations before landing on the right system:

- v1 rejected: "Engineering diagrams, not illustrations that land."
- v2 rejected: "Too childish."
- v3 rejected: "Too messy for the sake of being messy."

Each rejection was specific enough that the next version could correct in a direction, not just try again. If a rejection is "I don't like it," that's not actionable. Push for what specifically failed — substrate, structure, voice, opener, kicker, accent.

Iteration cost compounds. The fewer rounds before lock, the cheaper the library. A locked v4 produces 200 pieces at the same quality; a wobbly v2 produces 200 pieces that all need rework.

---

## How to use this in a new chat

Paste this entire document at the start, then add:

> I'm working on [PROJECT]. The skeleton is [LINK / DESCRIPTION].
> The voice profile is [LINK / DESCRIPTION].
> Reference exemplars are [LINK / DESCRIPTION].
>
> Today I want to work on Phase [X] for [SPECIFIC PIECE].
>
> Follow the layered method. Don't skip to drafting.

The instruction enforces sequence. If you let drafting happen before structure / voice / calibration are locked, you'll write 60% pieces and discover the failure on piece 30, not piece 3.

---

## What this method costs

Front-loaded. Phases 1-3 feel slow because nothing publishable comes out of them. You'll be tempted to skip to drafting.

Don't. The compounding shows up after piece 5 — when every later piece assembles in a fraction of the time, holds quality without re-editing, and reads like it came from the same hand.

The library wasn't built by writing well 202 times. It was built by writing well 4 or 5 times, then assembling.
