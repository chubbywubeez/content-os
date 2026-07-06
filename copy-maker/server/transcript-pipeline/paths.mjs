import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(SERVER_DIR, '../../..')
const DATA_ROOT = path.join(REPO_ROOT, 'data')

function firstExistingPath(paths, fallback) {
  for (const p of paths) {
    if (fs.existsSync(p)) return p
  }
  return fallback
}

export const PRESENTATIONS_DIR = firstExistingPath(
  [path.join(DATA_ROOT, 'presentations'), path.join(REPO_ROOT, 'Problem Presentations')],
  path.join(DATA_ROOT, 'presentations'),
)
export const SCORES_DIR = path.join(PRESENTATIONS_DIR, 'scores')
export const COPY_MINING_DIR = path.join(PRESENTATIONS_DIR, 'copy_mining')
export const PER_INTERVIEW_DIR = path.join(COPY_MINING_DIR, 'per_interview')
export const CHUNKS_DIR = path.join(COPY_MINING_DIR, 'chunks')
export const CHUNK_INTERPRETATIONS_DIR = path.join(COPY_MINING_DIR, 'chunk_interpretations')
export const PIPELINE_JOBS_DIR = path.join(PRESENTATIONS_DIR, 'pipeline', 'jobs')
export const SKILL_SCORING = firstExistingPath(
  [
    path.join(DATA_ROOT, 'skills', 'Vantum_Scoring_Prompt_v2.md'),
    path.join(REPO_ROOT, 'Skills', 'Vantum_Scoring_Prompt_v2.md'),
  ],
  path.join(DATA_ROOT, 'skills', 'Vantum_Scoring_Prompt_v2.md'),
)
export const SKILL_TRANSCRIPT_TWO = firstExistingPath(
  [
    path.join(DATA_ROOT, 'skills', 'Transcript_Clean_Two_Speaker_Interview_v1.md'),
    path.join(REPO_ROOT, 'Skills', 'Transcript_Clean_Two_Speaker_Interview_v1.md'),
  ],
  path.join(DATA_ROOT, 'skills', 'Transcript_Clean_Two_Speaker_Interview_v1.md'),
)
export const SKILL_TRANSCRIPT_THREE = firstExistingPath(
  [
    path.join(DATA_ROOT, 'skills', 'Transcript_Clean_Three_Speaker_Demo_v1.md'),
    path.join(REPO_ROOT, 'Skills', 'Transcript_Clean_Three_Speaker_Demo_v1.md'),
  ],
  path.join(DATA_ROOT, 'skills', 'Transcript_Clean_Three_Speaker_Demo_v1.md'),
)
export const PROMPT_CHUNK_PROBLEM = path.join(
  DATA_ROOT,
  'skills',
  'Prompt_4_Universal_Chunking_Problem_Pass1.md',
)
export const PROMPT_CHUNK_DEMO = path.join(
  DATA_ROOT,
  'skills',
  'Prompt_5_Universal_Chunking_Demo_Pass1.md',
)
export const PROMPT_HYPOTHESIS_INTERPRETATION = path.join(
  DATA_ROOT,
  'skills',
  'Prompt_6_Hypothesis_Interpretation_Pass2.md',
)
export const PERSONAS_DIR = firstExistingPath(
  [path.join(DATA_ROOT, 'os', 'Customer Personas'), path.join(REPO_ROOT, 'OS', 'Customer Personas')],
  path.join(DATA_ROOT, 'os', 'Customer Personas'),
)
export const BUILD_GRADING = path.join(
  COPY_MINING_DIR,
  'tools',
  'build_all_grading_md.mjs',
)
export const BUILD_QUOTES = path.join(COPY_MINING_DIR, 'tools', 'build_all_quotes_md.mjs')

export const PERSONA_FILES = {
  tofu: 'vantum-persona-tofu.md',
  mofu: 'vantum-persona-mofu.md',
  bofu: 'vantum-persona-bofu.md',
}

export function ensureDirs() {
  for (const d of [
    PIPELINE_JOBS_DIR,
    SCORES_DIR,
    PER_INTERVIEW_DIR,
    CHUNKS_DIR,
    CHUNK_INTERPRETATIONS_DIR,
    PRESENTATIONS_DIR,
  ]) {
    fs.mkdirSync(d, { recursive: true })
  }
}

export function jobDir(jobId) {
  return path.join(PIPELINE_JOBS_DIR, jobId)
}
