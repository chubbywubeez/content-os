import { buildImagePrompt } from './imagePromptBuilder'
import { geminiGenerateContent } from './geminiClient'
import { geminiImageModelForChoice, type ImageModelId } from '../config/modelProviders'
import { fetchPipelinePromptMap } from './pipelinePromptsClient'

/** Payload shape aligned with the user's Nano Banana integration notes. */
export type NanoBananaPayload = {
  prompt: string
  referenceImages: Array<{ base64: string; mimeType: string }>
  aspectRatio: '1:1' | '16:9' | '9:16'
  outputCount: number
}

export type NanoBananaArgs = {
  finalPost: string
  imageContext: string
  /** Optional extra lines merged into the prompt (regeneration UI only). */
  regenerateAppend?: string
  /** Full state items include previewUrl; API only needs base64 + mime. */
  referenceImages: Array<{ base64: string; mimeType: string }>
  aspectRatio?: NanoBananaPayload['aspectRatio']
  outputCount?: number
  /** When set, picks the Gemini image tier from the header. */
  imageModelChoice?: ImageModelId
}

/** Default Gemini image model when the header does not override. */
const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'

function imageModelId(): string {
  return DEFAULT_IMAGE_MODEL
}

/** Map our aspect hint into plain-language for the model (API-specific fields vary). */
function aspectHint(ratio: NanoBananaPayload['aspectRatio']): string {
  if (ratio === '16:9') return 'Use a wide 16:9 composition.'
  if (ratio === '9:16') return 'Use a tall vertical 9:16 composition.'
  return 'Use a square 1:1 composition.'
}

type InlineImagePart = {
  inlineData?: { mimeType?: string; data?: string }
  inline_data?: { mime_type?: string; data?: string }
}

function firstImageDataUrlFromParts(parts: unknown): string | null {
  if (!Array.isArray(parts)) return null
  for (const raw of parts) {
    const p = raw as InlineImagePart
    const id = p.inlineData ?? p.inline_data
    if (!id?.data || typeof id.data !== 'string') continue
    const mime =
      (typeof p.inlineData?.mimeType === 'string' && p.inlineData.mimeType) ||
      (typeof p.inline_data?.mime_type === 'string' && p.inline_data.mime_type) ||
      'image/png'
    return `data:${mime};base64,${id.data}`
  }
  return null
}

/**
 * Calls Google Gemini image generation ("Nano Banana") via `/api/gemini` (server `GEMINI_API_KEY`).
 */
export async function generateNanoBananaImage(args: NanoBananaArgs): Promise<string> {
  let imageTemplate = ''
  try {
    const map = await fetchPipelinePromptMap()
    imageTemplate = map.content_os_image_prompt_template || ''
  } catch {
    // Keep default image prompt builder behavior.
  }

  const prompt = buildImagePrompt({
    finalPost: args.finalPost,
    imageContext: args.imageContext,
    regenerateAppend: args.regenerateAppend,
    template: imageTemplate || undefined,
  })

  const payload: NanoBananaPayload = {
    prompt,
    referenceImages: args.referenceImages.map((r) => ({
      base64: r.base64,
      mimeType: r.mimeType,
    })),
    aspectRatio: args.aspectRatio ?? '1:1',
    outputCount: args.outputCount ?? 1,
  }

  const model =
    args.imageModelChoice != null ? geminiImageModelForChoice(args.imageModelChoice) : imageModelId()

  // Build multimodal parts: reference images first, then the generation brief.
  // Google's REST examples use snake_case (`inline_data`, `mime_type`) for multimodal parts.
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = []
  for (const img of payload.referenceImages) {
    parts.push({
      inline_data: { mime_type: img.mimeType, data: img.base64 },
    })
  }
  const fullText = [
    'Generate a single polished image for a LinkedIn-style post visual.',
    aspectHint(payload.aspectRatio),
    payload.outputCount > 1
      ? `If you must choose, still return one primary image (outputCount requested: ${payload.outputCount}).`
      : '',
    '',
    payload.prompt,
  ]
    .filter(Boolean)
    .join('\n')
  parts.push({ text: fullText })

  const body = {
    contents: [{ parts }],
    generationConfig: {
      // Gemini image models require both modalities in the config.
      responseModalities: ['TEXT', 'IMAGE'],
    },
  }

  const res = await geminiGenerateContent(model, body)
  const json: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const errObj = json as { error?: { message?: string; status?: string } } | null
    const msg =
      errObj?.error?.message ||
      (typeof json === 'object' &&
      json &&
      'message' in json &&
      typeof (json as { message: unknown }).message === 'string'
        ? (json as { message: string }).message
        : null) ||
      res.statusText
    throw new Error(`Gemini image API (${res.status}): ${msg}`)
  }

  const root = json as {
    candidates?: Array<{ content?: { parts?: unknown } }>
    promptFeedback?: { blockReason?: string }
  }

  if (root.promptFeedback?.blockReason) {
    throw new Error(`Prompt blocked: ${root.promptFeedback.blockReason}`)
  }

  const partsOut = root.candidates?.[0]?.content?.parts
  const dataUrl = firstImageDataUrlFromParts(partsOut)
  if (!dataUrl) {
    throw new Error(
      'No image returned. Confirm GEMINI_API_KEY on the server and that the account can call the selected image model.',
    )
  }

  return dataUrl
}
