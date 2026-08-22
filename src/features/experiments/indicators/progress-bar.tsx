import { useMemo } from 'react'

import { clamp01 } from '@/features/experiments/indicators/clamp'
import {
  fillAt,
  fillCurve,
} from '@/features/experiments/indicators/fill-profile'

/**
 * A determinate bar filling in step with the run — unevenly, the way a real one
 * does.
 *
 * The fill SPEED varies through the appearance: some stretches crawl, others
 * catch up in a burst. Nothing loads at a constant rate, and a perfectly even
 * bar is a recognisably synthetic stimulus — which matters here, because how a
 * progress bar feels is the exact thing this variant is rated on. The pace is a
 * time-warp over the runner's clock, not a clock of its own: it changes how the
 * wait looks and never how long it lasts, so the bar still reaches 100% at the
 * precise moment the matchup's duration is up. See `fill-profile.ts`.
 *
 * The profile comes from `seed`, a prop, rather than from a draw in here. The
 * runner mounts this TWICE per appearance — the stimulus canvas, then a fresh
 * mount in the vote-time recap — and re-renders it every animation frame in
 * between, so anything rolled internally would differ between the two mounts
 * and strobe under StrictMode's double-invoked render.
 *
 * Hand-rolled rather than using `ui/progress.tsx`: that component puts
 * `transition-all` on its indicator, which is right for values that jump but
 * wrong here — `progress` already updates every animation frame, so a CSS
 * transition would make the bar visibly lag its own data and finish late.
 * Arriving at 100% exactly when the content appears is the whole point of this
 * variant. The uneven pace does not change that: the warp ramps between speeds
 * rather than switching between them, so it is already smooth frame to frame
 * and has nothing to smooth over.
 */
export function ProgressBarIndicator({
  progress,
  seed,
}: {
  progress: number
  seed: number
}) {
  // Once per appearance, not once per frame: this re-renders ~150 times over a
  // run and the curve depends on nothing else.
  const curve = useMemo(() => fillCurve(seed), [seed])
  // The label reads off the same warped value as the bar. A percentage ticking
  // up smoothly beside a bar that was stalling would read as a bug.
  const pct = clamp01(fillAt(progress, curve)) * 100

  return (
    <div className="w-full max-w-sm space-y-2">
      <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-center text-xs text-muted-foreground tabular-nums">
        {Math.floor(pct)}%
      </p>
    </div>
  )
}
