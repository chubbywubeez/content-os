export type PipelineStepStatus = 'running' | 'done' | 'error'

export type PipelineStepEvent = {
  step: string
  status: PipelineStepStatus
  title: string
  message: string
  detail?: Record<string, unknown>
}

export const PIPELINE_STEP_ORDER = [
  'upload',
  'clean',
  'classify_call',
  'relabel',
  'speakers',
  'chunk_pass1',
  'chunk_pass2',
  'save_transcript',
  'grade',
  'grading_sheet',
  'extract_quotes',
  'quote_docs',
  'classify_persona',
  'update_persona',
  'sync_resources',
  'linkedin_enrich',
  'complete',
] as const
