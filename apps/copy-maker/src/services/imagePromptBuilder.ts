export type BuildImagePromptParams = {
  finalPost: string
  imageContext: string
  /**
   * One-off instructions for a regeneration run (UI: optional box next to Regenerate).
   * Appended after the main brief so the model can pivot without changing saved `imageContext`.
   */
  regenerateAppend?: string
  template?: string
}

/**
 * Builds the Nano Banana image prompt from the final post plus optional user context.
 * Keeps text off the canvas by explicit instruction (product requirement).
 *
 * Note: `nanoBananaService.ts` also prepends a short LinkedIn-style wrapper around this string.
 * Edit both files if you want a stronger overall image brief.
 */
export function buildImagePrompt(params: BuildImagePromptParams): string {
  const { finalPost, imageContext, regenerateAppend, template } = params
  const extra = regenerateAppend?.trim()

  if (template?.trim()) {
    return template
      .replace('{{FINAL_POST}}', finalPost.trim() || '(empty post)')
      .replace('{{IMAGE_CONTEXT}}', imageContext.trim() || '(none)')
      .replace(
        '{{REGENERATE_APPEND_BLOCK}}',
        extra
          ? `--- ONE-OFF INSTRUCTIONS FOR THIS REGENERATION (highest priority) ---\n${extra}`
          : '',
      )
      .trim()
  }

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
