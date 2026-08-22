import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { K_FACTOR, START_RATING } from '@/lib/data/aggregate'
import type { EloAggregate, EloRating } from '@/lib/data/types'

/** Tailwind's `sm`. Hand-kept — v4 has no JS config to read the value from. */
const SM_UP = '(min-width: 40rem)'

/**
 * The participant's own effect on one rating.
 *
 * The explicit sign carries the meaning on its own, so colour is never the only
 * signal — this reads correctly for colour-blind participants and in greyscale.
 */
function RatingDelta({ delta }: { delta: number }) {
  const rounded = Math.round(delta)
  if (rounded === 0) {
    return <span className="text-muted-foreground">(±0)</span>
  }
  return (
    <span className={rounded > 0 ? 'text-success' : 'text-destructive'}>
      ({rounded > 0 ? '+' : '−'}
      {Math.abs(rounded)})
    </span>
  )
}

/**
 * What the W–D–L column is counting.
 *
 * The initials are the compression that makes the column fit; this is where
 * they get expanded, and expanding them is all it does — what the three
 * numbers mean against the rating beside them is the paragraph's job, not a
 * tooltip's.
 *
 * A tooltip, not a line of copy under the table: that paragraph is already
 * carrying the rating's explanation, and a second one would push the table
 * itself below the fold on a phone. Touch gets no tooltip (Radix tooltips do
 * not open on tap), which is the trade for keeping the column at four
 * characters.
 */
function RecordTip() {
  return (
    <Tooltip>
      {/*
        The label spells out the initials rather than saying "more
        information": for a screen reader this button IS the column's
        glossary entry, and "W–D–L, more information" explains nothing that
        "W–D–L" had not already failed to explain.
      */}
      <TooltipTrigger
        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        aria-label="What wins, draws and losses mean"
      >
        <Info aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>
        Wins–draws–losses across every matchup this loading state has appeared
        in.
      </TooltipContent>
    </Tooltip>
  )
}

/**
 * The rating, explained where it is first named.
 *
 * The paragraph above says the standings come from an Elo rating; this is what
 * that sentence would have to become to be self-contained, and it is five
 * bullets long even trimmed to the bone. Inline it would bury the table under
 * an essay nobody asked for, and as a link off the page it would be read by no
 * one mid-results.
 *
 * A popover rather than the tooltips elsewhere on this screen, because this is
 * the one explanation on the page that is worth reading on a phone: tooltips
 * do not open on tap, and "how is this number decided" is the question a
 * ranking invites from every reader, not just the curious hovering one.
 *
 * The numbers come from the constants the ratings are actually computed with,
 * so retuning the model cannot leave this describing the old one.
 */
function EloExplainer() {
  const [open, setOpen] = useState(false)
  const isWide = useMediaQuery(SM_UP)

  /*
    An element rather than a component: `asChild` renders through Radix's Slot,
    which merges the trigger's own props onto whatever it is given, and a
    wrapper component that accepts only its own props would silently drop them.

    Same dotted underline `IndicatorPreview` uses, for the same reason — it is
    what says this text opens something. `align-baseline` is the one addition:
    a `Button` is inline-flex, and dropped mid-sentence without it, it sits a
    shade below the line it belongs to.

    Visible text is the term alone, so the sentence still reads as a sentence;
    the sr-only tail is what makes the accessible name describe the action.
  */
  const trigger = (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 align-baseline text-sm font-normal text-foreground underline decoration-dotted underline-offset-4"
    >
      Elo rating
      <span className="sr-only"> — how this rating is calculated</span>
    </Button>
  )

  if (isWide) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        {/*
          Radix gives this role="dialog", and unlike Dialog its title slot is
          styling only — nothing wires it up as the accessible name. Hence the
          explicit label; without it the dialog announces as unnamed.
        */}
        <PopoverContent className="w-96" aria-label={EXPLAINER_TITLE}>
          <PopoverHeader>
            <PopoverTitle>{EXPLAINER_TITLE}</PopoverTitle>
          </PopoverHeader>
          <EloExplainerBody />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{EXPLAINER_TITLE}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0">
          <EloExplainerBody />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

const EXPLAINER_TITLE = 'How the Elo rating is calculated'

/** The rules, shared by the popover and the drawer. */
function EloExplainerBody() {
  return (
    <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
      <li>
        Every loading state started at {START_RATING} and was adjusted after
        each vote, so the ratings only mean something relative to each other.
        There is no absolute benchmark.
      </li>
      <li>
        Each vote in the experiment moves points from the loser to the winner.
        Beating a higher-rated loading state wins more points.
      </li>
      <li>
        One vote can move a rating by at most {K_FACTOR} points, so the
        standings settle rather than swing on recent votes.
      </li>
      <li>
        A loading state that is voted as feeling faster when it is actually
        faster wins fewer points than if it was voted as feeling faster when it
        was actually slower than its opponent.
      </li>
      <li>A matchup called too close splits the points.</li>
    </ul>
  )
}

export function EloResults({
  aggregate,
  isLoading,
  deltas,
  voteCount,
  renderLabel,
  chart,
}: {
  aggregate: EloAggregate | undefined
  isLoading: boolean
  /** This run's effect per variant. Omitted when it can't be established. */
  deltas?: Record<string, number>
  /**
   * How many votes this run recorded. Passed in rather than written into the
   * copy: the count is C(variants, 2), so it changed from ten to fifteen the
   * moment a sixth indicator was added, and a hardcoded number goes stale
   * silently.
   */
  voteCount?: number
  /**
   * Wraps the variant name, for callers that can make it do more than sit
   * there. Defaults to plain text.
   *
   * Inverted rather than reaching for the indicator components directly: this
   * table renders from an `EloAggregate` and nothing else, and an aggregate
   * carries no `description` and no duration. Only the caller holds the seeded
   * variants, so only the caller can build a preview worth showing.
   */
  renderLabel?: (rating: EloRating) => ReactNode
  /**
   * A second view of the same standings, stacked under the table.
   *
   * Passed in rather than built here, for the same reason as `renderLabel`
   * above: this component renders from an `EloAggregate` and nothing else, and
   * a trajectory needs the seeded variants the aggregate doesn't carry. Omitted,
   * the table renders alone — the standings are complete without it.
   */
  chart?: ReactNode
}) {
  if (isLoading || !aggregate) return <Skeleton className="h-64 w-full" />

  /*
    Capped rather than full-width. The card is max-w-4xl to give the stimulus
    canvas room, but a handful of short columns stretched across that leaves the
    unconstrained name column absorbing ~350px of empty space, pushing the rating
    far from the label it belongs to.

    Two thirds of the card rather than the half it was: half left the columns
    tight enough that a long state name wrapped, and the table read as a narrow
    inset rather than as the page's main answer.

    A percentage rather than a fixed cap, so it stays two thirds at every width
    the card takes — but only from sm up. Below that the card is ~310px and two
    thirds of it is no table at all, so the phone keeps the full width it
    already had.

    No overflow wrapper here — shadcn's Table already renders one.

    Both numeric columns align left, against the convention for numbers, because
    the rating carries a trailing delta. Right-aligned, the pair was aligned as a
    unit, so a row ending "(±0)" and one ending "(−12)" put their ratings in
    different places — lined up with neither each other nor the "Elo rating"
    header. Aligned left, the rating leads the cell, so every rating and its
    header start on one edge whatever follows them.
  */
  const table = (
    <Table className="mx-auto w-full sm:max-w-2/3">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Loading state</TableHead>
          <TableHead className="w-28">Elo rating</TableHead>
          {/*
            w-24 rather than the w-20 the initials alone needed: `TableHead` is
            whitespace-nowrap, so a column too narrow for its own header does
            not wrap — it widens the table and takes the space from the name
            column silently.
          */}
          <TableHead className="w-24">
            <span className="flex items-center gap-1.5">
              W–D–L
              <RecordTip />
            </span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {aggregate.ratings.map((r, i) => (
          <TableRow key={r.variantId}>
            <TableCell className="text-muted-foreground tabular-nums">
              {i + 1}
            </TableCell>
            <TableCell className="font-medium">
              {renderLabel ? renderLabel(r) : r.label}
            </TableCell>
            <TableCell className="tabular-nums">
              {/*
                The width floor is what keeps the deltas aligned with each
                other and not merely the ratings: `tabular-nums` equalises
                digit widths but not digit counts, so a rating that ever fell
                to three figures would drag its delta a character left. It
                doubles as the gap, and the literal space keeps the cell
                reading "1520 (+12)" rather than "1520(+12)".
              */}
              <span className="inline-block min-w-10">
                {Math.round(r.rating)}
              </span>
              {deltas && (
                <>
                  {' '}
                  <RatingDelta delta={deltas[r.variantId] ?? 0} />
                </>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {r.wins}–{r.ties}–{r.losses}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    // space-y-6 rather than 4: the table and the chart are two sections now,
    // not a paragraph and its content.
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Below is the global ranking of loading states across{' '}
        {aggregate.totalMatches.toLocaleString()} matchups from{' '}
        {aggregate.totalParticipants.toLocaleString()}{' '}
        {aggregate.totalParticipants === 1 ? 'participant' : 'participants'} so
        far. The higher a loading state sits, the more often participants picked
        it as the one that felt faster than the state it was up against. These
        rankings are calculated with an <EloExplainer />, the same rating system
        used to rank chess players.
        {deltas &&
          voteCount !== undefined &&
          ` The bracketed figure is what your ${voteCount} votes just changed.`}
      </p>
      {table}
      {/*
        Stacked under the table rather than behind a tab beside it. The two
        answer different questions about one dataset — where each loading state
        ended up, and how it got there — and a tab strip meant nobody compared
        them, because seeing the second cost you the first.

        Table first because it is the precise answer; the chart is the context
        for it. The heading is not decoration: with the tab label gone, nothing
        else names this view, and an untitled chart under a table reads as an
        appendix to the table rather than as a reading of its own.

        Always mounted now, which suits recharts — it measures its container on
        mount, and a hidden one has no width to measure. That was the hazard the
        tab panels had to be careful about; stacking removes it.
      */}
      {chart && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Rating over time</h3>
          {chart}
        </div>
      )}
    </div>
  )
}
