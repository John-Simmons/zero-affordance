import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A determinate bar filling in step with the run.
 *
 * Hand-rolled rather than using `ui/progress.tsx`: that component puts
 * `transition-all` on its indicator, which is right for values that jump but
 * wrong here — `progress` already updates every animation frame, so a CSS
 * transition would make the bar visibly lag its own data and finish late.
 * Arriving at 100% exactly when the content appears is the whole point of this
 * variant.
 */
export function ProgressBarIndicator({ progress }: { progress: number }) {
  const pct = clamp01(progress) * 100

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
