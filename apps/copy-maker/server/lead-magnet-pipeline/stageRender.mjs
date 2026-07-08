import { writeSimplePdf } from './utils.mjs'

export function stageRenderPdf(html, pdfPath) {
  const plain = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const lines = [`VANTUM LEAD MAGNET`, '', ...plain.match(/.{1,90}/g).slice(0, 45)]
  writeSimplePdf(pdfPath, lines)
}
