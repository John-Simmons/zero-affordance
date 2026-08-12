import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { loadingIndicators } from '@/features/experiments/indicators'
import { seedExperiments } from '@/lib/data/seed'

const ids = Object.keys(loadingIndicators)

/** Indicators that must visibly track progress, vs those that may ignore it. */
const DETERMINATE = ['progress_bar', 'baking']

function html(id: string, progress: number): string {
  const Indicator = loadingIndicators[id]
  const { container } = render(<Indicator progress={progress} />)
  return container.innerHTML
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

  it.each(ids.filter((id) => !DETERMINATE.includes(id) && id !== 'quote'))(
    '%s is indeterminate — output does not depend on progress',
    (id) => {
      expect(html(id, 0)).toEqual(html(id, 1))
    },
  )

  it('renders blank as genuinely nothing', () => {
    expect(html('blank', 0.5)).toBe('')
  })

  it('keeps the quote itself fixed, animating only the ellipsis', () => {
    // A quote that changed between runs would make the variant inconsistent and
    // put noise into its rating.
    const at = (p: number) => html('quote', p)
    expect(at(0)).toContain('Dieter Rams')
    expect(at(1)).toContain('Dieter Rams')
    expect(at(0.35)).not.toEqual(at(0.5))
  })

  it('fills the progress bar from empty to full', () => {
    expect(html('progress_bar', 0)).toContain('width: 0%')
    expect(html('progress_bar', 1)).toContain('width: 100%')
  })
})
