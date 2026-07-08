import { openRouterChat } from '../transcript-pipeline/openRouter.mjs'

function fallbackContent(source, plan) {
  const lesson = source.lessons[0]
  const lessonTitle = plan.lessons?.[0]?.title || lesson.subject || 'Core Lesson'
  const points = Array.isArray(lesson.key_points) ? lesson.key_points : []
  const body = points.length
    ? points.slice(0, 3).map((p) => `${p}.`)
    : ['State the pattern clearly.', 'Show the structural shift.', 'Close with one executable move.']
  return {
    cover: {
      tag_text: plan.cover.tag_text,
      h1_line_1: plan.cover.h1_line_1,
      h1_line_2: plan.cover.h1_line_2,
      subtitle: plan.cover.subtitle,
      lesson_previews: plan.cover.lesson_previews,
      footer_text: 'Vantum',
    },
    lessons: [
      {
        lesson_id: '1.1',
        slots: {
          'lesson-badge': source.global.course_title,
          'lesson-title': lessonTitle,
          'body-paragraphs': body.map((t) => ({ text: t })),
          'block-dark-challenge': {
            label: 'Challenge',
            title: 'Replace generic messaging with one specific claim.',
            body: 'Pick one measurable outcome and anchor your copy to it.',
          },
        },
      },
    ],
    tasks_page: {
      heading_line_1: plan.tasks_page.heading_line_1,
      heading_line_2: plan.tasks_page.heading_line_2,
      subtitle: plan.tasks_page.subtitle,
      tasks: plan.tasks_page.tasks,
      cta_heading: plan.tasks_page.cta_heading,
      cta_subtext: plan.tasks_page.cta_subtext,
      footer_left: source.global.course_title,
      footer_right: source.global.guide_slug,
    },
  }
}

export async function stageWrite(source, plan) {
  const fallback = fallbackContent(source, plan)
  if (!process.env.OPENROUTER_API_KEY) return fallback
  try {
    const system = [
      'You write concise Vantum lead magnet copy.',
      'Return valid JSON only.',
      'No markdown code fences.',
      'No em dashes.',
    ].join('\n')
    const user = [
      `SOURCE:\n${JSON.stringify(source, null, 2)}`,
      '',
      `PLAN:\n${JSON.stringify(plan, null, 2)}`,
      '',
      `JSON SHAPE TO FOLLOW:\n${JSON.stringify(fallback, null, 2)}`,
      '',
      'Return content JSON.',
    ].join('\n')
    const rsp = await openRouterChat({ system, user, temperature: 0.2, max_tokens: 6000, timeoutMs: 120000 })
    const parsed = JSON.parse(rsp.text)
    return parsed && typeof parsed === 'object' ? parsed : fallback
  } catch {
    return fallback
  }
}
