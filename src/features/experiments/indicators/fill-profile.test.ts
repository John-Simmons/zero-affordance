import { describe, expect, it } from 'vitest'

import {
  fillAt,
  fillCurve,
  jitteredProgress,
} from '@/features/experiments/indicators/fill-profile'
import { roundRobinPairs } from '@/lib/data/aggregate'
import { seedExperiments } from '@/lib/data/seed'

/** Every seed a full run hands out, the same way the runner builds them. */
const RUN_SEEDS = roundRobinPairs(
  seedExperiments.find((e) => e.id === 'exp_loading_perception')!.variants,
).map((_, i) => i)

/** Samples across the whole run, dense enough to catch a step backwards. */
const SAMPLES = Array.from({ length: 201 }, (_, i) => i / 200)

/**
 * Roughly the frames a mid-band matchup renders in: 2700ms at 60fps. The pace
 * is judged at this resolution, so it is the one the smoothness test below has
 * to measure at.
 */
const FRAMES = 162

/** How far the bar moves on each frame of a run, as fractions of the whole. */
function frameDeltas(seed: number): number[] {
  const curve = fillCurve(seed)
  return Array.from(
    { length: FRAMES },
    (_, k) => fillAt((k + 1) / FRAMES, curve) - fillAt(k / FRAMES, curve),
  )
}

describe('fill-profile', () => {
  /**
   * The recap panel mounts the bar at `progress={1}` and the content arrives at
   * the same instant, so anything short of exactly 1 shows a not-quite-full bar
   * at the moment the wait ended. Exact by construction — every entry is
   * divided by the curve's own total — so this asserts equality, not closeness.
   */
  it('starts at exactly empty and ends at exactly full', () => {
    for (const seed of RUN_SEEDS) {
      expect(jitteredProgress(0, seed)).toBe(0)
      expect(jitteredProgress(1, seed)).toBe(1)
    }
  })

  it('never goes backwards', () => {
    // A determinate bar promises the wait is being consumed. Losing ground
    // breaks that promise, and would be the one failure mode of a warp that is
    // otherwise invisible in the endpoints above.
    for (const seed of RUN_SEEDS) {
      const curve = fillCurve(seed)
      let previous = -1
      for (const p of SAMPLES) {
        const value = fillAt(p, curve)
        expect(value).toBeGreaterThanOrEqual(previous)
        previous = value
      }
    }
  })

  it('gives the same appearance the same pace, on a fresh mount', () => {
    // The runner mounts the bar twice per appearance — the stimulus canvas,
    // then the vote-time recap. If those disagreed the recap would be
    // reminding the participant of a bar that never played.
    for (const p of [0.17, 0.5, 0.83]) {
      expect(jitteredProgress(p, 7)).toBe(jitteredProgress(p, 7))
      expect(jitteredProgress(p, 7)).not.toBe(jitteredProgress(p, 8))
    }
  })

  it('actually stalls and surges', () => {
    // The point of the whole module, and the one test that would catch it
    // silently regressing to a constant rate — every other test here passes for
    // an evenly filling bar.
    //
    // Measured on the ground actually covered in each sixth of the run rather
    // than on the speeds behind it, because those are only the control points:
    // the ramping blends each toward its neighbours, so what a slice is worth
    // on screen is not what it was drawn as. Bucketed to match `SEGMENTS`:
    // buckets that straddled slice boundaries would average a stall together
    // with the surge beside it and understate both.
    //
    // 3x, against a spread that runs from about 3.3x on the flattest of these
    // seeds to 8.8x on the liveliest. A regression to linear scores 1x, and the
    // correlated-hash bug this module was born with scored under 2x.
    //
    // The floor of that spread is `STALL_SPEED`'s doing, not luck: two of these
    // fifteen seeds draw six near-average slices and would fill almost evenly
    // without it, scoring about 1.6x.
    for (const seed of RUN_SEEDS) {
      const shares = Array.from(
        { length: 6 },
        (_, i) =>
          jitteredProgress((i + 1) / 6, seed) - jitteredProgress(i / 6, seed),
      )
      expect(Math.max(...shares) / Math.min(...shares)).toBeGreaterThan(3)
    }
  })

  it('changes pace smoothly rather than snapping between speeds', () => {
    // The bar is meant to stall and surge, not to jerk. What the eye reads as
    // jerk is a discontinuous SPEED, so this bounds acceleration: how much the
    // per-frame step may itself change from one frame to the next.
    //
    // The first version of this module interpolated position piecewise-linearly
    // and switched speed instantaneously at every slice boundary, scoring about
    // 1.4 points. Ramping the speed instead brings it under 0.2.
    for (const seed of RUN_SEEDS) {
      const deltas = frameDeltas(seed)
      const acceleration = deltas
        .slice(1)
        .map((d, k) => Math.abs(d - deltas[k]) * 100)
      expect(Math.max(...acceleration)).toBeLessThan(0.5)
    }
  })

  it('moves off zero straight away', () => {
    // A bar that sits at 0% for its first slice reads as broken rather than as
    // slow, and "looks broken" is a confound in an experiment about perceived
    // duration — so the opening slice is floored.
    for (const seed of RUN_SEEDS) {
      // A sixth of the way in — one slice, the one the floor applies to.
      expect(jitteredProgress(1 / 6, seed)).toBeGreaterThan(0.03)
    }
  })

  it('survives any seed', () => {
    // Same defensive contract as `quoteFor`: a negative first tick once took
    // the whole page down, and every indicator is expected to be total.
    for (const seed of [-1, 0, 1.5, NaN, Infinity, -Infinity, 1e9]) {
      expect(jitteredProgress(0, seed)).toBe(0)
      expect(jitteredProgress(0.5, seed)).toBeGreaterThan(0)
      expect(jitteredProgress(1, seed)).toBe(1)
    }
  })

  it('survives any progress value', () => {
    const curve = fillCurve(3)
    for (const p of [-1, -0.001, 1.001, 2, NaN, Infinity, -Infinity]) {
      const value = fillAt(p, curve)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})
