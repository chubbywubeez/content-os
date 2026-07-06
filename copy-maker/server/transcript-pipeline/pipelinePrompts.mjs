import fs from 'node:fs'
import {
  PROMPT_CHUNK_DEMO,
  PROMPT_CHUNK_PROBLEM,
  PROMPT_HYPOTHESIS_INTERPRETATION,
  SKILL_SCORING,
  SKILL_TRANSCRIPT_THREE,
  SKILL_TRANSCRIPT_TWO,
} from './paths.mjs'
import { getSupabasePipelineClient } from './supabasePipelineStore.mjs'
import { DEFAULT_CLASSIFY_CALL_SYSTEM } from './classifyCallType.mjs'
import { DEFAULT_SCORING_SYSTEM } from './grade.mjs'
import { DEFAULT_QUOTE_SYSTEM } from './extractQuotes.mjs'
import { DEFAULT_CLASSIFY_PERSONA_SYSTEM } from './classifyPersona.mjs'

export const PIPELINE_PROMPT_CATALOG = [
  {
    key: 'classify_call_system',
    title: 'Classify call type',
    step: 'classify_call',
    order: 1,
    description: 'System prompt for interview vs demo classification.',
  },
  {
    key: 'relabel_two_system',
    title: 'Relabel speakers (2-person interview)',
    step: 'relabel',
    order: 2,
    description: 'Template prompt for Tabarak + participant call cleanup.',
  },
  {
    key: 'relabel_three_system',
    title: 'Relabel speakers (3-person demo)',
    step: 'relabel',
    order: 3,
    description: 'Template prompt for Brian + Tabarak + participant call cleanup.',
  },
  {
    key: 'chunk_problem_system_template',
    title: 'Chunk pass 1 (problem interview)',
    step: 'chunk_pass1',
    order: 4,
    description: 'Template prompt for chunking problem interviews.',
  },
  {
    key: 'chunk_demo_system_template',
    title: 'Chunk pass 1 (demo)',
    step: 'chunk_pass1',
    order: 5,
    description: 'Template prompt for chunking product demos.',
  },
  {
    key: 'interpret_chunks_system_template',
    title: 'Interpret chunks pass 2',
    step: 'chunk_pass2',
    order: 6,
    description: 'Template prompt for hypothesis interpretation.',
  },
  {
    key: 'grade_system',
    title: 'Grade interview system',
    step: 'grade',
    order: 7,
    description: 'System prompt for markdown grading behavior.',
  },
  {
    key: 'grade_rubric',
    title: 'Grade interview rubric',
    step: 'grade',
    order: 8,
    description: 'Full rubric text injected before transcript.',
  },
  {
    key: 'extract_quotes_system',
    title: 'Extract quotes',
    step: 'extract_quotes',
    order: 9,
    description: 'System prompt for quote extraction JSON.',
  },
  {
    key: 'classify_persona_system',
    title: 'Classify persona stage',
    step: 'classify_persona',
    order: 10,
    description: 'System prompt for TOFU/MOFU/BOFU selection.',
  },
]

const LOCKED_OUTPUT_CONTRACTS = {
  classify_call_system: `Output JSON only:
{
  "callType": "interview" | "demo",
  "speakerMode": "two" | "three",
  "confidence": number,
  "rationale": "one sentence"
}`,
  classify_persona_system: `Output valid JSON only:
{
  "persona": "tofu" | "mofu" | "bofu",
  "confidence": number 0-1,
  "rationale": "2-4 sentences citing transcript behavior",
  "promotion_signals": ["optional bullet strings"],
  "disqualifiers": ["optional bullet strings"]
}`,
  extract_quotes_system: `Output valid JSON only (no markdown fences) matching this schema:
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
}`,
}

function withLockedOutputContract(key, rawContent) {
  const contract = LOCKED_OUTPUT_CONTRACTS[key]
  const input = String(rawContent || '').trim()
  if (!contract) return input
  const markerRx =
    /(Output JSON only:|Output valid JSON only(?: \(no markdown fences\) matching this schema)?:)/i
  const markerMatch = input.match(markerRx)
  const prefix = markerMatch?.index != null ? input.slice(0, markerMatch.index).trimEnd() : input
  return `${prefix}\n\n${contract}\n`.trim()
}

function readIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return ''
    return fs.readFileSync(filePath, 'utf8')
  } catch {
    return ''
  }
}

export function getDefaultPipelinePromptMap() {
  return {
    classify_call_system: DEFAULT_CLASSIFY_CALL_SYSTEM,
    relabel_two_system: readIfExists(SKILL_TRANSCRIPT_TWO),
    relabel_three_system: readIfExists(SKILL_TRANSCRIPT_THREE),
    chunk_problem_system_template: readIfExists(PROMPT_CHUNK_PROBLEM),
    chunk_demo_system_template: readIfExists(PROMPT_CHUNK_DEMO),
    interpret_chunks_system_template: readIfExists(PROMPT_HYPOTHESIS_INTERPRETATION),
    grade_system: DEFAULT_SCORING_SYSTEM,
    grade_rubric: readIfExists(SKILL_SCORING),
    extract_quotes_system: DEFAULT_QUOTE_SYSTEM,
    classify_persona_system: DEFAULT_CLASSIFY_PERSONA_SYSTEM,
  }
}

function isMissingTableError(error) {
  const msg = String(error?.message || '').toLowerCase()
  return (
    msg.includes('pipeline_prompts') &&
    (msg.includes('does not exist') || msg.includes('relation') || msg.includes('schema cache'))
  )
}

export async function getDbPipelinePromptRows() {
  const supabase = getSupabasePipelineClient()
  if (!supabase) return { rows: [], available: false, warning: 'Supabase not configured.' }
  const { data, error } = await supabase.from('pipeline_prompts').select('key, content, updated_at')
  if (error) {
    if (isMissingTableError(error)) {
      return { rows: [], available: false, warning: 'Table pipeline_prompts is missing.' }
    }
    throw new Error(`pipeline_prompts query failed: ${error.message}`)
  }
  return { rows: Array.isArray(data) ? data : [], available: true, warning: null }
}

export async function getEffectivePipelinePrompts() {
  const defaults = getDefaultPipelinePromptMap()
  const db = await getDbPipelinePromptRows()
  const map = { ...defaults }
  for (const row of db.rows) {
    const key = String(row.key || '')
    if (!key || !(key in map)) continue
    if (typeof row.content === 'string' && row.content.trim()) {
      map[key] = withLockedOutputContract(key, row.content)
    }
  }
  return map
}

export async function listPipelinePrompts() {
  const defaults = getDefaultPipelinePromptMap()
  const db = await getDbPipelinePromptRows()
  const byKey = new Map(db.rows.map((row) => [String(row.key || ''), row]))
  const prompts = PIPELINE_PROMPT_CATALOG.map((item) => {
    const row = byKey.get(item.key)
    const dbContent = typeof row?.content === 'string' ? row.content : null
    const effectiveContent = withLockedOutputContract(item.key, dbContent || defaults[item.key] || '')
    return {
      ...item,
      content: effectiveContent,
      source: dbContent && dbContent.trim() ? 'database' : 'default',
      updatedAt: row?.updated_at ?? null,
    }
  })
  return {
    prompts,
    databaseEnabled: db.available,
    warning: db.warning,
  }
}

export async function savePipelinePrompt({ key, content }) {
  const supabase = getSupabasePipelineClient()
  if (!supabase) throw new Error('Supabase not configured.')
  const catalogRow = PIPELINE_PROMPT_CATALOG.find((x) => x.key === key)
  if (!catalogRow) throw new Error(`Unknown prompt key: ${key}`)
  const nowIso = new Date().toISOString()
  const normalizedContent = withLockedOutputContract(key, content)
  const payload = {
    content: normalizedContent,
    title: catalogRow.title,
    step: catalogRow.step,
    sort_order: catalogRow.order,
    updated_at: nowIso,
  }
  const { data: existing, error: findError } = await supabase
    .from('pipeline_prompts')
    .select('id')
    .eq('key', key)
    .limit(1)
    .maybeSingle()
  if (findError) {
    if (isMissingTableError(findError)) {
      throw new Error('Table pipeline_prompts is missing. Run setup SQL first.')
    }
    throw new Error(`pipeline_prompts lookup failed: ${findError.message}`)
  }

  const { error } = existing?.id
    ? await supabase.from('pipeline_prompts').update(payload).eq('id', existing.id)
    : await supabase.from('pipeline_prompts').insert([{ key, ...payload }])
  if (error) {
    if (isMissingTableError(error)) {
      throw new Error('Table pipeline_prompts is missing. Run setup SQL first.')
    }
    throw new Error(`pipeline_prompts save failed: ${error.message}`)
  }
  return { ok: true, content: normalizedContent }
}
