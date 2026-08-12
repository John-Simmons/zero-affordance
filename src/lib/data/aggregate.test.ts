import { describe, expect, it } from 'vitest'

import { computeElo, roundRobinPairs, START_RATING } from '@/lib/data/aggregate'
import type { Experiment, MatchInput } from '@/lib/data/types'

const experiment: Experiment = {
  id: 'exp_test',
  slug: 'test',
  title: 'Test',
  description: '',
  hypothesis: '',
  kind: 'pairwise',
  metricLabel: '',
  metricMin: 0,
  metricMax: 0,
  variants: [
    { id: 'x', label: 'X', baseDurationMs: 1500, jitterMs: 0, description: '' },
    { id: 'y', label: 'Y', baseDurationMs: 1500, jitterMs: 0, description: '' },
    { id: 'z', label: 'Z', baseDurationMs: 1500, jitterMs: 0, description: '' },
  ],
}

function match(over: Partial<MatchInput> = {}): MatchInput {
  return {
    experimentId: 'exp_test',
    visitorId: 'v1',
    variantAId: 'x',
    variantBId: 'y',
    durationAMs: 1500,
    durationBMs: 1500,
    outcome: 'a',
    ...over,
  }
}

const ratingOf = (agg: ReturnType<typeof computeElo>, id: string) =>
  agg.ratings.find((r) => r.variantId === id)!.rating

describe('roundRobinPairs', () => {
  it('produces every unordered pair exactly once', () => {
    const pairs = roundRobinPairs(['a', 'b', 'c', 'd', 'e'])
    expect(pairs).toHaveLength(10) // 5 * 4 / 2

    const keys = pairs.map(([x, y]) => [x, y].sort().join('|'))
    expect(new Set(keys).size).toBe(10)
  })

  it('never pairs an item with itself', () => {
    for (const [x, y] of roundRobinPairs([1, 2, 3, 4, 5])) expect(x).not.toBe(y)
  })
})

describe('computeElo', () => {
  it('starts every variant at START_RATING with no matches', () => {
    const agg = computeElo(experiment, [])
    expect(agg.totalMatches).toBe(0)
    expect(agg.ratings).toHaveLength(3)
    for (const r of agg.ratings) expect(r.rating).toBe(START_RATING)
  })

  it('is zero-sum — the rating total never moves', () => {
    const matches = [
      match({ outcome: 'a' }),
      match({ variantAId: 'y', variantBId: 'z', outcome: 'b' }),
      match({ variantAId: 'x', variantBId: 'z', outcome: 'tie' }),
      match({ outcome: 'b', durationAMs: 1200, durationBMs: 1900 }),
    ]
    const total = computeElo(experiment, matches).ratings.reduce(
      (sum, r) => sum + r.rating,
      0,
    )
    expect(total).toBeCloseTo(START_RATING * 3, 6)
  })

  it('leaves ratings untouched on an evenly-matched draw', () => {
    const agg = computeElo(experiment, [match({ outcome: 'tie' })])
    expect(ratingOf(agg, 'x')).toBeCloseTo(START_RATING, 9)
    expect(ratingOf(agg, 'y')).toBeCloseTo(START_RATING, 9)
  })

  it('does not touch variants that did not play', () => {
    const agg = computeElo(experiment, [match()])
    expect(ratingOf(agg, 'z')).toBe(START_RATING)
    expect(agg.ratings.find((r) => r.variantId === 'z')!.matches).toBe(0)
  })

  // The whole point of the duration handicap.
  it('rewards a shorter winner LESS than a longer winner', () => {
    const shorterWins = computeElo(experiment, [
      match({ durationAMs: 1200, durationBMs: 1900, outcome: 'a' }),
    ])
    const longerWins = computeElo(experiment, [
      match({ durationAMs: 1900, durationBMs: 1200, outcome: 'a' }),
    ])

    const shortGain = ratingOf(shorterWins, 'x') - START_RATING
    const longGain = ratingOf(longerWins, 'x') - START_RATING

    expect(shortGain).toBeGreaterThan(0)
    expect(longGain).toBeGreaterThan(shortGain)
  })

  it('punishes a shorter loser MORE than a longer loser', () => {
    const shorterLoses = computeElo(experiment, [
      match({ durationAMs: 1200, durationBMs: 1900, outcome: 'b' }),
    ])
    const longerLoses = computeElo(experiment, [
      match({ durationAMs: 1900, durationBMs: 1200, outcome: 'b' }),
    ])

    const shortLoss = START_RATING - ratingOf(shorterLoses, 'x')
    const longLoss = START_RATING - ratingOf(longerLoses, 'x')

    expect(shortLoss).toBeGreaterThan(longLoss)
  })

  /**
   * The handicap is relative, not a flat rate per millisecond: how noticeable a
   * duration gap is scales with the durations themselves. The same 400ms gap
   * should count for far more between two short waits than between two long
   * ones — an absolute rate would treat them identically and silently mis-rate
   * every match if the seeded durations ever changed.
   */
  it('scales the handicap with relative, not absolute, difference', () => {
    const gain = (aMs: number, bMs: number) =>
      ratingOf(
        computeElo(experiment, [
          match({ durationAMs: aMs, durationBMs: bMs, outcome: 'a' }),
        ]),
        'x',
      ) - START_RATING

    // 400ms apart in both cases, but 40% of a 1s wait vs 16% of a 2.5s one.
    const shortWaits = gain(800, 1200)
    const longWaits = gain(2300, 2700)

    // Winning while shorter earns less; being *proportionally* much shorter
    // earns least of all.
    expect(shortWaits).toBeLessThan(longWaits)
    expect(shortWaits).toBeGreaterThan(0)
  })

  it('applies no handicap when both ran for the same time', () => {
    const even = computeElo(experiment, [
      match({ durationAMs: 2500, durationBMs: 2500, outcome: 'a' }),
    ])
    // Equal ratings, equal durations, so a win is worth exactly half of K.
    expect(ratingOf(even, 'x') - START_RATING).toBeCloseTo(12, 9)
  })

  it('treats a draw against a much shorter rival as a gain', () => {
    // Holding even despite being 700ms longer is genuinely good news.
    const agg = computeElo(experiment, [
      match({ durationAMs: 1900, durationBMs: 1200, outcome: 'tie' }),
    ])
    expect(ratingOf(agg, 'x')).toBeGreaterThan(START_RATING)
  })

  it('counts wins, losses and ties per variant', () => {
    const agg = computeElo(experiment, [
      match({ outcome: 'a' }),
      match({ outcome: 'b' }),
      match({ outcome: 'tie' }),
    ])
    const x = agg.ratings.find((r) => r.variantId === 'x')!
    expect([x.wins, x.losses, x.ties, x.matches]).toEqual([1, 1, 1, 3])
    expect(agg.totalMatches).toBe(3)
  })

  it('sorts ratings highest first', () => {
    const agg = computeElo(experiment, [
      match({ variantAId: 'x', variantBId: 'y', outcome: 'a' }),
      match({ variantAId: 'x', variantBId: 'z', outcome: 'a' }),
    ])
    expect(agg.ratings[0].variantId).toBe('x')
    const values = agg.ratings.map((r) => r.rating)
    expect(values).toEqual([...values].sort((p, q) => q - p))
  })

  // Elo is path-dependent, which is why adapters must impose a stable order.
  it('is order-dependent', () => {
    const first = match({ variantAId: 'x', variantBId: 'y', outcome: 'a' })
    const second = match({ variantAId: 'y', variantBId: 'z', outcome: 'a' })
    const third = match({ variantAId: 'x', variantBId: 'z', outcome: 'b' })

    const forward = computeElo(experiment, [first, second, third])
    const reordered = computeElo(experiment, [third, second, first])

    expect(ratingOf(forward, 'x')).not.toBeCloseTo(ratingOf(reordered, 'x'), 6)
  })

  it('seeds ratings from initialRatings when given', () => {
    const agg = computeElo(experiment, [], { x: 1700, y: 1300 })
    expect(ratingOf(agg, 'x')).toBe(1700)
    expect(ratingOf(agg, 'y')).toBe(1300)
    // Absent from the map, so it falls back.
    expect(ratingOf(agg, 'z')).toBe(START_RATING)
  })

  it('seeding with START_RATING everywhere matches the unseeded result', () => {
    const matches = [
      match({ outcome: 'a' }),
      match({ variantAId: 'y', variantBId: 'z', outcome: 'b' }),
    ]
    const seeded = computeElo(experiment, matches, {
      x: START_RATING,
      y: START_RATING,
      z: START_RATING,
    })
    expect(seeded.ratings).toEqual(computeElo(experiment, matches).ratings)
  })

  it('stays zero-sum under seeding', () => {
    const seed = { x: 1700, y: 1450, z: 1350 }
    const start = Object.values(seed).reduce((a, b) => a + b, 0)
    const agg = computeElo(
      experiment,
      [match({ outcome: 'a' }), match({ variantAId: 'x', variantBId: 'z' })],
      seed,
    )
    const total = agg.ratings.reduce((sum, r) => sum + r.rating, 0)
    expect(total).toBeCloseTo(start, 6)
  })

  /**
   * Why the standings screen replays instead of subtracting after-minus-before.
   *
   * Asserting "the replay ignores other people's votes" alone would be vacuous —
   * those votes are never passed to it. So this pins both halves: the replay
   * agrees with plain subtraction when nobody else votes (it is correct), and
   * subtraction drifts as soon as somebody does (it is necessary).
   */
  it('attributes only the participant’s own votes', () => {
    const ratings = (matches: MatchInput[], seed?: Record<string, number>) =>
      Object.fromEntries(
        computeElo(experiment, matches, seed).ratings.map((r) => [
          r.variantId,
          r.rating,
        ]),
      )
    const diff = (a: Record<string, number>, b: Record<string, number>) =>
      Object.keys(b)
        .sort()
        .map((k) => Number((a[k] - b[k]).toFixed(9)))

    const history = [match({ outcome: 'a' }), match({ outcome: 'b' })]
    const mine = [
      match({
        visitorId: 'me',
        variantAId: 'x',
        variantBId: 'z',
        outcome: 'a',
      }),
      match({
        visitorId: 'me',
        variantAId: 'y',
        variantBId: 'z',
        outcome: 'b',
      }),
    ]
    const theirs = [
      match({ visitorId: 'other', variantAId: 'y', variantBId: 'z' }),
    ]

    const snapshot = ratings(history)
    const replayed = diff(ratings(mine, snapshot), snapshot)

    // Nobody else voted: subtraction gets the right answer, and so does replay.
    const cleanSubtraction = diff(ratings([...history, ...mine]), snapshot)
    expect(replayed).toEqual(cleanSubtraction)

    // Someone else voted mid-run: subtraction now credits their effect to us.
    const contaminated = diff(
      ratings([...history, ...mine, ...theirs]),
      snapshot,
    )
    expect(contaminated).not.toEqual(replayed)
  })

  it('skips matches naming variants the experiment no longer declares', () => {
    const agg = computeElo(experiment, [
      match({ variantAId: 'x', variantBId: 'gone' }),
      match({ variantAId: 'x', variantBId: 'x' }),
    ])
    expect(agg.totalMatches).toBe(0)
    for (const r of agg.ratings) expect(r.rating).toBe(START_RATING)
  })
})
