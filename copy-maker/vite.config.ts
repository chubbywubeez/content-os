import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyMakerDataPlugin } from './vite-plugin-copy-maker-data'
import { openRouterProxyPlugin } from './vite-plugin-openrouter-proxy'
import { geminiProxyPlugin } from './vite-plugin-gemini-proxy'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), openRouterProxyPlugin(), geminiProxyPlugin(), copyMakerDataPlugin()],
  /**
   * No API keys in the browser bundle: OpenRouter + Gemini go through same-origin `/api/*` middleware
   * (see `vite-plugin-openrouter-proxy.ts` and `vite-plugin-gemini-proxy.ts`).
   */
  server: {
    port: 5000,
  },
  preview: {
    allowedHosts: true,
  },
})
