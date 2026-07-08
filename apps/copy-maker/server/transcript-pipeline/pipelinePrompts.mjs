import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import WebSocket from 'ws'
import {
  PROMPT_CHUNK_DEMO,
  PROMPT_CHUNK_PROBLEM,
  PROMPT_HYPOTHESIS_INTERPRETATION,
  REPO_ROOT,
  SKILL_SCORING,
  SKILL_TRANSCRIPT_THREE,
  SKILL_TRANSCRIPT_TWO,
} from './paths.mjs'
import { DEFAULT_CLASSIFY_CALL_SYSTEM } from './classifyCallType.mjs'
import { DEFAULT_SCORING_SYSTEM } from './grade.mjs'
import { DEFAULT_QUOTE_SYSTEM } from './extractQuotes.mjs'
import { DEFAULT_CLASSIFY_PERSONA_SYSTEM } from './classifyPersona.mjs'

let cachedClient = null

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket
}

export const PIPELINE_PROMPT_CATALOG = [
  {
    key: 'content_os_writer_voice_instruction',
    title: "Writer's voice",
    step: 'voice',
    order: 1,
    description: 'Reference step. Voice content comes from OS voice documents.',
    editable: false,
    references: ['data/os/Voices/vantum.md', 'data/os/Voices/brian.md', 'data/os/Voices/tabarak.md'],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_style_guide_instruction',
    title: 'Style guide',
    step: 'style_guide',
    order: 2,
    description: 'Reference step. Style constraints come from the style guide document.',
    editable: false,
    references: ['data/os/Style Guide/vantum_style_guide.md'],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_customer_persona_instruction',
    title: 'Customer persona',
    step: 'customer_persona',
    order: 3,
    description: 'Reference step. Persona context comes from selected persona docs.',
    editable: false,
    references: [
      'data/os/Customer Personas/vantum-persona-tofu.md',
      'data/os/Customer Personas/vantum-persona-mofu.md',
      'data/os/Customer Personas/vantum-persona-bofu.md',
    ],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_topic_instruction',
    title: 'Topic',
    step: 'topic',
    order: 4,
    description:
      'Reference step. Topic is generated from local angle presets/pools or provided by user input (not from an LLM prompt).',
    editable: false,
    references: [
      'src/data/topicAnglePresets.json',
      'src/lib/topicAngleRandomTopic.ts',
      'src/hooks/useTopicAngleLibrary.ts',
      'UI Topic step input',
    ],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_writing_framework_instruction',
    title: 'Writing framework',
    step: 'writing_framework',
    order: 5,
    description: 'Reference step. Framework content comes from outlier catalog or custom framework input.',
    editable: false,
    references: ['data/outliers/data/outliers_swipe_catalog.json', 'UI Writing Framework step input'],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_generate_copy_system',
    title: 'Generate copy (system)',
    step: 'generate_copy',
    order: 6,
    description: 'System prompt for copy generation.',
    editable: true,
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_generate_copy_user_template',
    title: 'Generate copy (user template)',
    step: 'generate_copy',
    order: 7,
    description: 'Full user prompt template for copy generation with placeholders.',
    editable: true,
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_generate_copy_output_contract',
    title: 'Generate copy output contract',
    step: 'generate_copy',
    order: 8,
    description: 'Reference step. JSON output contract is locked server-side.',
    editable: false,
    references: ['src/services/copyGenerationService.ts', 'src/services/copyPromptBuilder.ts'],
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_final_post_refine_system',
    title: 'Final post',
    step: 'final_post',
    order: 9,
    description: 'System prompt for final post refinements.',
    editable: true,
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },
  {
    key: 'content_os_image_prompt_template',
    title: 'Image',
    step: 'image',
    order: 10,
    description: 'Template prompt for image generation.',
    editable: true,
    pipelineId: 'content-os',
    pipelineTitle: 'Content OS pipeline',
  },

  {
    key: 'classify_call_system',
    title: 'Classify call type',
    step: 'classify_call',
    order: 101,
    description: 'System prompt for interview vs demo classification.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'relabel_two_system',
    title: 'Relabel speakers (2-person interview)',
    step: 'relabel',
    order: 102,
    description: 'Template prompt for Tabarak + participant call cleanup.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'relabel_three_system',
    title: 'Relabel speakers (3-person demo)',
    step: 'relabel',
    order: 103,
    description: 'Template prompt for Brian + Tabarak + participant call cleanup.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'chunk_problem_system_template',
    title: 'Chunk pass 1 (problem interview)',
    step: 'chunk_pass1',
    order: 104,
    description: 'Template prompt for chunking problem interviews.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'chunk_demo_system_template',
    title: 'Chunk pass 1 (demo)',
    step: 'chunk_pass1',
    order: 105,
    description: 'Template prompt for chunking product demos.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'interpret_chunks_system_template',
    title: 'Interpret chunks pass 2',
    step: 'chunk_pass2',
    order: 106,
    description: 'Template prompt for hypothesis interpretation.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'grade_system',
    title: 'Grade interview system',
    step: 'grade',
    order: 107,
    description: 'System prompt for markdown grading behavior.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'grade_rubric',
    title: 'Grade interview rubric',
    step: 'grade',
    order: 108,
    description: 'Full rubric text injected before transcript.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'extract_quotes_system',
    title: 'Extract quotes',
    step: 'extract_quotes',
    order: 109,
    description: 'System prompt for quote extraction JSON.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
  {
    key: 'classify_persona_system',
    title: 'Classify persona stage',
    step: 'classify_persona',
    order: 110,
    description: 'System prompt for TOFU/MOFU/BOFU selection.',
    editable: true,
    pipelineId: 'import-pipeline',
    pipelineTitle: 'Import pipeline',
  },
]

const LOCKED_OUTPUT_CONTRACTS = {
  content_os_generate_copy_output_contract: `OUTPUT FORMAT (strict JSON only, no markdown fences):
{
  "body": "full post text with appropriate line breaks"
}`,
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

function maybeLoadRepoEnv() {
  const envPath = path.join(REPO_ROOT, '.env')
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('=')
    if (idx < 1) continue
    const key = t.slice(0, idx).trim()
    const value = t.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!key) continue
    if (!(key in process.env)) process.env[key] = value
  }
}

function getEnv(name) {
  const value = String(process.env[name] ?? '').trim()
  return value || null
}

function getSupabaseClient() {
  if (cachedClient) return cachedClient
  maybeLoadRepoEnv()
  const url = getEnv('SUPABASE_URL') || getEnv('VITE_SUPABASE_URL')
  const key =
    getEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    getEnv('SUPABASE_SERVICE_KEY') ||
    getEnv('VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!url || !key) return null
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cachedClient
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
    content_os_generate_copy_system:
      'You write high-signal social posts. Output valid JSON only matching the schema in the user message.',
    content_os_generate_copy_user_template: `You are an expert social copywriter. Generate exactly ONE strong post for the topic below.

{{OUTPUT_CONTRACT}}

Rules:
- {{TOPIC_INSTRUCTION}}
- {{PERSONA_INSTRUCTION}}
- {{VOICE_INSTRUCTION}}
- {{STYLE_GUIDE_INSTRUCTION}}
- {{WRITING_FRAMEWORK_INSTRUCTION}}
- Avoid generic AI voice: no hollow motivation, no vague claims, no filler transitions.
- Keep LinkedIn-style line breaks in mind unless the topic implies another surface.

Priority if instructions conflict:
1) Topic content
2) Customer persona
3) Writer voice
4) Style guide
5) Writing framework

--- TOPIC (primary) ---
{{TOPIC_TEXT}}

--- CUSTOMER PERSONA (full document) ---
{{CUSTOMER_PERSONA_CONTENT}}

--- WRITER VOICE (full document) ---
{{WRITER_VOICE_CONTENT}}

--- STYLE GUIDE (constraints) ---
{{STYLE_GUIDE_CONTENT}}

--- WRITING FRAMEWORK ---
{{WRITING_FRAMEWORK_BLOCK}}
`,
    content_os_generate_copy_output_contract: LOCKED_OUTPUT_CONTRACTS.content_os_generate_copy_output_contract,
    content_os_final_post_refine_system:
      'You revise social posts. Return only the revised post text. No JSON, no markdown code fences.',
    content_os_image_prompt_template: `Create a visual companion for this post.
Do not simply turn the post into text on an image.
Use the post's core idea, emotion, metaphor, and audience to create a strong supporting visual.
Avoid text-heavy compositions by default; if any text appears, keep it minimal and subordinate to the visual.

--- POST (for meaning only; do not render as typography blocks) ---
{{FINAL_POST}}

--- EXTRA VISUAL CONTEXT FROM USER ---
{{IMAGE_CONTEXT}}

{{REGENERATE_APPEND_BLOCK}}`,
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
  const supabase = getSupabaseClient()
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

const REFERENCE_ALLOWED_PREFIXES = ['data/os/', 'data/skills/', 'data/outliers/data/', 'src/']
const REFERENCE_ALLOWED_EXTENSIONS = ['.md', '.txt', '.json', '.html', '.mjs', '.ts', '.tsx', '.css']

function normalizeReferencePath(referencePath) {
  return String(referencePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.?\//, '')
}

export function readPipelinePromptReference(referencePath) {
  const normalized = normalizeReferencePath(referencePath)
  if (!normalized) throw new Error('Missing reference path.')
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid reference path.')
  }
  if (!REFERENCE_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error('Reference path is outside allowed directories.')
  }
  const ext = path.extname(normalized).toLowerCase()
  if (!REFERENCE_ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Reference file type is not previewable.')
  }

  const absPath = path.resolve(REPO_ROOT, normalized)
  if (!absPath.startsWith(REPO_ROOT) || !fs.existsSync(absPath)) {
    throw new Error('Reference file not found.')
  }

  const raw = fs.readFileSync(absPath, 'utf8')
  const MAX_CHARS = 200_000
  const truncated = raw.length > MAX_CHARS
  return {
    path: normalized,
    text: truncated ? `${raw.slice(0, MAX_CHARS)}\n\n[...truncated for preview...]` : raw,
    truncated,
  }
}

const REFERENCE_WRITE_ALLOWED_PREFIXES = ['data/os/']
const REFERENCE_WRITE_ALLOWED_EXTENSIONS = ['.md']

export function writePipelinePromptReference(referencePath, text) {
  const normalized = normalizeReferencePath(referencePath)
  if (!normalized) throw new Error('Missing reference path.')
  if (normalized.includes('..') || normalized.startsWith('/')) {
    throw new Error('Invalid reference path.')
  }
  if (!REFERENCE_WRITE_ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error('This reference is read-only. Only markdown files under data/os can be edited.')
  }
  const ext = path.extname(normalized).toLowerCase()
  if (!REFERENCE_WRITE_ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error('Only .md references are editable.')
  }

  const absPath = path.resolve(REPO_ROOT, normalized)
  if (!absPath.startsWith(REPO_ROOT) || !fs.existsSync(absPath)) {
    throw new Error('Reference file not found.')
  }

  fs.writeFileSync(absPath, String(text ?? ''), 'utf8')
  return { ok: true, path: normalized }
}

export async function listPipelinePrompts() {
  const defaults = getDefaultPipelinePromptMap()
  const db = await getDbPipelinePromptRows()
  const byKey = new Map(db.rows.map((row) => [String(row.key || ''), row]))
  const prompts = PIPELINE_PROMPT_CATALOG.map((item) => {
    if (!item.editable) {
      return {
        ...item,
        content: [
          item.description,
          item.references?.length
            ? `References:\n${item.references.map((r) => `- ${r}`).join('\n')}`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        source: 'reference',
        updatedAt: null,
      }
    }
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
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase not configured.')
  const catalogRow = PIPELINE_PROMPT_CATALOG.find((x) => x.key === key)
  if (!catalogRow) throw new Error(`Unknown prompt key: ${key}`)
  if (!catalogRow.editable) {
    throw new Error(`Prompt "${catalogRow.title}" is reference-only and cannot be edited.`)
  }
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
