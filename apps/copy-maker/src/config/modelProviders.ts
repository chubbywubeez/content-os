/**
 * Header dropdown ids for copy + image providers.
 * All **copy** models are requested through OpenRouter (one `OPENROUTER_API_KEY` on the server).
 * **Images** use Google Gemini (“Nano Banana”) via the `/api/gemini` proxy and `GEMINI_API_KEY`.
 */

export type CopyModelId = 'opus-4-8' | 'opus-4-7' | 'openai-5-5' | 'gemini' | 'glm-5-2' | 'mimo-v2-5-pro'

export type ImageModelId = 'nano-banana-pro-3' | 'nano-banana-2-5'

export const COPY_MODEL_OPTIONS: { value: CopyModelId; label: string }[] = [
  { value: 'opus-4-8', label: 'Claude Opus 4.8 (OpenRouter)' },
  { value: 'opus-4-7', label: 'Claude Opus 4.7 (OpenRouter)' },
  { value: 'openai-5-5', label: 'OpenAI GPT (OpenRouter)' },
  { value: 'gemini', label: 'Google Gemini (OpenRouter)' },
  { value: 'glm-5-2', label: 'Z.ai GLM 5.2 (OpenRouter)' },
  { value: 'mimo-v2-5-pro', label: 'Xiaomi MiMo-V2.5-Pro (OpenRouter)' },
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

/** Gemini REST model id for image generation (see Google AI docs). Proxied at `/api/gemini`. */
export function geminiImageModelForChoice(id: ImageModelId): string {
  if (id === 'nano-banana-pro-3') return 'gemini-3-pro-image-preview'
  return 'gemini-2.5-flash-image'
}

/** OpenRouter slug for the Opus copy option. */
export function openRouterCopyModelForOpus(): string {
  return 'anthropic/claude-opus-4.7'
}

/** OpenRouter slug for the Opus 4.8 copy option. */
export function openRouterCopyModelForOpus48(): string {
  return 'anthropic/claude-opus-4.8'
}

/** OpenRouter slug for the GPT copy option. */
export function openRouterCopyModelForOpenAiOption(): string {
  return 'openai/gpt-5.2'
}

/** OpenRouter slug for the “Gemini” copy option (chat completions, not native Gemini REST). */
export function openRouterCopyModelForGemini(): string {
  return 'google/gemini-2.5-flash'
}

/** OpenRouter slug for the GLM 5.2 copy option. */
export function openRouterCopyModelForGlm(): string {
  return 'z-ai/glm-5.2'
}

/** OpenRouter slug for the Xiaomi MiMo Pro copy option. */
export function openRouterCopyModelForMimoPro(): string {
  return 'xiaomi/mimo-v2.5-pro'
}
