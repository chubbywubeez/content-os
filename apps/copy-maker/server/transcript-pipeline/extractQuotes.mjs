import { openRouterChat } from './openRouter.mjs'

export const DEFAULT_QUOTE_SYSTEM = `You extract verbatim customer quotes from fractional-operator discovery interviews for Vantum marketing.

Output valid JSON only (no markdown fences) matching this schema:
{
  "interview": "string — interview label",
  "interview_weight": number between 0 and 1 (use 0.5 if unknown),
  "snippets": [
    {
      "theme_tag": "snake_case_theme",
      "pull_quote": "exact or lightly cleaned quote from the PARTICIPANT only",
      "website_angle": "one sentence on how to use this on the website",
      "intensity_1_to_5": integer 1-5
    }
  ]
}

Rules:
- 8–14 snippets when the interview is substantial; fewer if short.
- pull_quote must be participant voice only (not the interviewer).
- Prefer painful, specific, emotionally honest lines over generic advice.
- theme_tag: short snake_case label.`

/**
 * @param {{ interviewLabel: string, participant: string, dialogueMd: string, composite?: number | null }} input
 */
export async function extractQuotesJson(input, prompts = {}) {
  const weight =
    input.composite != null && !Number.isNaN(input.composite)
      ? Math.max(0.1, Math.min(1, input.composite / 100))
      : 0.35

  const user = [
    `Interview label: ${input.interviewLabel}`,
    `Participant to quote: ${input.participant}`,
    `Suggested interview_weight: ${weight.toFixed(2)}`,
    '',
    '--- TRANSCRIPT (Markdown) ---',
    input.dialogueMd,
  ].join('\n')

  const { text } = await openRouterChat({
    system: prompts.extract_quotes_system || DEFAULT_QUOTE_SYSTEM,
    user,
    temperature: 0.25,
    max_tokens: 8192,
    timeoutMs: 300_000,
  })

  const jsonLike = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const data = JSON.parse(jsonLike)
  if (!Array.isArray(data.snippets)) throw new Error('Quote JSON missing snippets array')
  data.interview = data.interview || input.interviewLabel
  data.interview_weight =
    typeof data.interview_weight === 'number' ? data.interview_weight : weight
  return data
}
