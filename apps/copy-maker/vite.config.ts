import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { copyMakerDataPlugin } from './vite-plugin-copy-maker-data'
import { openRouterProxyPlugin } from './vite-plugin-openrouter-proxy'
import { geminiProxyPlugin } from './vite-plugin-gemini-proxy'
import { transcriptPipelinePlugin } from './vite-plugin-transcript-pipeline'
import { interviewsDataPlugin } from './vite-plugin-interviews-data'
import { leadMagnetPipelinePlugin } from './vite-plugin-lead-magnet-pipeline'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const appDir = process.cwd()
  const repoRoot = path.resolve(appDir, '../..')
  const envFromAppDir = loadEnv(mode, appDir, '')
  const envFromRepoRoot = loadEnv(mode, repoRoot, '')
  Object.assign(process.env, envFromAppDir, envFromRepoRoot)

  return {
    plugins: [
      react(),
      openRouterProxyPlugin(),
      geminiProxyPlugin(),
      copyMakerDataPlugin(),
      transcriptPipelinePlugin(),
      interviewsDataPlugin(),
      leadMagnetPipelinePlugin(),
    ],
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
  }
})
