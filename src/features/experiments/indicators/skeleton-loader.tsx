import { cn } from '@/lib/utils'

/**
 * A shimmering placeholder shaped like the content that is coming.
 *
 * The layout deliberately mirrors `loaded-content.tsx` block for block — title,
 * byline, six paragraphs of uneven length. That correspondence IS the mechanism
 * under test: a skeleton is meant to reduce perceived wait by predicting what
 * will arrive, so one that didn't match would be testing a weaker version of
 * the idea. Edit the two together.
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
      {/*
        Twice the bar's width, swept across it by `transform` — see the shimmer
        keyframes in index.css for why the width and the keyframe offsets belong
        together. The gradient fills the element rather than tiling it, so there
        is no repeating pattern left to fall out of step with the travel.
      */}
      <div className="absolute inset-y-0 left-0 w-[200%] animate-[shimmer_1.1s_linear_infinite] bg-gradient-to-r from-transparent via-foreground/15 to-transparent" />
    </div>
  )
}

/**
 * One paragraph's worth of lines.
 *
 * The odd spacing is the point: a body line in `loaded-content.tsx` is
 * `text-xs` on `leading-relaxed` = 12px × 1.625 = **19.5px**, so a 10px bar
 * needs 9.5px after it to sit on the same pitch. Round it to the 10px the
 * spacing scale offers and each bar drifts half a pixel further from the line
 * it stands in for — nearly half a line by the bottom of the frame, which is
 * exactly the correspondence a skeleton screen is trading on.
 */
function Lines({ widths }: { widths: string[] }) {
  return (
    <div className="space-y-[9.5px]">
      {widths.map((w, i) => (
        <Bar key={i} className={cn('h-2.5', w)} />
      ))}
    </div>
  )
}

export function SkeletonLoader() {
  return (
    // h-full so it starts at the TOP of the frame, where the article it stands
    // in for will appear. Centred, it floated in the middle of the canvas and
    // predicted nothing about the incoming layout — which is the one job a
    // skeleton has.
    //
    // The bars then overflow that height and are clipped by the canvas, exactly
    // as the article is: the skeleton has to promise a page continuing below
    // the fold, because that is what arrives.
    //
    // max-w-sm matches the article's column, so the bars sit where the text will.
    <div className="mx-auto h-full w-full max-w-sm space-y-2">
      {/* h4 title */}
      <Bar className="h-5 w-2/3" />
      {/* byline */}
      <Bar className="h-3 w-24" />
      {/* Six paragraphs, line counts and ragged last lines following the real
          text block for block.

          21.5px between groups, not the article's 12px: a bar is 10px of a
          19.5px line slot, so the gap has to carry the 9.5px the last bar of a
          paragraph leaves unused before the 12px (space-y-3) that actually
          separates the paragraphs. */}
      <div className="space-y-[21.5px]">
        <Lines widths={['w-full', 'w-full', 'w-full', 'w-3/4']} />
        <Lines widths={['w-full', 'w-full', 'w-2/3']} />
        <Lines widths={['w-full', 'w-full', 'w-full', 'w-full', 'w-4/5']} />
        <Lines widths={['w-full', 'w-full', 'w-full', 'w-full', 'w-1/2']} />
        <Lines widths={['w-full', 'w-full', 'w-full', 'w-5/6']} />
        <Lines widths={['w-full', 'w-full', 'w-2/3']} />
      </div>
    </div>
  )
}
