# Transcript Clean — Three-Speaker Product Demo (v1)

You are cleaning a product **DEMO** transcript between three people:

## PRESENTER (Brian)

Co-founder and CTO of Vantum. He:

- Drives the product demonstration
- Walks through features and screens
- Explains how the product works technically
- Answers technical questions about the product
- Shows the UI: task inbox, priority scoring, reshuffle, capacity planning, goal tracking, kanban board, brain dump, timer, scope definition
- Uses language like "what you'll see here," "let me show you," "so this is where," "if you click here"
- Has a solutions engineering / technical background

## INTERVIEWER (Tabarak)

CEO and co-founder of Vantum. He:

- Sets up context and frames the conversation
- Connects the demo features back to problems the interviewee described in their earlier problem interview
- Asks follow-up questions about whether features resonate
- Probes for commitment signals ("would you use this?", "does this solve the problem we talked about?")
- Handles business/pricing/program questions
- May reference the problem interview: "you mentioned last time that..." or "when we talked about your calendar situation..."
- References DocuSign background, Bangkok, the customer development program

## INTERVIEWEE ({{INTERVIEWEE_NAME}}, Fractional {{INTERVIEWEE_ROLE}})

The person seeing the demo. They:

- React to features being shown ("oh, that's cool," "how does that work," "I need that")
- Ask questions about how features work
- Connect features to their own problems ("that would help with my calendar issue")
- Describe their current workflow when comparing to what's shown
- Express enthusiasm, confusion, skepticism, or indifference to features
- Ask about pricing, timeline, integrations, team access
- May reference their problem interview: "like I was saying last time" or "that's the problem I told you about"

---

The original transcript may have speaker attribution errors from auto-transcription. With **three** speakers, misattribution is more common. **Do NOT trust the original speaker labels.** Instead, determine who is speaking based on:

1. **Product demonstration language** — "let me show you," "if you look here," "this is the feature that" → **BRIAN** (he's driving the demo)
2. **Contextual framing** — "remember when you told us about," "in our last call you mentioned," "so the way this connects to your problem" → **TABARAK** (he bridges problems to features)
3. **Reactions and questions from outside** — "oh wow," "can it do X?", "what about my situation where," "I currently use Y for that" → **INTERVIEWEE** (they're reacting to what's being shown)
4. **Technical explanations of HOW something works** → **BRIAN**
5. **Business context and program discussion** → **TABARAK**
6. **Personal workflow descriptions and tool mentions** → **INTERVIEWEE**
7. If someone says "my co-founder" or references the other Vantum person → one of the two founders referring to the other

When ambiguous between Brian and Tabarak, use these tiebreakers:

- Detailed product walkthrough → Brian
- High-level vision / "where this is going" → Tabarak
- "We built this because..." → either; Brian tends toward technical rationale, Tabarak toward customer insight rationale

---

## Output format

Output the **full** transcript with correct speaker labels only. One speaker per block; dialogue can span multiple lines under the same label.

Use these exact label prefixes (interviewee uses the name below):

```
BRIAN: [text]
TABARAK: [text]
{{INTERVIEWEE_LABEL}}: [text]
```

Fix any misattributions based on conversational logic. When uncertain, put `[UNCERTAIN ATTRIBUTION]` on its own line immediately before the attributed line.

Do **not** include timestamps, markdown headers, or commentary outside the labeled transcript.
