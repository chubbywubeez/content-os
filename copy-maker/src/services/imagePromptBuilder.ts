/**
 * Builds the Nano Banana image prompt from the final post plus optional user context.
 * Keeps text off the canvas by explicit instruction (product requirement).
 */
export function buildImagePrompt(params: { finalPost: string; imageContext: string }): string {
  const { finalPost, imageContext } = params

  return [
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
  ].join('\n')
}
