import type { CopyMakerInputs } from '../types/copyMaker'
import { getSupabaseBrowserClient } from '../lib/supabaseClient'

const MAX_FRAMEWORK_CHARS = 14_000

function truncateForPrompt(text: string, max: number): { text: string; truncated: boolean } {
  const t = text.trim()
  if (t.length <= max) return { text: t, truncated: false }
  return {
    text: `${t.slice(0, max)}\n\n[…truncated for prompt length]`,
    truncated: true,
  }
}

export type DbQuoteRow = {
  id: number
  pull_quote: string
  theme_tag: string | null
  website_angle: string | null
  intensity: number | null
  emotion: string | null
  persona_stage: string | null
  is_approved: boolean | null
}

export async function getQuotesByPersonaAndEmotion(
  personaStage: 'tofu' | 'mofu' | 'bofu',
  emotion?: string,
): Promise<DbQuoteRow[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []
  let query = supabase
    .from('quotes')
    .select('id, pull_quote, theme_tag, website_angle, intensity, emotion, persona_stage, is_approved')
    .eq('persona_stage', personaStage)
    .eq('is_approved', true)
    .order('intensity', { ascending: false })
    .limit(50)
  if (emotion?.trim()) query = query.eq('emotion', emotion.trim())
  const { data, error } = await query
  if (error) throw new Error(`Quotes query failed: ${error.message}`)
  return Array.isArray(data) ? (data as DbQuoteRow[]) : []
}

export async function getTopQuotesByIntensity(limit = 20): Promise<DbQuoteRow[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('quotes')
    .select('id, pull_quote, theme_tag, website_angle, intensity, emotion, persona_stage, is_approved')
    .eq('is_approved', true)
    .order('intensity', { ascending: false })
    .limit(Math.max(1, Math.min(200, limit)))
  if (error) throw new Error(`Top quotes query failed: ${error.message}`)
  return Array.isArray(data) ? (data as DbQuoteRow[]) : []
}

export type CompetitiveLandscapeRow = {
  competitive_product: string | null
  competitive_sentiment: string | null
  raw_text: string | null
  adoption_barrier: string | null
  name: string
  segment: string | null
  classification: string | null
}

export async function getCompetitiveLandscape(limit = 100): Promise<CompetitiveLandscapeRow[]> {
  const supabase = getSupabaseBrowserClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('competitive_landscape')
    .select('competitive_product, competitive_sentiment, raw_text, adoption_barrier, name, segment, classification')
    .limit(Math.max(1, Math.min(500, limit)))
  if (error) throw new Error(`Competitive landscape query failed: ${error.message}`)
  return Array.isArray(data) ? (data as CompetitiveLandscapeRow[]) : []
}

export type PersonaWithQuotes = {
  persona_stage: 'tofu' | 'mofu' | 'bofu'
  quotes: DbQuoteRow[]
}

export async function getActivePersonaWithQuotes(
  personaStage: 'tofu' | 'mofu' | 'bofu',
  limit = 20,
): Promise<PersonaWithQuotes> {
  const quotes = await getQuotesByPersonaAndEmotion(personaStage)
  return {
    persona_stage: personaStage,
    quotes: quotes.slice(0, Math.max(1, Math.min(200, limit))),
  }
}

export function buildCopyPrompt(inputs: CopyMakerInputs): string {
  const {
    styleGuide,
    writerVoiceContent,
    customerPersonaContent,
    topic,
    writingFrameworkKind,
    writingFrameworkFrameworkMd,
    writingFrameworkPostText,
    writingFrameworkCustom,
    writingFrameworkUrn,
  } = inputs

  let frameworkBlock: string
  if (writingFrameworkKind === 'custom') {
    frameworkBlock = `Custom structure (author-defined):\n${writingFrameworkCustom.trim() || '(not specified)'}`
  } else if (writingFrameworkKind === 'framework') {
    const { text, truncated } = truncateForPrompt(writingFrameworkFrameworkMd, MAX_FRAMEWORK_CHARS)
    frameworkBlock = [
      'Follow this swipe-file FRAMEWORK: named mechanism + fill-in-the-blank template with [BRACKETED SLOTS].',
      'Use the template as structural scaffolding only — slot in new content for the TOPIC and PERSONA.',
      'Mirror hook shape, beat order, line-break rhythm, and CTA placement. Do NOT copy facts, names, stats, or stories from the reference.',
      `Source URN: ${writingFrameworkUrn || '(unknown)'}`,
      truncated ? 'Note: excerpt was truncated for token safety.' : '',
      '',
      '--- FRAMEWORK (swipe file) ---',
      text || '(empty)',
    ]
      .filter(Boolean)
      .join('\n')
  } else {
    const { text, truncated } = truncateForPrompt(writingFrameworkPostText, MAX_FRAMEWORK_CHARS)
    frameworkBlock = [
      'Use this high-performing OUTLIER POST as a COPY PATTERN for rhythm, pacing, line breaks, and rhetorical moves only.',
      'Do NOT copy facts, stories, names, or claims. Adapt the pattern to the TOPIC and PERSONA.',
      `Source URN: ${writingFrameworkUrn || '(unknown)'}`,
      truncated ? 'Note: excerpt was truncated for token safety.' : '',
      '',
      '--- REFERENCE POST (verbatim for pattern only) ---',
      text || '(empty)',
    ]
      .filter(Boolean)
      .join('\n')
  }

  return `You are an expert social copywriter. Generate exactly ONE strong post for the topic below.

OUTPUT FORMAT (strict JSON only, no markdown fences):
{
  "body": "full post text with appropriate line breaks"
}

Rules:
- The TOPIC is the central subject. Everything must serve the topic.
- Write for the CUSTOMER PERSONA (full persona text below).
- Use the WRITER VOICE document as how it should sound.
- Treat the STYLE GUIDE as hard constraints (tone, taboos, formatting).
- Follow the WRITING FRAMEWORK section for structure / pattern.
- Avoid generic AI voice: no hollow motivation, no vague claims, no filler transitions.
- Keep LinkedIn-style line breaks in mind unless the topic implies another surface.

Priority if instructions conflict:
1) Topic content
2) Customer persona
3) Writer voice
4) Style guide
5) Writing framework

--- TOPIC (primary) ---
${topic.description.trim() || '(missing)'}

--- CUSTOMER PERSONA (full document) ---
${customerPersonaContent.trim() || '(not provided)'}

--- WRITER VOICE (full document) ---
${writerVoiceContent.trim() || '(not provided)'}

--- STYLE GUIDE (constraints) ---
${styleGuide.trim() || '(not provided)'}

--- WRITING FRAMEWORK ---
${frameworkBlock}
`
}
