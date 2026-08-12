import { cn } from '@/lib/utils'

/**
 * A shimmering placeholder shaped like the content that is coming.
 *
 * The layout deliberately mirrors `loaded-content.tsx` block for block — title,
 * byline, two paragraphs. That correspondence IS the mechanism under test: a
 * skeleton is meant to reduce perceived wait by predicting what will arrive, so
 * one that didn't match would be testing a weaker version of the idea. Edit the
 * two together.
 *
 * Indeterminate — the shimmer runs on its own loop and ignores `progress`,
 * because a real skeleton conveys shape, not completion.
 */
function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded bg-foreground/10',
        className,
      )}
    >
      <div className="absolute inset-0 animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-foreground/15 to-transparent bg-[length:200%_100%]" />
    </div>
  )
}

export function SkeletonLoader() {
  return (
    <div className="w-full space-y-2">
      {/* h4 title */}
      <Bar className="h-4 w-2/3" />
      {/* byline */}
      <Bar className="h-2 w-24" />
      {/* two paragraphs, matching LoadedContent's space-y-1.5 */}
      <div className="space-y-1.5 pt-1">
        <Bar className="h-2.5 w-full" />
        <Bar className="h-2.5 w-11/12" />
        <Bar className="h-2.5 w-4/5" />
      </div>
      <div className="space-y-1.5 pt-1">
        <Bar className="h-2.5 w-full" />
        <Bar className="h-2.5 w-3/4" />
      </div>
    </div>
  )
}
