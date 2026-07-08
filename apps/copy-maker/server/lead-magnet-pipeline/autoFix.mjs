function pathSegments(slotPath) {
  return String(slotPath || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
}

function getAtPath(root, slotPath) {
  let cur = root
  for (const key of pathSegments(slotPath)) {
    if (cur == null || typeof cur !== 'object') return null
    cur = cur[key]
  }
  return cur
}

function setAtPath(root, slotPath, nextVal) {
  const segs = pathSegments(slotPath)
  if (!segs.length) return false
  let cur = root
  for (let i = 0; i < segs.length - 1; i++) {
    const key = segs[i]
    if (cur[key] == null || typeof cur[key] !== 'object') return false
    cur = cur[key]
  }
  cur[segs[segs.length - 1]] = nextVal
  return true
}

function applySimpleFix(value, issue) {
  let out = String(value || '')
  if (issue.description?.includes('em_dash')) out = out.replace(/—/g, ', ')
  if (issue.description?.includes('banned_robust')) out = out.replace(/\brobust\b/gi, 'clear')
  if (issue.description?.includes('banned_leverage')) out = out.replace(/\bleverage\b/gi, 'use')
  return out
}

export function stageAutoFix(content, auditReport) {
  const autoFixIssues = (auditReport?.issues || []).filter((x) => x.severity === 'auto-fix')
  if (!autoFixIssues.length) {
    return { content, fixes_applied: [], remaining_flags: (auditReport?.issues || []).filter((x) => x.severity !== 'auto-fix') }
  }

  const next = JSON.parse(JSON.stringify(content))
  const fixes = []
  for (const issue of autoFixIssues) {
    const before = getAtPath(next, issue.slot)
    if (typeof before !== 'string') continue
    const after = applySimpleFix(before, issue)
    if (after === before) continue
    setAtPath(next, issue.slot, after)
    fixes.push({ issue_check: issue.audit, slot: issue.slot, before, after })
  }
  return {
    content: next,
    fixes_applied: fixes,
    remaining_flags: (auditReport?.issues || []).filter((x) => x.severity !== 'auto-fix'),
  }
}
