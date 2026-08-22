import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

/**
 * Six categorical hues, one per loading state, in fixed slot order.
 *
 * Declared here rather than as `--chart-*` tokens in `index.css` on purpose.
 * The site palette is deliberately achromatic — it reserves its only two
 * chromatic tokens for signed values — and its `--chart-1..5` ramp is five
 * greys, identical in light and dark, which six overlapping lines cannot be
 * read from. shadcn's `ChartConfig` takes a per-series `{ light, dark }` pair
 * and `ChartStyle` emits the `.dark` rule for it, so these still follow the
 * theme without the rest of the site gaining colour it does not want.
 *
 * Validated as a set (not picked by eye) against this card's real surfaces,
 * white and `oklch(0.205 0 0)`: every adjacent pair clears the colour-blind
 * separation and normal-vision floors in both themes. Three of the light steps
 * fall below 3:1 against white, which is allowed only because identity is never
 * carried by colour alone here — the legend labels every line, the standings
 * name every row, and the swatch never has to be read on its own.
 * Re-run the check before touching any of these.
 *
 * In its own module because two views now paint from it: the chart strokes its
 * lines through `ChartStyle`, and the standings table draws a swatch per row.
 * One array, so a hue can never mean two different loading states on one
 * screen.
 */
export const SERIES_COLORS = [
  { light: '#2a78d6', dark: '#3987e5' },
  { light: '#eb6834', dark: '#d95926' },
  { light: '#1baf7a', dark: '#199e70' },
  { light: '#eda100', dark: '#c98500' },
  { light: '#e87ba4', dark: '#d55181' },
  { light: '#008300', dark: '#008300' },
]

/**
 * The hue for a variant's declared position, wrapping if there are ever more
 * variants than colours.
 *
 * Declared position, never rank: keyed off the standings instead, every colour
 * would change the moment two loading states swapped places.
 */
export function seriesColorAt(index: number) {
  return SERIES_COLORS[index % SERIES_COLORS.length]
}

/**
 * One loading state's colour, as a chip.
 *
 * Paints from the pair directly rather than from the `--color-<id>` variables
 * `ChartStyle` emits, because those exist only while the chart itself is
 * mounted — and the standings outlive it in two ordinary cases: the chart's
 * history query is still loading, and an experiment with no matchups yet, where
 * the chart renders a sentence instead. Both would leave a table of invisible
 * swatches. The custom property is what carries the theme, since an inline
 * style cannot hold two values.
 *
 * aria-hidden throughout: it is a key back to the chart, and it always sits
 * beside the name it belongs to. Announced, it would be an unnamed colour in
 * front of every row.
 */
export function SeriesSwatch({
  index,
  className,
}: {
  index: number
  className?: string
}) {
  const { light, dark } = seriesColorAt(index)

  return (
    <span
      aria-hidden
      className={cn(
        'size-2.5 shrink-0 rounded-[2px] bg-[var(--swatch-light)] dark:bg-[var(--swatch-dark)]',
        className,
      )}
      style={
        { '--swatch-light': light, '--swatch-dark': dark } as CSSProperties
      }
    />
  )
}
