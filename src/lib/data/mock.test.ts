import { beforeEach, describe, expect, it } from 'vitest'

import { createMockProvider } from '@/lib/data/mock'

describe('mock data provider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('lists and loads the seeded survey', async () => {
    const provider = createMockProvider()
    const summaries = await provider.listSurveys()
    expect(summaries.length).toBeGreaterThan(0)

    const survey = await provider.getSurvey('technology-habits')
    expect(survey).not.toBeNull()
    expect(survey?.questions.length).toBeGreaterThan(0)
  })

  it('records a survey response and reflects it in the aggregate', async () => {
    const provider = createMockProvider()
    const before = await provider.getSurveyAggregate('srv_tech_habits')
    const q = before.questions.find((x) => x.questionId === 'q_notifications')!
    const beforeCalm = q.optionCounts?.calm ?? 0

    await provider.submitSurveyResponse({
      surveyId: 'srv_tech_habits',
      visitorId: 'test-visitor',
      answers: { q_notifications: 'calm', q_ease: 5 },
    })

    const after = await provider.getSurveyAggregate('srv_tech_habits')
    const qAfter = after.questions.find(
      (x) => x.questionId === 'q_notifications',
    )!
    expect(qAfter.optionCounts?.calm).toBe(beforeCalm + 1)
  })

  it('assigns a stable variant for a given visitor', async () => {
    const provider = createMockProvider()
    const a = await provider.assignVariant('exp_button_affordance', 'visitor-1')
    const b = await provider.assignVariant('exp_button_affordance', 'visitor-1')
    expect(a.id).toBe(b.id)
  })

  it('records an interaction and updates the experiment aggregate', async () => {
    const provider = createMockProvider()
    const before = await provider.getExperimentAggregate(
      'exp_button_affordance',
    )
    const solidBefore =
      before.variants.find((v) => v.variantId === 'solid')?.count ?? 0

    await provider.recordInteraction({
      experimentId: 'exp_button_affordance',
      variantId: 'solid',
      visitorId: 'test-visitor',
      value: 4,
    })

    const after = await provider.getExperimentAggregate('exp_button_affordance')
    const solidAfter =
      after.variants.find((v) => v.variantId === 'solid')?.count ?? 0
    expect(solidAfter).toBe(solidBefore + 1)
  })
})
