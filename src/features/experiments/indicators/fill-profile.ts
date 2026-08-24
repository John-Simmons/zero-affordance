import { clamp01 } from '@/features/experiments/indicators/clamp'
import { hashString } from '@/lib/visitor'

/**
 * The uneven pace a progress bar fills at.
 *
 * A real download does not advance at a constant rate: it stalls, then catches
 * up in a burst. This module turns the runner's linear clock into that shape —
 * a monotonic time-warp, pinned at both ends, that is a pure function of the
 * matchup's `seed`.
 *
 * Deliberately a time-warp rather than a second clock. `useTimedProgress` is
 * the single clock for a matchup and owns `onDone`, and the Elo handicap
 * corrects for the exact duration the matchup assigned — so the bar may change
 * how the wait *looks*, never how long it *lasts*.
 *
 * The pace is built as a SPEED curve and then integrated, rather than as a
 * position curve directly. That ordering is the whole reason the motion reads
 * as organic: it is what lets the speed ramp between a stall and a surge
 * instead of switching between them, and a discontinuous speed is exactly what
 * the eye reads as jerk. The first version of this file interpolated position
 * piecewise-linearly, which changes speed instantaneously at every slice
 * boundary — about 1.4 percentage points of acceleration in a single frame,
 * against 0.15 now.
 */

/**
 * Equal slices of TIME the run is cut into, each given its own speed.
 *
 * Six over the 1800–3600ms duration band is 300–600ms a slice: long enough that
 * a slow one reads as a pause rather than a stutter, short enough that a run
 * still contains several changes of pace.
 *
 * It was eight, at 225–450ms a slice, and the pace changed often enough to read
 * as jarring rather than as a connection finding its rate. Fewer, longer slices
 * also mean fewer draws per run, so a run is likelier to draw no slow slice at
 * all — which is what `STALL_SPEED` is for.
 */
const SEGMENTS = 6

/**
 * The speed band a slice is drawn from.
 *
 * It is the ~25x RATIO that matters, not the absolute numbers — the curve is
 * normalised below, so only relative sizes survive. That ratio is what makes a
 * slow slice read as a genuine stall next to a fast one rather than as a
 * slightly lazy bar. It is wider than the ratio that actually reaches the
 * screen (about 3–9x between the slowest and fastest slice of a run) because
 * the ramping below deliberately blends each slice toward its neighbours.
 *
 * The floor is a crawl rather than a halt: at the bottom of the band the bar
 * still gains about 3.5 percentage points a second, so a stall reads as barely
 * moving instead of as frozen. It was half that, and a dead-stopped bar looks
 * like a bug rather than like a slow connection — which is a confound in an
 * experiment about perceived duration, the same reason `OPENING_SPEED` exists.
 */
const MIN_SPEED = 0.12
const MAX_SPEED = 3

/**
 * The slowest the FIRST slice may be, as a fraction of the band.
 *
 * Roughly average, so the bar always moves off zero straight away. A bar
 * sitting at 0% for the first 300ms reads as broken rather than as slow, and in
 * an experiment measuring perceived duration "looks broken" is a confound, not
 * realism.
 */
const OPENING_SPEED = 1

/**
 * The fastest the run's SLOWEST slice may be, as a fraction of the band.
 *
 * The mirror of `OPENING_SPEED`, and load-bearing only because there are six
 * slices rather than eight: with the squared draw below, a six-slice run has a
 * real chance of drawing every slice near or above average, and it then fills
 * at a near-constant rate — the exact failure this module exists to prevent.
 * Capping whichever slice came out slowest guarantees every run has one visible
 * pause in it.
 *
 * Only bites on the runs that need it. Most already draw something well under
 * this, and for those the cap changes nothing at all.
 *
 * Applied to the body of the run rather than to the opening slice, which
 * `OPENING_SPEED` has already floored for the opposite reason.
 */
const STALL_SPEED = 0.45

/**
 * How much of the gap between two slices is spent changing speed.
 *
 * The rest is spent holding, so a stall is genuinely flat and a surge genuinely
 * sustained — 0.6 rounds the corner between them without smoothing the whole
 * run into one long ease. Lower reads as more abrupt; at 1 the speed is always
 * either accelerating or decelerating and never simply holding, which loses the
 * "stuck, then moving" character this is for.
 */
const RAMP = 0.6

/**
 * Resolution the speed curve is integrated at.
 *
 * 48 samples a slice is 288 over a run, comfortably finer than the 110–220
 * frames a run actually renders in, so the table is never the thing quantising
 * the motion. It is built once per appearance, not once per frame. It was 32,
 * which cleared eight slices' worth of frames but not six.
 */
const STEPS_PER_SEGMENT = 48

/**
 * A draw in [0, 1) for slice `i` of appearance `s`.
 *
 * `hashString` alone is not enough here, and this is not a theoretical worry —
 * it is what the first version of this file actually did. FNV-1a finishes by
 * folding in the last byte and multiplying, so inputs differing only in their
 * final character stay correlated in the high bits the draw is read from:
 * `"3:0"` through `"3:7"` produced eight almost equal values, and every bar
 * filled at a near-constant rate apart from its opening slice — the exact thing
 * this module exists to prevent, arriving silently.
 *
 * So `hashString` is used only to fold the seed into a state, and each slice is
 * then stepped by the golden-ratio constant and run through a murmur3-style
 * finalizer, which avalanches adjacent states into unrelated outputs.
 */
function draw(s: number, i: number): number {
  let x = (hashString(`fill:${s}`) + Math.imul(i, 0x9e3779b9)) >>> 0
  x ^= x >>> 16
  x = Math.imul(x, 0x21f0aaad)
  x ^= x >>> 15
  x = Math.imul(x, 0x735a2d97)
  x ^= x >>> 15
  return (x >>> 0) / 2 ** 32
}

/**
 * The speed of each time slice, for one appearance.
 *
 * Derived from `seed` rather than drawn here, and this is the load-bearing
 * constraint on the whole module: the runner mounts an indicator TWICE per
 * appearance — the stimulus canvas, then a fresh mount in the vote-time recap —
 * and re-renders it every animation frame in between. A profile rolled inside
 * the component would differ between those two mounts and change under the
 * participant mid-run. See the note on `LoadingIndicator` in `index.ts`.
 *
 * Squared rather than uniform, so most slices land near the slow end and one or
 * two burst. That is the shape a real transfer has; a uniform draw gives a bar
 * that merely wavers.
 *
 * The two clamps are the run's guarantees, one at each end: it always moves off
 * zero, and it always stalls somewhere after that. Both are applied to the
 * drawn speeds rather than to the draws themselves, so a run that would have
 * satisfied them on its own is left exactly as drawn.
 *
 * Defensive about `seed` in the same spirit as `quoteFor` — every indicator is
 * expected to be total over nonsense input.
 */
function speedProfile(seed: number): number[] {
  const s = Number.isFinite(seed) ? Math.trunc(seed) : 0

  const speeds = Array.from({ length: SEGMENTS }, (_, i) => {
    const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * draw(s, i) ** 2
    return i === 0 ? Math.max(speed, OPENING_SPEED) : speed
  })

  // Whichever body slice came out slowest is the run's stall, so it is the one
  // the cap applies to — capping any other would flatten the contrast instead
  // of deepening it.
  let slowest = 1
  for (let i = 2; i < SEGMENTS; i++) {
    if (speeds[i] < speeds[slowest]) slowest = i
  }
  speeds[slowest] = Math.min(speeds[slowest], STALL_SPEED)

  return speeds
}

/**
 * How fast the bar is filling at `t`, a fraction of the run.
 *
 * Each slice's speed is anchored at the slice's CENTRE rather than held across
 * its whole width, so the value spends the middle of a slice at that speed and
 * the space between two centres moving from one to the other. Anchoring at
 * centres is also what keeps the opening and closing half-slices flat — there
 * is no neighbour beyond them to ramp toward, which is why the ends clamp.
 *
 * Smoothstepped rather than linear across the ramp: it leaves the speed with no
 * corner at either end of a transition, so the bar eases out of a stall instead
 * of jolting out of one.
 */
function speedAt(t: number, profile: number[]): number {
  const x = t * SEGMENTS - 0.5
  const i = Math.floor(x)
  const at = (n: number) => profile[Math.min(Math.max(n, 0), SEGMENTS - 1)]

  // Held flat either side of the ramp, which occupies the middle `RAMP` of the
  // gap between the two centres.
  const r = clamp01((x - i - (1 - RAMP) / 2) / RAMP)
  return at(i) + (at(i + 1) - at(i)) * (r * r * (3 - 2 * r))
}

/**
 * The fill curve for one appearance: cumulative fill, sampled evenly in time
 * and normalised so it runs exactly 0 → 1.
 *
 * Integrated numerically rather than in closed form. The smoothstep ramp has an
 * exact integral, but it is an unpleasant one to read and the table has to be
 * built anyway to keep per-frame lookup cheap — this way the speed curve above
 * can be adjusted freely without anyone having to redo calculus to match.
 *
 * Monotonic, because every speed is positive. The endpoints are exact — 0 at
 * the start by construction, and 1 at the end because the total is what every
 * entry is divided by. Both matter: a bar that went backwards would contradict
 * what a determinate bar promises, and one that did not land precisely on 100%
 * would leave the recap panel showing a not-quite-full bar at the moment the
 * content arrived.
 */
export function fillCurve(seed: number): number[] {
  const profile = speedProfile(seed)
  const steps = SEGMENTS * STEPS_PER_SEGMENT
  const cumulative = [0]
  let total = 0

  for (let k = 0; k < steps; k++) {
    // Sampled at the midpoint of each step: for a curve that is mostly ramps,
    // the midpoint rule is a good deal more accurate than either endpoint.
    total += speedAt((k + 0.5) / steps, profile)
    cumulative.push(total)
  }

  return cumulative.map((v) => v / total)
}

/**
 * How full the bar is at `progress`, given a curve from `fillCurve`.
 *
 * Linear between table entries, which is imperceptible at this resolution —
 * there are more entries than the run has frames.
 *
 * Takes the curve rather than the seed so the caller can build it once per
 * appearance instead of once per frame.
 */
export function fillAt(progress: number, curve: number[]): number {
  const t = clamp01(progress) * (curve.length - 1)
  // Clamped to the last cell so `progress === 1` indexes a real one; `frac` is
  // then exactly 1 and the result is the curve's final entry, which is 1.
  const i = Math.min(Math.floor(t), curve.length - 2)
  const frac = t - i

  return curve[i] + (curve[i + 1] - curve[i]) * frac
}

/** `fillAt` and `fillCurve` in one call, for callers not rendering a run. */
export function jitteredProgress(progress: number, seed: number): number {
  return fillAt(progress, fillCurve(seed))
}
