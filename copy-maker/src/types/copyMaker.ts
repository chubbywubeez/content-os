/** Uploaded reference image stored in React state (includes preview for UI). */
export type ReferenceImageItem = {
  base64: string
  mimeType: string
  name: string
  previewUrl: string
}

export type SectionStatus = 'empty' | 'draft' | 'complete'

export type WriterVoiceId = 'vantum' | 'tabarak' | 'brian'
export type CustomerPersonaId = 'tofu' | 'mofu' | 'bofu'

export type CopyMakerInputs = {
  /** Markdown / plain text (auto-loaded from OS `vantum_style_guide.md`, else HTML strip; editable). */
  styleGuide: string
  writerVoiceId: WriterVoiceId | ''
  writerVoiceContent: string
  customerPersonaId: CustomerPersonaId | ''
  customerPersonaContent: string
  topic: {
    description: string
  }
  /** `framework` = cached architecture markdown; `copy_examples` = use full post as pattern reference. */
  writingFrameworkKind: 'framework' | 'copy_examples' | 'custom'
  writingFrameworkUrn: string
  writingFrameworkFrameworkMd: string
  writingFrameworkPostText: string
  writingFrameworkCustom: string
}

import type { CopyModelId, ImageModelId } from '../config/modelProviders'

export type CopyMakerState = CopyMakerInputs & {
  /** Header: which API generates LinkedIn copy (Opus / OpenAI / Gemini). */
  copyModelId: CopyModelId
  /** Header: Gemini image model tier for Nano Banana. */
  imageModelId: ImageModelId
  /** Each full post from "Generate Copy" / "Regenerate"; only one shown at `copyGenerationIndex`. */
  copyGenerations: string[]
  /** Index into `copyGenerations` for the post currently on screen. */
  copyGenerationIndex: number
  selectedPost: string
  hasChosenFinalPost: boolean
  finalPostSaved: boolean
  imageContext: string
  referenceImages: ReferenceImageItem[]
  generatedImageUrl: string
  /** Last image-generation failure (API / network); cleared on retry success. */
  imageGenError: string
}

export const SECTION_ORDER = [
  'writerVoice',
  'styleGuide',
  'customerPersona',
  'topic',
  'writingFramework',
  'generateCopy',
  'finalPost',
  'imageGen',
] as const

export type WorkflowSectionId = (typeof SECTION_ORDER)[number]
