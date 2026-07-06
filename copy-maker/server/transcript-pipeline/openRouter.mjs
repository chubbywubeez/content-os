/**
 * Server-side OpenRouter (same env key as vite proxy). Used by transcript pipeline only.
 */
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'

export function getOpenRouterConfig() {
  const apiKey = String(process.env.OPENROUTER_API_KEY ?? '').trim()
  const model = String(process.env.OPENROUTER_MODEL ?? 'anthropic/claude-sonnet-4.6').trim()
  // #region agent log
  fetch('http://127.0.0.1:7678/ingest/3f1696be-2378-40bd-9460-3f07727eecbb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cfd468'},body:JSON.stringify({sessionId:'cfd468',runId:'initial',hypothesisId:'H1-H5',location:'server/transcript-pipeline/openRouter.mjs:getOpenRouterConfig',message:'Read OpenRouter env from process',data:{cwd:process.cwd(),hasOpenRouterKey:Boolean(apiKey),openRouterKeyLength:apiKey.length,hasModel:Boolean(model),model},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  if (!apiKey) return null
  return { apiKey, model }
}

/**
 * @param {{ system: string, user: string, temperature?: number, max_tokens?: number, timeoutMs?: number }} opts
 */
export async function openRouterChat(opts) {
  const cfg = getOpenRouterConfig()
  if (!cfg) {
    // #region agent log
    fetch('http://127.0.0.1:7678/ingest/3f1696be-2378-40bd-9460-3f07727eecbb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'cfd468'},body:JSON.stringify({sessionId:'cfd468',runId:'initial',hypothesisId:'H1-H5',location:'server/transcript-pipeline/openRouter.mjs:openRouterChat',message:'OpenRouter config missing before request',data:{cwd:process.cwd(),hasOpenRouterEnv:Boolean(process.env.OPENROUTER_API_KEY),openRouterEnvLength:String(process.env.OPENROUTER_API_KEY ?? '').length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    throw new Error('OPENROUTER_API_KEY missing — set it in .env at repo root')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 900_000)

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://local.vantum/transcript-pipeline',
        'X-Title': 'Vantum transcript pipeline',
      },
      body: JSON.stringify({
        model: cfg.model,
        stream: false,
        messages: [
          { role: 'system', content: opts.system },
          { role: 'user', content: opts.user },
        ],
        temperature: opts.temperature ?? 0.15,
        max_tokens: opts.max_tokens ?? 16_000,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`OpenRouter HTTP ${res.status}: ${errText.slice(0, 800)}`)
    }
    const json = await res.json()
    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenRouter returned empty content')
    }
    return { text: content.trim(), model: cfg.model }
  } finally {
    clearTimeout(timeout)
  }
}
