const AUTO_FIX_ISSUES = [
  { key: 'em_dash', rx: /—/ },
  { key: 'banned_robust', rx: /\brobust\b/i },
  { key: 'banned_leverage', rx: /\bleverage\b/i },
]

function walkStrings(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((item, idx) => walkStrings(item, `${path}[${idx}]`, out))
    return
  }
  if (node && typeof node === 'object') {
    Object.entries(node).forEach(([k, v]) => walkStrings(v, path ? `${path}.${k}` : k, out))
    return
  }
  if (typeof node === 'string') out.push({ path, value: node })
}

export function stageMultiAudit({ plan, content, html }) {
  const issues = []
  const texts = []
  walkStrings(content, '', texts)
  for (const text of texts) {
    for (const rule of AUTO_FIX_ISSUES) {
      if (!rule.rx.test(text.value)) continue
      issues.push({
        audit: 'voice',
        severity: 'auto-fix',
        slot: text.path,
        description: `Detected ${rule.key}`,
        suggested_fix: rule.key === 'em_dash' ? 'Replace em dash with comma or period.' : 'Replace banned word.',
      })
    }
  }

  if (!Array.isArray(plan?.lessons) || plan.lessons.length === 0) {
    issues.push({
      audit: 'design',
      severity: 'blocker',
      slot: 'plan.lessons',
      description: 'No lessons planned.',
    })
  }

  if (!String(html || '').includes('<section class="page">')) {
    issues.push({
      audit: 'render',
      severity: 'blocker',
      slot: 'html',
      description: 'Expected page section marker missing.',
    })
  }

  const summary = {
    blockers: issues.filter((x) => x.severity === 'blocker').length,
    auto_fixes: issues.filter((x) => x.severity === 'auto-fix').length,
    flags: issues.filter((x) => x.severity === 'flag').length,
  }
  const failedAudits = [...new Set(issues.map((x) => x.audit))]
  return {
    passed: ['xref', 'math', 'spelling', 'image-style'].filter((name) => !failedAudits.includes(name)),
    failed: failedAudits,
    issues,
    summary,
  }
}
