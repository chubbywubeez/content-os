/// <reference types="vite/client" />

/**
 * Vite injects env at build time. We only declare keys the app reads.
 * Use `copy-maker/.env.local` for secrets. For production, Gemini keys must use the `VITE_` prefix.
 */
interface ImportMetaEnv {
  /** Google AI Studio / Gemini Developer API key (copy + Nano Banana images). */
  readonly VITE_GEMINI_API_KEY?: string
  /** Alias for `VITE_GEMINI_API_KEY`. */
  readonly VITE_GOOGLE_AI_API_KEY?: string
  /** Alias for `VITE_GEMINI_API_KEY` (legacy name). */
  readonly VITE_NANO_BANANA_API_KEY?: string
  /** Optional. Default `gemini-3-pro-preview`, then `gemini-2.5-flash` if the first call fails. */
  readonly VITE_GEMINI_COPY_MODEL_PRIMARY?: string
  readonly VITE_GEMINI_COPY_MODEL_FALLBACK?: string
  /** Optional. Default `gemini-2.5-flash-image` (Nano Banana). */
  readonly VITE_NANO_BANANA_MODEL?: string
  /** Anthropic (Opus copy in dev via proxy). Prefer `ANTHROPIC_API_KEY` in repo-root `.env`. */
  readonly VITE_ANTHROPIC_API_KEY?: string
  /** OpenAI (GPT copy in dev via proxy). Prefer `OPENAI_API_KEY` in repo-root `.env`. */
  readonly VITE_OPENAI_API_KEY?: string
  /**
   * OpenRouter (recommended for Opus + GPT copy in production: one key, OpenAI-compatible API).
   * Local dev: `OPENROUTER_API_KEY` in repo-root `.env` is enough (Vite proxy injects Bearer).
   */
  readonly VITE_OPENROUTER_API_KEY?: string
  /** Optional. OpenRouter model slug for the Opus copy dropdown. Default `anthropic/claude-opus-4.7`. */
  readonly VITE_OPENROUTER_MODEL_OPUS?: string
  /** Optional. OpenRouter model slug for the GPT copy dropdown. Default `openai/gpt-5.2`. */
  readonly VITE_OPENROUTER_MODEL_OPENAI?: string
  /** Optional. Sent as `HTTP-Referer` to OpenRouter (their docs recommend setting it). */
  readonly VITE_OPENROUTER_HTTP_REFERER?: string
  /** Optional. Sent as `X-Title` to OpenRouter. */
  readonly VITE_OPENROUTER_APP_TITLE?: string
  /** Override default `claude-opus-4-7` for the Copy dropdown Opus option. */
  readonly VITE_ANTHROPIC_COPY_MODEL?: string
  /** Override default `gpt-5.2` for the Copy dropdown OpenAI option (use the slug your key can call). */
  readonly VITE_OPENAI_COPY_MODEL?: string
  /** Optional override for Gemini REST base (no trailing slash). Prod CORS may require your own proxy. */
  readonly VITE_GEMINI_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
