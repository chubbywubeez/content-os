import fs from 'node:fs'
import path from 'node:path'

function simpleSvg(title, note) {
  const t = String(title || 'Visual')
  const n = String(note || '').slice(0, 120)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="700" viewBox="0 0 1200 700">',
    '<rect x="20" y="20" width="1160" height="660" rx="22" fill="#ffffff" stroke="#059669" stroke-width="6" />',
    `<text x="60" y="120" font-size="44" font-family="Montserrat, sans-serif" fill="#0f172a">${t}</text>`,
    '<line x1="60" y1="160" x2="1140" y2="160" stroke="#1a1e29" stroke-width="4" />',
    `<text x="60" y="230" font-size="30" font-family="Montserrat, sans-serif" fill="#334155">${n}</text>`,
    '<text x="60" y="640" font-size="24" font-family="Montserrat, sans-serif" fill="#059669">VANTUM WHITEBOARD PLACEHOLDER</text>',
    '</svg>',
  ].join('\n')
}

export function stageVisualize(plan, paths) {
  const visuals = Array.isArray(plan.visuals) ? plan.visuals : []
  const written = []
  for (const visual of visuals) {
    const id = String(visual.id || `visual-${written.length + 1}`)
    const fp = path.join(paths.assetsDir, `${id}.svg`)
    fs.writeFileSync(fp, simpleSvg(visual.type || 'visual', visual.description || ''), 'utf8')
    written.push({ id, type: visual.type || 'unknown', path: fp })
  }
  return written
}
