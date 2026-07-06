import fs from 'node:fs'
import path from 'node:path'
import { PERSONAS_DIR, PERSONA_FILES } from './paths.mjs'
import { openRouterChat } from './openRouter.mjs'

export const DEFAULT_CLASSIFY_PERSONA_SYSTEM = `You classify a fractional-operator interviewee into Vantum's funnel persona for quote placement.

Personas (pick exactly one):
- **tofu** — Awareness / amplifier. NOT in acute capacity pain. May engage but not buying. Often pipeline/positioning pain without client overload.
- **mofu** — Consideration. Building systems, 30–90 day buying window, refining stack, not yet in acute breakdown.
- **bofu** — Decision / bullseye. 3–4+ clients, acute capacity strain, reactive overtime, feast-famine while overloaded, personally accountable.

Output valid JSON only:
{
  "persona": "tofu" | "mofu" | "bofu",
  "confidence": number 0-1,
  "rationale": "2-4 sentences citing transcript behavior",
  "promotion_signals": ["optional bullet strings"],
  "disqualifiers": ["optional bullet strings"]
}

Be strict: most mis-fit interviews are tofu or E-class off-wedge — do not default to bofu.`

function personaExcerpt(personaId) {
  const file = PERSONA_FILES[personaId]
  if (!file) return ''
  const fp = path.join(PERSONAS_DIR, file)
  if (!fs.existsSync(fp)) return ''
  const text = fs.readFileSync(fp, 'utf8')
  const idx = text.indexOf('## Who is not')
  const slice = idx > 0 ? text.slice(0, idx + 1200) : text.slice(0, 3500)
  return `### ${personaId.toUpperCase()}\n${slice}\n`
}

/**
 * @param {{ participant: string, dialogueMd: string, scoreMd?: string }} input
 */
export async function classifyPersonaStage(input, prompts = {}) {
  const personaContext = ['tofu', 'mofu', 'bofu'].map(personaExcerpt).join('\n---\n\n')
  const user = [
    `Participant: ${input.participant}`,
    '',
    '--- Persona definitions (excerpt) ---',
    personaContext,
    '',
    input.scoreMd ? '--- Interview score summary (excerpt) ---\n' + input.scoreMd.slice(0, 6000) : '',
    '',
    '--- Transcript ---',
    input.dialogueMd.slice(0, 80_000),
  ].join('\n')

  const { text } = await openRouterChat({
    system: prompts.classify_persona_system || DEFAULT_CLASSIFY_PERSONA_SYSTEM,
    user,
    temperature: 0.2,
    max_tokens: 2048,
    timeoutMs: 120_000,
  })

  const jsonLike = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const data = JSON.parse(jsonLike)
  const persona = String(data.persona || '').toLowerCase()
  if (!['tofu', 'mofu', 'bofu'].includes(persona)) {
    throw new Error(`Invalid persona: ${data.persona}`)
  }
  return {
    persona,
    confidence: typeof data.confidence === 'number' ? data.confidence : 0.5,
    rationale: String(data.rationale || ''),
    promotion_signals: Array.isArray(data.promotion_signals) ? data.promotion_signals : [],
    disqualifiers: Array.isArray(data.disqualifiers) ? data.disqualifiers : [],
  }
}
