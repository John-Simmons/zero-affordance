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

  it('loads the pairwise experiment with identity-only variants', async () => {
    const provider = createMockProvider()
    const exp = await provider.getExperiment('loading-perception')
    expect(exp?.kind).toBe('pairwise')
    expect(exp?.variants).toHaveLength(6)
    for (const v of exp!.variants) {
      expect(v.id).toBeTruthy()
      expect(v.label).toBeTruthy()
      expect(v.description).toBeTruthy()
      // Durations belong to the matchup, not the variant. A variant that
      // carried its own would make length part of its identity, which is the
      // confound `rollMatchupDurations` exists to remove.
      expect(v).not.toHaveProperty('baseDurationMs')
      expect(v).not.toHaveProperty('jitterMs')
    }
  })

  it('returns a deterministic Elo baseline across provider instances', async () => {
    // Elo is path-dependent, so a baseline that varied per read would make the
    // leaderboard jump around between renders.
    const first = await createMockProvider().getEloAggregate(
      'exp_loading_perception',
    )
    const second = await createMockProvider().getEloAggregate(
      'exp_loading_perception',
    )
    expect(second.ratings).toEqual(first.ratings)
    expect(first.totalMatches).toBeGreaterThan(0)
  })

  it('records a match and moves only the two variants involved', async () => {
    const provider = createMockProvider()
    const before = await provider.getEloAggregate('exp_loading_perception')
    const ratingBefore = (agg: typeof before, id: string) =>
      agg.ratings.find((r) => r.variantId === id)!.rating

    await provider.recordMatch({
      experimentId: 'exp_loading_perception',
      visitorId: 'test-visitor',
      variantAId: 'classic_spinner',
      variantBId: 'blank',
      durationAMs: 1500,
      durationBMs: 2000,
      outcome: 'a',
    })

    const after = await provider.getEloAggregate('exp_loading_perception')
    expect(after.totalMatches).toBe(before.totalMatches + 1)
    expect(ratingBefore(after, 'classic_spinner')).toBeGreaterThan(
      ratingBefore(before, 'classic_spinner'),
    )
    expect(ratingBefore(after, 'blank')).toBeLessThan(
      ratingBefore(before, 'blank'),
    )
    // Untouched by this matchup.
    for (const id of ['progress_bar', 'skeleton', 'baking', 'quote']) {
      expect(ratingBefore(after, id)).toBeCloseTo(ratingBefore(before, id), 9)
    }
  })
})
