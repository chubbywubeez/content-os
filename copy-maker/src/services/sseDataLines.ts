/**
 * Reads a text/event-stream body where each logical line starting with `data: ` is JSON.
 * Used by Gemini (`?alt=sse`) and similar providers; callers interpret each JSON object.
 */
export async function consumeSseDataJsonLines(
  response: Response,
  onDataObject: (obj: unknown) => void,
): Promise<void> {
  if (!response.body) throw new Error('SSE response has no body')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let carry = ''

  const flushLine = (rawLine: string) => {
    const line = rawLine.replace(/\r$/, '').trim()
    if (!line || line.startsWith(':')) return
    if (!line.startsWith('data:')) return
    const data = line.slice(5).trim()
    if (data === '[DONE]') return
    try {
      onDataObject(JSON.parse(data))
    } catch {
      /* ignore bad line */
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    carry += decoder.decode(value, { stream: true })
    let nl: number
    while ((nl = carry.indexOf('\n')) !== -1) {
      const line = carry.slice(0, nl)
      carry = carry.slice(nl + 1)
      flushLine(line)
    }
  }
  const tail = carry.replace(/\r$/, '').trim()
  if (tail) {
    for (const line of tail.split('\n')) flushLine(line)
  }
}
