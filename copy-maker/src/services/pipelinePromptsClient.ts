import type { PipelinePromptsResponse } from '../types/pipelinePrompts'

export async function fetchPipelinePrompts(): Promise<PipelinePromptsResponse> {
  const res = await fetch('/api/pipeline-prompts')
  if (!res.ok) throw new Error(`Prompt list failed (${res.status})`)
  return res.json() as Promise<PipelinePromptsResponse>
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
  return typeof json.content === 'string' ? json.content : content
}
