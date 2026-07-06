/// <reference types="vite/client" />

/**
 * Secret API keys are not read from `import.meta.env`. Use server env vars instead:
 * - `OPENROUTER_API_KEY` — copy (all header models go through OpenRouter).
 * - `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` — Nano Banana images via `/api/gemini`.
 *
 * Supabase publishable values are intentionally exposed to the client:
 * - `VITE_SUPABASE_URL`
 * - `VITE_SUPABASE_PUBLISHABLE_KEY`
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
