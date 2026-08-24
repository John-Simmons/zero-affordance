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
import {
  K_FACTOR,
  MEAN_BASE_DURATION_MS,
  perceivedMs,
  START_RATING,
} from '@/lib/data/aggregate'
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
 * The rating, in milliseconds.
 *
 * Every rating is measured against {@link START_RATING} rather than against the
 * table's own average, and those are the same number by construction: each vote
 * moves points from one side to the other, so the six ratings always sum to
 * where they started and their mean never moves off 1500. Reading it as "versus
 * the field" is therefore exactly right, and needs no second pass over the rows
 * to work out what the field is.
 *
 * Rounded to 10ms. The conversion is a model estimate several steps removed
 * from anything anyone timed, and printing it to the millisecond would dress it
 * up as a measurement.
 *
 * The sign is spelled out for the same reason {@link RatingDelta} spells it
 * out, but this column is deliberately uncoloured: the rows are sorted by the
 * quantity it derives from, so a green top and a red bottom would be colouring
 * in the sort order.
 */
function PerceivedSaving({ rating }: { rating: number }) {
  const ms =
    Math.round(perceivedMs(rating - START_RATING, MEAN_BASE_DURATION_MS) / 10) *
    10

  if (ms === 0) return <span className="text-muted-foreground">±0ms</span>
  return (
    <span className="text-muted-foreground">
      {ms > 0 ? '+' : '−'}
      {Math.abs(ms)}ms
    </span>
  )
}

/**
 * Where the milliseconds come from.
 *
 * A tooltip like {@link RecordTip} rather than a popover like
 * {@link EloExplainer}: this is a footnote on a derived column, not the
 * question a ranking invites. The two numbers in it are read from the model's
 * own constants, so retuning the handicap cannot leave this quoting a rate the
 * ratings no longer use.
 */
function SavingTip() {
  const wait = (MEAN_BASE_DURATION_MS / 1000).toFixed(1)
  const perPoint = Math.round(perceivedMs(1, MEAN_BASE_DURATION_MS))

  return (
    <Tooltip>
      <TooltipTrigger
        className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        aria-label="How the milliseconds are worked out"
      >
        <Info aria-hidden className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Estimated from the ratings against the field average, not timed
        directly. The average load duration is {wait}s, with that as a baseline
        each Elo point is worth about {perPoint}ms.
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
    Full width. It was capped at two thirds of the card, which was the right
    answer when four short columns left the unconstrained name column absorbing
    ~350px of empty space and pushing the rating away from the label it belongs
    to. The milliseconds column is what closed that gap: five columns fill the
    card without the name column having to swallow the slack.

    No overflow wrapper here — shadcn's Table already renders one.

    Widths in twelfths, summing to one, rather than fixed pixels on four
    columns and nothing on the name. Auto layout hands every unclaimed pixel to
    the one unconstrained column, so the name column used to absorb all the
    slack the card had — the reason the table needed a cap to look right at all.
    Sharing the width out in proportions means it scales with the card instead,
    and the four data columns stay comparable to each other at every size.

    Proportions, not `table-fixed`. Below sm the card is ~300px, one column is
    dropped, and the name still has to fit "Classic spinner" beside its preview
    icon; fixed layout would hold it to a third of that and wrap the names,
    where auto layout treats these as the strong suggestion they should be and
    gives a column more when its content genuinely needs it. It is also what
    lets the four that remain on a phone spread back across the full width
    rather than leaving the dropped column's twelfths as a gap.

    Every numeric column aligns left, against the convention for numbers,
    because the rating carries a trailing delta. Right-aligned, the pair was
    aligned as a unit, so a row ending "(±0)" and one ending "(−12)" put their
    ratings in different places — lined up with neither each other nor the "Elo
    rating" header. Aligned left, the rating leads the cell, so every rating and
    its header start on one edge whatever follows them.
  */
  const table = (
    <Table className="w-full">
      <TableHeader>
        <TableRow>
          <TableHead className="w-1/12">#</TableHead>
          <TableHead className="w-4/12">Loading state</TableHead>
          {/*
            Beside the name rather than at the end of the row: this is the
            column that says what the ranking is worth, and the numbers to its
            right are how it was arrived at. A reader who stops after two
            columns has the finding.

            Kept on a phone, where W–D–L is the column that gives way instead.
            Five columns do not fit ~300px and one of them has to go; this is
            the one worth the space, and W–D–L is the one that already fails
            there anyway — its header tip explains the initials, and Radix
            tooltips do not open on tap.

            Allowed to wrap below sm, against `TableHead`'s whitespace-nowrap.
            A three-word header held on one line is ~100px of a ~300px table;
            wrapped, it costs a line of height instead, which a phone has far
            more of than width.
          */}
          <TableHead className="w-3/12 whitespace-normal sm:whitespace-nowrap">
            <span className="flex items-center gap-1.5">
              Feels faster by
              <SavingTip />
            </span>
          </TableHead>
          {/* Wraps below sm for the same reason as the column before it. */}
          <TableHead className="w-2/12 whitespace-normal sm:whitespace-nowrap">
            Elo rating
          </TableHead>
          {/*
            `TableHead` is whitespace-nowrap, so a column narrower than its own
            header does not wrap — it widens the table and takes the space from
            the name column silently. Two twelfths is comfortably clear of what
            "W–D–L" plus its tip needs at every width the card takes.

            Dropped below sm. It is the row's supporting detail rather than its
            answer, and it is the one column whose header cannot be understood
            on a phone at all — the tip that expands the initials needs a
            pointer to open.
          */}
          <TableHead className="hidden w-2/12 sm:table-cell">
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
              <PerceivedSaving rating={r.rating} />
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
            <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
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
