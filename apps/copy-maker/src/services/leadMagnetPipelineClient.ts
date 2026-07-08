import type {
  LeadMagnetArtifactsResponse,
  LeadMagnetResourceEntry,
  LeadMagnetStepEvent,
} from '../types/leadMagnetPipeline'

function networkHint(pathname: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'current-origin'
  return `Network error reaching ${pathname} on ${origin}. Ensure you are running apps/copy-maker (npm run dev) or Railway preview with API middleware enabled.`
}

function parseSseChunk(buffer: string, onEvent: (ev: LeadMagnetStepEvent) => void) {
  const blocks = buffer.split('\n\n')
  for (const block of blocks) {
    const dataLine = block.split('\n').find((l) => l.startsWith('data: '))
    if (!dataLine) continue
    try {
      const data = JSON.parse(dataLine.slice(6)) as LeadMagnetStepEvent
      if (data.step) onEvent(data)
    } catch {
      // Ignore partial event frames.
    }
  }
}

export async function runLeadMagnetPipeline(
  payload: { slug: string; briefMarkdown: string },
  onEvent: (ev: LeadMagnetStepEvent) => void,
): Promise<void> {
  let res: Response
  try {
    res = await fetch('/api/lead-magnet-pipeline/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    throw new Error(e instanceof Error ? `${e.message}. ${networkHint('/api/lead-magnet-pipeline/run')}` : networkHint('/api/lead-magnet-pipeline/run'))
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Lead magnet pipeline failed (${res.status})`)
  }
  if (!res.body) throw new Error('No response stream from lead magnet pipeline.')

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

export async function fetchLeadMagnetArtifacts(slug: string): Promise<LeadMagnetArtifactsResponse> {
  let res: Response
  try {
    res = await fetch(`/api/lead-magnet-pipeline/artifacts?slug=${encodeURIComponent(slug)}`)
  } catch (e) {
    throw new Error(e instanceof Error ? `${e.message}. ${networkHint('/api/lead-magnet-pipeline/artifacts')}` : networkHint('/api/lead-magnet-pipeline/artifacts'))
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Lead magnet artifacts failed (${res.status})`)
  }
  return res.json() as Promise<LeadMagnetArtifactsResponse>
}

export async function fetchLeadMagnetResourceEntries(): Promise<LeadMagnetResourceEntry[]> {
  let res: Response
  try {
    res = await fetch('/api/lead-magnet-pipeline/resources')
  } catch {
    return []
  }
  if (!res.ok) return []
  const json = (await res.json().catch(() => ({}))) as { entries?: LeadMagnetResourceEntry[] }
  return Array.isArray(json.entries) ? json.entries : []
}
