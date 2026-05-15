/**
 * Copy generation uses Gemini only: try the newest Pro first, then a 2.5 model if the first
 * request fails (HTTP error, empty text, or parse failure is handled by the caller).
 *
 * Override with `VITE_GEMINI_COPY_MODEL_PRIMARY` / `VITE_GEMINI_COPY_MODEL_FALLBACK` if Google renames ids.
 */
export const DEFAULT_GEMINI_COPY_PRIMARY = 'gemini-3-pro-preview'
export const DEFAULT_GEMINI_COPY_FALLBACK = 'gemini-2.5-flash'

export function geminiCopyModelChain(): string[] {
  const primary =
    String(import.meta.env.VITE_GEMINI_COPY_MODEL_PRIMARY ?? '').trim() || DEFAULT_GEMINI_COPY_PRIMARY
  const fallback =
    String(import.meta.env.VITE_GEMINI_COPY_MODEL_FALLBACK ?? '').trim() || DEFAULT_GEMINI_COPY_FALLBACK
  return primary === fallback ? [primary] : [primary, fallback]
}
