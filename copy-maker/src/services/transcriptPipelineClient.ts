import type { PipelineStepEvent } from '../types/transcriptPipeline'

function parseSseChunk(buffer: string, onEvent: (ev: PipelineStepEvent) => void) {
  const blocks = buffer.split('\n\n')
  for (const block of blocks) {
    const dataLine = block.split('\n').find((l) => l.startsWith('data: '))
    if (!dataLine) continue
    try {
      const data = JSON.parse(dataLine.slice(6)) as PipelineStepEvent
      if (data.step) onEvent(data)
    } catch {
      /* ignore partial JSON */
    }
  }
}

/**
 * Upload a call transcript and stream pipeline step events (for confirmation modals).
 */
export async function runTranscriptPipelineUpload(
  file: File,
  onEvent: (ev: PipelineStepEvent) => void,
): Promise<void> {
  const text = await file.text()

  const res = await fetch('/api/transcript-pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, filename: file.name }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(err || `HTTP ${res.status}`)
  }

  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''
    for (const part of parts) parseSseChunk(part + '\n\n', onEvent)
  }
  if (buffer.trim()) parseSseChunk(buffer, onEvent)
}
