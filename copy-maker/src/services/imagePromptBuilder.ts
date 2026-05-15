export type BuildImagePromptParams = {
  finalPost: string
  imageContext: string
  /**
   * One-off instructions for a regeneration run (UI: optional box next to Regenerate).
   * Appended after the main brief so the model can pivot without changing saved `imageContext`.
   */
  regenerateAppend?: string
}

/**
 * Builds the Nano Banana image prompt from the final post plus optional user context.
 * Keeps text off the canvas by explicit instruction (product requirement).
 *
 * Note: `nanoBananaService.ts` also prepends a short LinkedIn-style wrapper around this string.
 * Edit both files if you want a stronger overall image brief.
 */
export function buildImagePrompt(params: BuildImagePromptParams): string {
  const { finalPost, imageContext, regenerateAppend } = params
  const extra = regenerateAppend?.trim()

  const lines = [
    'Create a visual companion for this post.',
    'Do not simply turn the post into text on an image.',
    'Use the post’s core idea, emotion, metaphor, and audience to create a strong supporting visual.',
    'Avoid text-heavy compositions by default; if any text appears, keep it minimal and subordinate to the visual.',
    '',
    '--- POST (for meaning only; do not render as typography blocks) ---',
    finalPost.trim() || '(empty post)',
    '',
    '--- EXTRA VISUAL CONTEXT FROM USER ---',
    imageContext.trim() || '(none)',
  ]

  if (extra) {
    lines.push(
      '',
      '--- ONE-OFF INSTRUCTIONS FOR THIS REGENERATION (highest priority) ---',
      extra,
    )
  }

  return lines.join('\n')
}
