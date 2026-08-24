import { Check, Minus, X } from 'lucide-react'
import { useState } from 'react'

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import { loadingIndicators } from '@/features/experiments/indicators'
import { useMediaQuery } from '@/hooks/use-media-query'
import { matchVerdict } from '@/lib/data/aggregate'
import type { MatchVerdict } from '@/lib/data/aggregate'
import type { ExperimentVariant, MatchInput } from '@/lib/data/types'
import { cn } from '@/lib/utils'

/** Tailwind's `sm`. Hand-kept — v4 has no JS config to read the value from. */
const SM_UP = '(min-width: 40rem)'

/** How long a hover has to settle before the card opens. */
const OPEN_DELAY_MS = 150

/**
 * What each verdict looks like, says, and means.
 *
 * One table rather than three switches, so a chip's colour, its icon, its
 * accessible name and the line inside its card can never drift apart.
 *
 * Colour is never the only carrier: the icon shape distinguishes the three
 * states without it, and `line` is what a screen reader gets. The tokens are
 * the ones `elo-results.tsx` already uses for the rating deltas, which are
 * defined for both themes in `index.css`.
 */
const VERDICTS: Record<
  MatchVerdict,
  {
    icon: typeof Check
    chip: string
    /**
     * The card's opening line, and the chip's accessible name — one string for
     * both, so what is announced and what is drawn cannot drift.
     *
     * Takes the name of the loading state that was chosen, because "the slower
     * one" is only meaningful next to a diagram you have already read, and this
     * line is the first thing in the card. `called-close` is the one verdict
     * with no choice to name, and ignores it.
     */
    line: (chosen: string) => string
  }
> = {
  correct: {
    icon: Check,
    chip: 'border-success/40 bg-success/10 text-success',
    line: (chosen) => `You correctly chose ${chosen} as faster.`,
  },
  wrong: {
    icon: X,
    chip: 'border-destructive/40 bg-destructive/10 text-destructive',
    line: (chosen) => `You incorrectly chose ${chosen} as faster.`,
  },
  'called-close': {
    icon: Minus,
    chip: 'border-border bg-muted text-muted-foreground',
    line: () => 'You called this one too close to call.',
  },
  'no-shorter': {
    icon: Minus,
    chip: 'border-border bg-muted text-muted-foreground',
    line: (chosen) =>
      `You chose ${chosen} as faster, but both ran for exactly the same time.`,
  },
}

/** Whole milliseconds are noise at this scale; tenths are the story. */
function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * The loading state the vote named, or empty for a tie.
 *
 * Empty rather than falling back to a side: a tie named neither, and its line
 * is the one that asks for no name. A fallback would put a loading state nobody
 * chose into the copy the moment that changed.
 */
function chosenLabel(
  match: MatchInput,
  a: ExperimentVariant,
  b: ExperimentVariant,
): string {
  if (match.outcome === 'a') return a.label
  if (match.outcome === 'b') return b.label
  return ''
}

/** "Classic spinner 2.4s, faster." — one side, as a sentence. */
function sideSummary(
  variant: ExperimentVariant | undefined,
  durationMs: number,
  faster: boolean,
): string {
  const name = variant?.label ?? 'unknown'
  return `${name} ${seconds(durationMs)}${faster ? ', faster' : ''}.`
}

/**
 * One side of a matchup: the loading state as it ended, and how long it really
 * ran.
 *
 * The indicator renders at `progress={1}` — the same still `RecapPanel` shows
 * at vote time, not a replay. Nobody is being timed here, and two animations
 * looping at different speeds inside a card that opens on hover would be a lot
 * of motion for a footnote.
 *
 * `overflow-hidden` on a pinned height is load-bearing rather than defensive:
 * `SkeletonLoader` is `h-full w-full` and built to be clipped, so without a
 * bounded box it would push the side below it out of the card.
 */
function MatchupSide({
  variant,
  position,
  durationMs,
  faster,
  seed,
}: {
  variant: ExperimentVariant
  position: string
  durationMs: number
  faster: boolean
  seed: number
}) {
  const Indicator = loadingIndicators[variant.id]

  return (
    <div className="space-y-1">
      {/*
        Above the animation it describes, so the caption is read before the
        thing it names rather than after it — which matters most for `blank`,
        where there is nothing to look at and a label arriving afterwards leaves
        an empty box reading as broken until you get past it.
      */}
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {position} · {variant.label}
        </span>
        {/*
          The answer the card exists to give. Marked on the duration itself
          rather than as a separate badge — the number and the claim about it
          are one fact, and a badge would need somewhere to sit that this line
          does not have.
        */}
        <span
          className={cn(
            'shrink-0 tabular-nums',
            faster ? 'font-medium text-success' : 'text-muted-foreground',
          )}
        >
          {seconds(durationMs)}
          {faster && ' · faster'}
        </span>
      </div>
      {/*
        items-safe-center: 56px of content height is the tightest box any
        indicator appears in, so the spinner and the bar want the middle of it
        while the quote and the cooking pan are several times taller than it and
        have to be clipped from the bottom — centring those cut the first line
        off the quote. See the utility in index.css.
      */}
      <div className="flex h-20 w-full items-safe-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-3">
        {Indicator && <Indicator progress={1} seed={seed} />}
      </div>
    </div>
  )
}

/** Everything one matchup has to say, shared by the hover card and the drawer. */
function MatchupDetail({
  match,
  variants,
  verdict,
  seed,
}: {
  match: MatchInput
  variants: ExperimentVariant[]
  verdict: MatchVerdict
  seed: number
}) {
  const a = variants.find((v) => v.id === match.variantAId)
  const b = variants.find((v) => v.id === match.variantBId)
  // A match row whose variants are no longer seeded is not worth a crash on the
  // results screen; the chip and its verdict line still stand on their own.
  if (!a || !b) return null

  return (
    <div className="space-y-3">
      {/*
        The answer first, not as a footnote under the evidence. This is what
        someone opening a chip came for; the two panels below are the working
        that backs it up, and reading them is optional.
      */}
      <p className="text-sm font-medium text-pretty">
        {VERDICTS[verdict].line(chosenLabel(match, a, b))}
      </p>
      <MatchupSide
        variant={a}
        position="First"
        durationMs={match.durationAMs}
        faster={match.durationAMs < match.durationBMs}
        seed={seed}
      />
      <MatchupSide
        variant={b}
        position="Second"
        durationMs={match.durationBMs}
        faster={match.durationBMs < match.durationAMs}
        seed={seed}
      />
    </div>
  )
}

/**
 * One matchup, as a chip you can open.
 *
 * A hover card from sm up and a bottom drawer below it, the same split — and
 * for the same reasons — as `IndicatorPreview`: hover never fires on tap, and a
 * card anchored to a 24px target is hard to hit on a phone anyway.
 *
 * HoverCard rather than Popover because it opens on focus as well as on hover,
 * so the row is readable by keyboard without turning fifteen chips into fifteen
 * things to click through.
 */
function MatchupChip({
  match,
  index,
  variants,
}: {
  match: MatchInput
  index: number
  variants: ExperimentVariant[]
}) {
  const [open, setOpen] = useState(false)
  const isWide = useMediaQuery(SM_UP)

  const verdict = matchVerdict(match)
  const { icon: Icon, chip, line } = VERDICTS[verdict]
  const a = variants.find((v) => v.id === match.variantAId)
  const b = variants.find((v) => v.id === match.variantBId)

  /*
    An element rather than a component: `asChild` renders through Radix's Slot,
    which merges the trigger's own props onto whatever it is given, and a
    wrapper component that accepts only its own props would silently drop them.

    The name carries the whole matchup, not just the verdict, and that is not
    belt-and-braces: a Radix hover card renders as a plain div with no role, so
    unlike the drawer it is not announced at all. Everything the card shows a
    sighted reader therefore has to be readable from the chip itself — which
    matchup, how it was called, and what the two sides actually ran. The number
    lives here rather than on the chip for the same reason it is not drawn:
    fifteen circles each carrying a two-digit numeral is a wall of text at 24px,
    and position in the row already says which matchup this was.
  */
  const trigger = (
    <button
      type="button"
      aria-label={[
        `Matchup ${index + 1}: ${a && b ? line(chosenLabel(match, a, b)) : ''}`,
        sideSummary(
          a,
          match.durationAMs,
          match.durationAMs < match.durationBMs,
        ),
        sideSummary(
          b,
          match.durationBMs,
          match.durationBMs < match.durationAMs,
        ),
      ].join(' ')}
      className={cn(
        'flex size-6 cursor-pointer items-center justify-center rounded-full border transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
        chip,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
    </button>
  )

  /*
    `index` stands in for the seed the matchup actually ran with, which is not
    recorded on the match row. It only shows in the quote, the one indicator
    whose content varies with it: that line may differ from the one that played.
    Carrying the real seed would mean a column, a migration and both adapters,
    for a cosmetic difference in one of six variants — and the runner draws its
    seeds from this same 0..n-1 range, so nothing here is out of range.
  */
  const detail = (
    <MatchupDetail
      match={match}
      variants={variants}
      verdict={verdict}
      seed={index}
    />
  )

  if (isWide) {
    return (
      <HoverCard open={open} onOpenChange={setOpen} openDelay={OPEN_DELAY_MS}>
        <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
        {/*
          No label, and no role either: a Radix hover card is a plain div by
          design, and labelling one changes nothing because there is no role for
          a name to attach to. This content is the sighted reader's version of
          what the trigger already says — see the note on its accessible name.
        */}
        <HoverCardContent className="w-72">{detail}</HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Matchup {index + 1}</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pt-0">{detail}</div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The run, matchup by matchup, in the order they were played.
 *
 * The score above this says how many were read correctly; this says which ones,
 * which is the part worth looking at — being fooled by one indicator every time
 * and guessing throughout produce the same number and very different rows.
 *
 * Wraps rather than scrolls. Fifteen chips need ~580px and a phone has ~310px,
 * and a row that ran off the side would hide exactly the matchups at the end of
 * the run, when attention is most likely to have drifted.
 *
 * One even run of chips, with nothing marking off every third. The dividers
 * made the strip read as a sequence of small scores to be tallied group by
 * group, when what it is is one run in playback order — an even rhythm says
 * that, and the hover cards number themselves ("Matchup 7") for anyone who
 * needs to find a specific one.
 */
export function MatchupStrip({
  matches,
  variants,
}: {
  matches: MatchInput[]
  variants: ExperimentVariant[]
}) {
  return (
    // One flat wrapping row: every chip the same distance from its neighbours,
    // on both axes, whether or not a line break falls between them.
    <div className="flex flex-wrap items-center gap-4">
      {matches.map((match, i) => (
        <MatchupChip
          // Position IS the identity here: matches are append-only and this
          // renders one finished run, so nothing reorders under the key.
          key={i}
          match={match}
          index={i}
          variants={variants}
        />
      ))}
    </div>
  )
}
