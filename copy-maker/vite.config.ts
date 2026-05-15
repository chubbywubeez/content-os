import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyMakerDataPlugin } from './vite-plugin-copy-maker-data'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Resolve Gemini Developer API key for the **dev proxy only** (never bundled into the client).
 * Merges repo-root `.env` so keys work when the user keeps one file next to `linkedin_influencers/`.
 */
function geminiKeyForDevProxy(mode: string): string {
  const pkgEnv = loadEnv(mode, __dirname, '')
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const pick = (e: Record<string, string>) =>
    String(
      e.VITE_GEMINI_API_KEY ||
        e.VITE_GOOGLE_AI_API_KEY ||
        e.VITE_NANO_BANANA_API_KEY ||
        e.GEMINI_API_KEY ||
        e.GOOGLE_AI_API_KEY ||
        '',
    ).trim()
  // Later keys win so `copy-maker/.env.local` overrides repo-root `.env`.
  return pick({ ...rootEnv, ...pkgEnv })
}

function anthropicKeyForDevProxy(mode: string): string {
  const pkgEnv = loadEnv(mode, __dirname, '')
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const pick = (e: Record<string, string>) => String(e.VITE_ANTHROPIC_API_KEY || e.ANTHROPIC_API_KEY || '').trim()
  return pick({ ...rootEnv, ...pkgEnv })
}

function openaiKeyForDevProxy(mode: string): string {
  const pkgEnv = loadEnv(mode, __dirname, '')
  const rootEnv = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const pick = (e: Record<string, string>) => String(e.VITE_OPENAI_API_KEY || e.OPENAI_API_KEY || '').trim()
  return pick({ ...rootEnv, ...pkgEnv })
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const geminiKey = geminiKeyForDevProxy(mode)
  const anthropicKey = anthropicKeyForDevProxy(mode)
  const openaiKey = openaiKeyForDevProxy(mode)

  return {
    plugins: [react(), copyMakerDataPlugin()],
    /**
     * Gemini Developer API: browser CORS is awkward with API keys, so in dev we proxy `/api/gemini/*`
     * and inject `x-goog-api-key` from `.env` (see `geminiKeyForDevProxy`).
     */
    server: {
      // Run dev server at http://localhost:5000 (override with `npm run dev -- --port 5173` if needed).
      port: 5000,
      proxy: {
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (geminiKey) proxyReq.setHeader('x-goog-api-key', geminiKey)
            })
          },
        },
        '/api/anthropic': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (anthropicKey) proxyReq.setHeader('x-api-key', anthropicKey)
            })
          },
        },
        '/api/openai': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/openai/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (openaiKey) proxyReq.setHeader('Authorization', `Bearer ${openaiKey}`)
            })
          },
        },
      },
    },
  }
})
