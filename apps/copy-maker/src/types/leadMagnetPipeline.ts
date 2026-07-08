export type LeadMagnetStepStatus = 'running' | 'done' | 'error'

export type LeadMagnetStepEvent = {
  step: string
  status: LeadMagnetStepStatus
  title: string
  message: string
  detail?: Record<string, unknown>
}

export type LeadMagnetArtifactFile = {
  name: string
  path: string
  size: number
  contentType: string
}

export type LeadMagnetArtifactsResponse = {
  slug: string
  files: LeadMagnetArtifactFile[]
}

export const LEAD_MAGNET_STEP_ORDER = [
  'parse_input',
  'plan',
  'write',
  'voice_audit',
  'visualize',
  'assemble_html',
  'stage_render',
  'multi_audit',
  'auto_fix',
  'final_render',
] as const

export type LeadMagnetResourceEntry = {
  id: string
  slug: string
  title: string
  description: string
  htmlPath: string
  mdPath: string
  jsonPath: string
  pdfPath: string
}
