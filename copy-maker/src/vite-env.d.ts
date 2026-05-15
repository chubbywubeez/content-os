/// <reference types="vite/client" />

/**
 * API keys are not read from `import.meta.env`. Use server env vars instead:
 * - `OPENROUTER_API_KEY` — copy (all header models go through OpenRouter).
 * - `GEMINI_API_KEY` or `GOOGLE_AI_API_KEY` — Nano Banana images via `/api/gemini`.
 */
interface ImportMetaEnv {
  // Intentionally empty: no bundled secrets.
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
