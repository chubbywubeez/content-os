export type PipelinePromptRecord = {
  key: string
  title: string
  step: string
  order: number
  pipelineId: string
  pipelineTitle: string
  description: string
  content: string
  editable: boolean
  references?: string[]
  source: 'default' | 'database' | 'reference'
  updatedAt: string | null
}

export type PipelinePromptsResponse = {
  prompts: PipelinePromptRecord[]
  databaseEnabled: boolean
  warning: string | null
}
