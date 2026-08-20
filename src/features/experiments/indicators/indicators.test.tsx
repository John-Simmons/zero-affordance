import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { loadingIndicators } from '@/features/experiments/indicators'
import { roundRobinPairs } from '@/lib/data/aggregate'
import { seedExperiments } from '@/lib/data/seed'

const ids = Object.keys(loadingIndicators)

/** Indicators that must visibly track progress, vs those that may ignore it. */
const DETERMINATE = ['progress_bar', 'baking']

const loadingExperiment = seedExperiments.find(
  (e) => e.id === 'exp_loading_perception',
)!

/** Seed defaults so every existing call site reads unchanged. */
function html(id: string, progress: number, seed = 0): string {
  const Indicator = loadingIndicators[id]
  const { container } = render(<Indicator progress={progress} seed={seed} />)
  return container.innerHTML
}

/** Just the line being read, without the ellipsis animating beneath it. */
function quoteAt(seed: number, progress = 0): string {
  const Indicator = loadingIndicators.quote
  const { container } = render(<Indicator progress={progress} seed={seed} />)
  return container.querySelector('blockquote')?.textContent ?? ''
}

describe('loadingIndicators', () => {
  /**
   * A registry key that doesn't match a seeded variant id renders an empty
   * canvas with no error — the participant just sees nothing for two seconds.
   * This is the only thing standing between that and a silent data-poisoning
   * bug, so it pins the two sources together in both directions.
   */
  it('matches the seeded variant ids exactly', () => {
    const experiment = seedExperiments.find(
      (e) => e.id === 'exp_loading_perception',
    )!
    const seeded = experiment.variants.map((v) => v.id).sort()
    expect(ids.slice().sort()).toEqual(seeded)
  })

  /**
   * Regression: a negative first tick once indexed `frames[-1]`, and
   * `undefined.padEnd()` took the whole page down on the first click of the
   * first matchup. The clock clamps at source now, but every indicator is also
   * expected to survive nonsense on its own.
   */
  it.each(ids)('renders %s for any progress value', (id) => {
    for (const p of [
      -1,
      -0.001,
      0,
      0.5,
      1,
      1.001,
      2,
      NaN,
      Infinity,
      -Infinity,
    ]) {
      expect(() => html(id, p)).not.toThrow()
    }
  })

  it.each(DETERMINATE)('%s visibly advances with progress', (id) => {
    expect(html(id, 0)).not.toEqual(html(id, 1))
  })

  it.each(ids)('renders %s for any seed', (id) => {
    // `seed` indexes a pool now, so nonsense must not index off the end — the
    // same failure mode as the negative-progress regression above.
    for (const s of [-1, 0, 1.5, NaN, Infinity, -Infinity, 1e9]) {
      expect(() => html(id, 0.5, s)).not.toThrow()
    }
  })

  it.each(ids.filter((id) => !DETERMINATE.includes(id)))(
    '%s is indeterminate — output does not depend on progress',
    (id) => {
      expect(html(id, 0)).toEqual(html(id, 1))
    },
  )

  it('renders blank as genuinely nothing', () => {
    expect(html('blank', 0.5)).toBe('')
  })

  it('ticks the ellipsis on its own clock, not on the run', () => {
    // Regression: the dots were `Math.floor(progress * 18) % 4`, which fits a
    // fixed NUMBER of cycles into the run rather than holding a fixed RATE.
    // With a 1800-3600ms band that is a 2x speed difference between the
    // shortest matchup and the longest, so the one signal meant to say nothing
    // but "still working" was quietly announcing its own duration.
    //
    // Seed held fixed throughout: within one appearance the quote must not
    // move, or the participant is re-reading rather than reading.
    expect(quoteAt(3, 0)).toBe(quoteAt(3, 1))
    const at = (p: number) => html('quote', p, 3)
    expect(at(0.35)).toEqual(at(0.5))

    // Three dots, all on one duration — the rate is a constant in the markup
    // rather than something computed per run. Asserting the class strings is
    // deliberate: Tailwind only emits a rule for a utility it can find in the
    // source, so a name built at runtime would render dots that never move,
    // and nothing else here would notice.
    const durations = [...at(0.5).matchAll(/quote-dot-\d_(\d+ms)_/g)].map(
      (m) => m[1],
    )
    expect(durations).toEqual(['600ms', '600ms', '600ms'])
  })

  it('shows the same quote for the same seed, on a fresh mount', () => {
    // The runner mounts this twice per appearance: the stimulus canvas, then
    // the vote-time recap. If those disagreed the recap would be reminding the
    // participant of something that never played.
    expect(quoteAt(7)).toBe(quoteAt(7))
    expect(quoteAt(7, 1)).toBe(quoteAt(7, 0))
  })

  it('gives every appearance in a run a different quote', () => {
    // A run hands each matchup a distinct seed, so the pool must be at least as
    // long as the run. Shorter and two appearances collide modulo its length,
    // and the participant re-reads a line — exactly the state this variant was
    // stuck in. Six indicators = fifteen matchups = fifteen quotes minimum.
    const seeds = roundRobinPairs(loadingExperiment.variants).map((_, i) => i)
    const seen = new Set(seeds.map((s) => quoteAt(s)))
    expect(seen.size).toBe(seeds.length)
  })

  it('keeps the quotes matched for reading length', () => {
    // Length is what this variant asks of the participant, so a very short and
    // a very long line are not the same stimulus and the spread would land in
    // its own rating. The upper bound is set by the recap panel on a phone —
    // about 114px, which clips past roughly three lines.
    const seeds = roundRobinPairs(loadingExperiment.variants).map((_, i) => i)
    for (const s of seeds) {
      const text = quoteAt(s)
      expect(text.length).toBeGreaterThanOrEqual(25)
      expect(text.length).toBeLessThanOrEqual(75)
    }
  })

  it('cuts the cooking indicator into three equal acts', () => {
    // The only variant whose progress signal is *which* scene is showing rather
    // than how full something is, so the boundaries are the signal itself. A
    // drifted split would still render and still advance — the DETERMINATE test
    // above would pass — while quietly showing a different stimulus than the
    // one the description promises.
    const [pour, stir, bake] = [
      [0, 0.32],
      [0.34, 0.66],
      [0.68, 1],
    ].map((band) => band.map((p) => html('baking', p)))

    // Stable within an act: no scene change where there shouldn't be one.
    expect(pour[0]).toBe(pour[1])
    expect(stir[0]).toBe(stir[1])
    expect(bake[0]).toBe(bake[1])

    // ...and all three acts are genuinely different drawings.
    expect(new Set([pour[0], stir[0], bake[0]]).size).toBe(3)
  })

  it('fills the progress bar from empty to full', () => {
    expect(html('progress_bar', 0)).toContain('width: 0%')
    expect(html('progress_bar', 1)).toContain('width: 100%')
  })
})
