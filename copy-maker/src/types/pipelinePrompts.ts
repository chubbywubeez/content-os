export type PipelinePromptRecord = {
  key: string
  title: string
  step: string
  order: number
  description: string
  content: string
  source: 'default' | 'database'
  updatedAt: string | null
}

export type PipelinePromptsResponse = {
  prompts: PipelinePromptRecord[]
  databaseEnabled: boolean
  warning: string | null
}
