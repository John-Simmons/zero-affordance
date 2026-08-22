import { beforeEach, describe, expect, it } from 'vitest'

import { createMockProvider } from '@/lib/data/mock'

describe('mock data provider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds no surveys, but still serves the survey path', async () => {
    // The placeholder survey was retired; the machinery behind it was not.
    // An empty list is a content state, not a broken one.
    const provider = createMockProvider()
    expect(await provider.listSurveys()).toEqual([])
    expect(await provider.getSurvey('technology-habits')).toBeNull()
  })

  it('seeds only the pairwise experiment', async () => {
    const provider = createMockProvider()
    const summaries = await provider.listExperiments()
    expect(summaries.map((e) => e.slug)).toEqual(['loading-perception'])
    expect(await provider.getExperiment('button-affordance')).toBeNull()
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
      redone: false,
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

  it('keeps the redo flag on the stored match', async () => {
    // Nothing in the `DataProvider` surface reads a match back — Elo replays
    // them and reports ratings — so the only way to check the flag survives is
    // to look at what was written. It has to: matches are append-only, so a
    // vote stored without it can never be annotated afterwards.
    const provider = createMockProvider()
    await provider.recordMatch({
      experimentId: 'exp_loading_perception',
      visitorId: 'test-visitor',
      variantAId: 'quote',
      variantBId: 'blank',
      durationAMs: 1900,
      durationBMs: 2200,
      outcome: 'a',
      redone: true,
    })

    const stored = JSON.parse(localStorage.getItem('za.mock.matches') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ visitorId: 'test-visitor', redone: true })
  })

  it('ends its Elo history on the standings it reports', async () => {
    // The two read one match log through one helper; this is what catches them
    // drifting apart and putting different answers one tab from each other.
    const provider = createMockProvider()
    await provider.recordMatch({
      experimentId: 'exp_loading_perception',
      visitorId: 'test-visitor',
      variantAId: 'quote',
      variantBId: 'skeleton',
      durationAMs: 2100,
      durationBMs: 2400,
      outcome: 'b',
      redone: false,
    })

    const agg = await provider.getEloAggregate('exp_loading_perception')
    const history = await provider.getEloHistory('exp_loading_perception')
    const last = history.points[history.points.length - 1]

    expect(history.totalMatches).toBe(agg.totalMatches)
    expect(last.matchCount).toBe(agg.totalMatches)
    for (const r of agg.ratings)
      expect(last.ratings[r.variantId]).toBe(r.rating)
  })

  it('has no Elo history for an experiment it does not know', async () => {
    const history = await createMockProvider().getEloHistory('nope')
    expect(history).toEqual({
      experimentId: 'nope',
      totalMatches: 0,
      points: [],
    })
  })

  describe('video ideas', () => {
    const VISITOR = 'visitor-a'

    it('lists a created idea with no votes', async () => {
      const provider = createMockProvider()
      await provider.createVideoIdea({
        title: 'Why dark patterns work',
        description: 'A teardown of consent flows.',
      })

      const ideas = await provider.listVideoIdeas(VISITOR)
      expect(ideas).toHaveLength(1)
      expect(ideas[0].voteCount).toBe(0)
      expect(ideas[0].votedByVisitor).toBe(false)
    })

    it('sets a vote on and back off', async () => {
      // The contract the Postgres function has to match. This is the one place
      // the two adapters could silently drift, so it is pinned on both sides.
      const provider = createMockProvider()
      const idea = await provider.createVideoIdea({
        title: 'Undo',
        description: 'The psychology of undo.',
      })

      const on = await provider.setIdeaVote(idea.id, VISITOR, true)
      expect(on).toEqual({ ideaId: idea.id, voteCount: 1, voted: true })

      const off = await provider.setIdeaVote(idea.id, VISITOR, false)
      expect(off).toEqual({ ideaId: idea.id, voteCount: 0, voted: false })
    })

    it('is idempotent, so a duplicated request cannot undo the vote', async () => {
      // The regression this API shape exists for. When the write was a toggle,
      // one tap delivered twice — a double tap, or a browser re-sending a POST
      // over a dead keep-alive connection — left the vote off and the visitor
      // watching it vanish.
      const provider = createMockProvider()
      const idea = await provider.createVideoIdea({
        title: 'Retries',
        description: 'Requests that arrive twice.',
      })

      const first = await provider.setIdeaVote(idea.id, VISITOR, true)
      const second = await provider.setIdeaVote(idea.id, VISITOR, true)
      expect(second).toEqual(first)
      expect((await provider.listVideoIdeas(VISITOR))[0]).toMatchObject({
        voteCount: 1,
        votedByVisitor: true,
      })

      await provider.setIdeaVote(idea.id, VISITOR, false)
      await provider.setIdeaVote(idea.id, VISITOR, false)
      expect((await provider.listVideoIdeas(VISITOR))[0]).toMatchObject({
        voteCount: 0,
        votedByVisitor: false,
      })
    })

    it('counts one vote per visitor, not per click', async () => {
      const provider = createMockProvider()
      const idea = await provider.createVideoIdea({
        title: 'Forms',
        description: 'Why forms feel slow.',
      })

      await provider.setIdeaVote(idea.id, VISITOR, true)
      await provider.setIdeaVote(idea.id, 'visitor-b', true)
      expect((await provider.listVideoIdeas(VISITOR))[0].voteCount).toBe(2)

      // Voting again as the same visitor is a no-op — it can never add a
      // second vote to the same idea.
      await provider.setIdeaVote(idea.id, 'visitor-b', true)
      await provider.setIdeaVote(idea.id, 'visitor-b', true)
      expect((await provider.listVideoIdeas(VISITOR))[0].voteCount).toBe(2)
    })

    it('reports votedByVisitor only for the asking visitor', async () => {
      const provider = createMockProvider()
      const idea = await provider.createVideoIdea({
        title: 'Loading',
        description: 'Perceived duration.',
      })
      await provider.setIdeaVote(idea.id, VISITOR, true)

      expect((await provider.listVideoIdeas(VISITOR))[0].votedByVisitor).toBe(
        true,
      )
      expect(
        (await provider.listVideoIdeas('visitor-b'))[0].votedByVisitor,
      ).toBe(false)
    })

    it('stores no visitor id on an idea row', async () => {
      // The anonymity promise, asserted rather than commented: an idea is
      // public, so nothing on the row may lead back to whoever wrote it.
      const provider = createMockProvider()
      await provider.createVideoIdea({
        title: 'Anonymous',
        description: 'Should not be attributable.',
      })
      await provider.setIdeaVote(
        (await provider.listVideoIdeas(VISITOR))[0].id,
        VISITOR,
        true,
      )

      const raw = localStorage.getItem('za.mock.videoIdeas') ?? ''
      expect(raw).not.toContain(VISITOR)
    })

    it('sorts by votes, then newest', async () => {
      const provider = createMockProvider()
      const quiet = await provider.createVideoIdea({
        title: 'Quiet',
        description: 'No votes.',
      })
      const popular = await provider.createVideoIdea({
        title: 'Popular',
        description: 'One vote.',
      })
      await provider.setIdeaVote(popular.id, VISITOR, true)

      const ideas = await provider.listVideoIdeas(VISITOR)
      expect(ideas.map((i) => i.id)).toEqual([popular.id, quiet.id])
    })

    it('rejects blank and over-length text', async () => {
      const provider = createMockProvider()
      await expect(
        provider.createVideoIdea({ title: '   ', description: 'ok' }),
      ).rejects.toThrow()
      await expect(
        provider.createVideoIdea({ title: 'ok', description: '' }),
      ).rejects.toThrow()
      await expect(
        provider.createVideoIdea({
          title: 'x'.repeat(81),
          description: 'ok',
        }),
      ).rejects.toThrow()
      await expect(
        provider.createVideoIdea({
          title: 'ok',
          description: 'x'.repeat(501),
        }),
      ).rejects.toThrow()
    })
  })
})
