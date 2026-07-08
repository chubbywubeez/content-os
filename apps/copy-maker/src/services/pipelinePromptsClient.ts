import type { PipelinePromptsResponse } from '../types/pipelinePrompts'

let promptMapCache: Record<string, string> | null = null

export async function fetchPipelinePrompts(): Promise<PipelinePromptsResponse> {
  const res = await fetch('/api/pipeline-prompts')
  if (!res.ok) throw new Error(`Prompt list failed (${res.status})`)
  return res.json() as Promise<PipelinePromptsResponse>
}

export async function fetchPipelinePromptMap(): Promise<Record<string, string>> {
  if (promptMapCache) return promptMapCache
  const res = await fetch('/api/pipeline-prompts-runtime')
  if (!res.ok) throw new Error(`Runtime prompt map failed (${res.status})`)
  const data = (await res.json()) as { prompts?: Record<string, string> }
  promptMapCache = data.prompts ?? {}
  return promptMapCache
}

export function clearPipelinePromptMapCache() {
  promptMapCache = null
}

export async function savePipelinePrompt(key: string, content: string): Promise<string> {
  const res = await fetch(`/api/pipeline-prompts/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = ''
    try {
      const json = JSON.parse(text) as { error?: string }
      message = typeof json.error === 'string' ? json.error : ''
    } catch {
      // Ignore parse errors and fall back to raw text.
    }
    throw new Error(message || text || `Prompt save failed (${res.status})`)
  }
  const json = (await res.json().catch(() => ({}))) as { content?: string }
  clearPipelinePromptMapCache()
  return typeof json.content === 'string' ? json.content : content
}

export async function fetchPipelinePromptReference(path: string): Promise<{
  path: string
  text: string
  truncated: boolean
}> {
  const res = await fetch(`/api/pipeline-prompts/reference?path=${encodeURIComponent(path)}`)
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Reference preview failed (${res.status})`)
  }
  return res.json() as Promise<{ path: string; text: string; truncated: boolean }>
}

export async function savePipelinePromptReference(path: string, text: string): Promise<void> {
  const res = await fetch(`/api/pipeline-prompts/reference?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => '')
    let message = ''
    try {
      const json = JSON.parse(raw) as { error?: string }
      message = typeof json.error === 'string' ? json.error : ''
    } catch {
      // Ignore parse errors and use raw fallback.
    }
    throw new Error(message || raw || `Reference save failed (${res.status})`)
  }
}
