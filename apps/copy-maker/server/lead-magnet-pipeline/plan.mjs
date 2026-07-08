import { openRouterChat } from '../transcript-pipeline/openRouter.mjs'

function deterministicPlan(source) {
  const lesson = source.lessons[0]
  const lessonTitle = lesson?.subject || source.global.guide_title_hint || 'Core Lesson'
  const strikeWord = String(lessonTitle).split(/\s+/)[0] || 'Core'
  return {
    guide_title: source.global.guide_title_hint,
    cover: {
      tag_text: `${source.global.course_title} · Lead Magnet`,
      h1_line_1: source.global.guide_title_hint,
      h1_line_2: 'Built with Vantum pipeline',
      subtitle: 'A concise operator guide generated from your brief.',
      lesson_previews: [{ num: '1.1', text: lessonTitle }],
    },
    lessons: [
      {
        lesson_id: '1.1',
        variant: 'text-heavy',
        title: lessonTitle,
        strikethrough_word: strikeWord,
        pages: [
          {
            page_index: 0,
            type: 'lesson-title-page',
            components: [
              { id: 'lesson-badge' },
              { id: 'lesson-title' },
              { id: 'lesson-divider' },
              { id: 'body-paragraph', count: 3 },
              { id: 'whiteboard-placeholder', visual_id: 'wb-01' },
              { id: 'block-dark-challenge' },
            ],
          },
        ],
      },
    ],
    tasks_page: {
      heading_line_1: 'Execution Tasks',
      heading_line_2: 'Ship this in one sprint',
      subtitle: 'Work from the lesson in order.',
      tasks: [{ number: '01', title: 'Draft your first asset', description: 'Apply the lesson directly.' }],
      cta_heading: 'Start now',
      cta_subtext: 'Ship before refining.',
    },
    visuals: [{ id: 'wb-01', type: 'wb-single-metaphor', description: `Whiteboard about: ${lessonTitle}` }],
  }
}

export async function stagePlan(source) {
  const basePlan = deterministicPlan(source)
  if (!process.env.OPENROUTER_API_KEY) return basePlan
  try {
    const system = [
      'You are a lead magnet planning model.',
      'Return valid JSON only.',
      'Keep the same schema keys as the sample object.',
      'No markdown fences.',
    ].join('\n')
    const user = [
      `SOURCE JSON:\n${JSON.stringify(source, null, 2)}`,
      '',
      `SAMPLE PLAN SHAPE:\n${JSON.stringify(basePlan, null, 2)}`,
      '',
      'Return one improved plan JSON.',
    ].join('\n')
    const rsp = await openRouterChat({ system, user, temperature: 0.15, max_tokens: 5000, timeoutMs: 120000 })
    const parsed = JSON.parse(rsp.text)
    if (!parsed || typeof parsed !== 'object') return basePlan
    return parsed
  } catch {
    return basePlan
  }
}
