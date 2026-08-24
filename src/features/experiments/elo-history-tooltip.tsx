import type { TooltipContentProps } from 'recharts'

import { rankByValue } from '@/features/experiments/elo-ranking'
import { cn } from '@/lib/utils'
import type { ExperimentVariant } from '@/lib/data/types'

/**
 * Row height in px, and the stride the transform below counts in.
 *
 * Hard-coded rather than measured because it is what makes the animation
 * possible without any layout bookkeeping: every row being the same known
 * height is what lets a row be moved to rank `n` by translating it, with no
 * `getBoundingClientRect` and no FLIP. It must stay in step with the `h-5` on
 * each row, and the row container must have no gap.
 */
const ROW_HEIGHT = 20

/**
 * The hover readout for the Elo history chart: every loading state's rating at
 * one matchup, ranked highest first, animating as the ranking changes.
 *
 * Bespoke rather than shadcn's `ChartTooltipContent`, which cannot do either
 * half of that. Recharts only applies `itemSorter` inside its *own* default
 * tooltip — `Tooltip` hands a custom `content` the payload filtered but
 * unsorted — so the ranking has to happen here. And shadcn keys its rows by
 * array index, so a reorder rewrites text in place instead of moving nodes,
 * leaving nothing for a transition to act on. The chrome below is copied from
 * it verbatim so this still looks like every other tooltip on the site.
 *
 * Rows are laid out in the variants' declared order and displaced to their
 * ranked slot with a transform. Keeping them in normal flow — rather than
 * absolutely positioning them — is what lets the box size itself to its longest
 * label, since absolutely positioned rows contribute no width.
 */
export function EloHistoryTooltip({
  active,
  payload,
  variants,
}: Partial<TooltipContentProps<number, string>> & {
  variants: ExperimentVariant[]
}) {
  if (!active || !payload?.length) return null

  const byId = new Map(payload.map((item) => [String(item.dataKey), item]))
  const shown = variants.filter((v) => byId.has(v.id))
  if (!shown.length) return null

  const ranks = rankByValue(
    shown.map((v) => v.id),
    Object.fromEntries(shown.map((v) => [v.id, Number(byId.get(v.id)?.value)])),
  )

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      {/*
        Read off the row rather than from the `label` recharts passes: shadcn's
        own header resolves a non-string axis value through the chart config,
        which would print a loading state's name where the matchup count goes.
        The count is a number, so it would take exactly that path.
      */}
      <div className="font-medium">
        After {payload[0]?.payload?.matchCount ?? 0} matchups
      </div>

      <div className="grid">
        {shown.map((v, i) => {
          const item = byId.get(v.id)
          return (
            <div
              // Keyed by variant, never by position — a row has to be the same
              // DOM node before and after a reorder for it to animate between
              // them rather than blink.
              key={v.id}
              data-slot="elo-row"
              className={cn(
                'flex h-5 items-center gap-2',
                'transition-transform duration-200 ease-out motion-reduce:transition-none',
              )}
              style={{
                transform: `translateY(${((ranks.get(v.id) ?? i) - i) * ROW_HEIGHT}px)`,
              }}
            >
              <div
                className="h-3.5 w-1 shrink-0 rounded-[2px]"
                style={{ backgroundColor: item?.color }}
              />
              <span className="text-muted-foreground">{v.label}</span>
              <span className="ml-auto pl-2 font-mono font-medium text-foreground tabular-nums">
                {Number(item?.value).toLocaleString()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
