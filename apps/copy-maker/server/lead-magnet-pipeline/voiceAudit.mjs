const BANNED = ['robust', 'leverage', 'game-changer', 'delve', 'tapestry']

function cleanText(value) {
  let out = String(value || '')
  out = out.replace(/—/g, ', ')
  for (const bad of BANNED) {
    const rx = new RegExp(`\\b${bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    out = out.replace(rx, 'clear')
  }
  return out
}

function walk(node, audit, path) {
  if (Array.isArray(node)) {
    return node.map((item, idx) => walk(item, audit, `${path}[${idx}]`))
  }
  if (!node || typeof node !== 'object') {
    if (typeof node === 'string') {
      const cleaned = cleanText(node)
      if (cleaned !== node) audit.push({ slot: path, severity: 'auto-fix', issue: 'voice_cleanup_applied' })
      return cleaned
    }
    return node
  }
  const out = {}
  for (const [k, v] of Object.entries(node)) out[k] = walk(v, audit, path ? `${path}.${k}` : k)
  return out
}

export function stageVoiceAudit(contentDraft) {
  const audit = []
  const content = walk(contentDraft, audit, '')
  return { content, audit }
}
