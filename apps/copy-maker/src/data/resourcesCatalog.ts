export type ResourceEntry = {
  id: string
  title: string
  description: string
  htmlPath: string
  mdPath: string
  jsonPath: string
  pdfPath?: string
}

export const RESOURCES_CATALOG: ResourceEntry[] = [
  {
    id: 'voice',
    title: 'Vantum Voice Guide',
    description: 'Voice system, tone settings, signature moves, and writing templates.',
    htmlPath: '/resources/vantum_voice_guide.html',
    mdPath: '/resources/vantum_voice_guide.md',
    jsonPath: '/resources/vantum_voice_guide.json',
  },
  {
    id: 'design-system',
    title: 'Vantum PDF Design System v2',
    description: 'Brand colors, typography, block rules, and lead magnet PDF generation.',
    htmlPath: '/resources/vantum_pdf_design_system_v2.html',
    mdPath: '/resources/vantum_pdf_design_system_v2.md',
    jsonPath: '/resources/vantum_pdf_design_system_v2.json',
  },
  {
    id: 'layered-writing',
    title: 'The Layered Writing System',
    description:
      'Skeleton, voice, exemplars, and constraint-stack method for producing long-form content at scale.',
    htmlPath: '/resources/layered_writing_system.html',
    mdPath: '/resources/layered_writing_system.md',
    jsonPath: '/resources/layered_writing_system.json',
  },
]
