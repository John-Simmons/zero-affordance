import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A line of text to read while you wait, with an animating ellipsis.
 *
 * The quote is fixed rather than rotating: if it changed between runs the
 * variant itself would be inconsistent, and some of the rating spread would be
 * measuring which quote you happened to get rather than the format.
 *
 * Only the ellipsis tracks `progress`, and it cycles rather than advancing to a
 * fixed end — so this signals activity without implying completion.
 */
const QUOTE = 'Good design is as little design as possible.'
const ATTRIBUTION = 'Dieter Rams'

export function QuoteIndicator({ progress }: { progress: number }) {
  // Cycles roughly six times over a run, independent of how long that run is.
  const dots = Math.floor(clamp01(progress) * 18) % 4

  return (
    <figure className="max-w-md space-y-3 text-center">
      <blockquote className="text-base leading-relaxed text-balance text-foreground">
        “{QUOTE}”
      </blockquote>
      <figcaption className="text-xs text-muted-foreground">
        {ATTRIBUTION}
      </figcaption>
      {/* Fixed width so a changing dot count can never reflow the line above. */}
      <span className="block font-mono text-sm whitespace-pre text-muted-foreground">
        {'.'.repeat(dots).padEnd(3, ' ')}
      </span>
    </figure>
  )
}
