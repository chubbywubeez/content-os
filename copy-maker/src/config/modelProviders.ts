/**
 * Header dropdown ids for copy + image providers.
 * Image choices map to Gemini image model ids (Google’s “Nano Banana” image family).
 */

export type CopyModelId = 'opus-4-7' | 'openai-5-5' | 'gemini'

export type ImageModelId = 'nano-banana-pro-3' | 'nano-banana-2-5'

export const COPY_MODEL_OPTIONS: { value: CopyModelId; label: string }[] = [
  {
    value: 'opus-4-7',
    label: 'Claude Opus 4.7 (OpenRouter or Anthropic)',
  },
  {
    value: 'openai-5-5',
    label: 'OpenAI GPT (OpenRouter or OpenAI)',
  },
  {
    value: 'gemini',
    label: 'Google Gemini (Pro → Flash)',
  },
]

export const IMAGE_MODEL_OPTIONS: { value: ImageModelId; label: string }[] = [
  {
    value: 'nano-banana-pro-3',
    label: 'Nano Banana Pro 3 — Gemini 3 Pro Image',
  },
  {
    value: 'nano-banana-2-5',
    label: 'Nano Banana 2.5 — Gemini 2.5 Flash Image',
  },
]

/** Gemini REST model id for image generation (see Google AI docs). */
export function geminiImageModelForChoice(id: ImageModelId): string {
  if (id === 'nano-banana-pro-3') return 'gemini-3-pro-image-preview'
  return 'gemini-2.5-flash-image'
}

/** Anthropic Messages API model id for Opus 4.7 (override via env if Anthropic renames). */
export function anthropicCopyModelId(): string {
  return String(import.meta.env.VITE_ANTHROPIC_COPY_MODEL ?? '').trim() || 'claude-opus-4-7'
}

/** OpenAI Chat Completions model for the “OpenAI 5.5” option (set to your account’s slug). */
export function openaiCopyModelId(): string {
  return String(import.meta.env.VITE_OPENAI_COPY_MODEL ?? '').trim() || 'gpt-5.2'
}

/** OpenRouter slug for the Opus copy dropdown. Default matches OpenRouter’s id for Claude Opus 4.7. */
export function openRouterCopyModelForOpus(): string {
  return String(import.meta.env.VITE_OPENROUTER_MODEL_OPUS ?? '').trim() || 'anthropic/claude-opus-4.7'
}

/** OpenRouter slug for the GPT copy dropdown (override if your OpenRouter account uses a different id). */
export function openRouterCopyModelForOpenAiOption(): string {
  return String(import.meta.env.VITE_OPENROUTER_MODEL_OPENAI ?? '').trim() || 'openai/gpt-5.2'
}
