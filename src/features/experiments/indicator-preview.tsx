import { Eye } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { loadingIndicators } from '@/features/experiments/indicators'
import { useLoopingProgress } from '@/features/experiments/use-timed-progress'
import { useMediaQuery } from '@/hooks/use-media-query'
import {
  BASE_DURATION_MAX_MS,
  BASE_DURATION_MIN_MS,
} from '@/lib/data/aggregate'
import type { ExperimentVariant } from '@/lib/data/types'

/**
 * The middle of the band a real matchup draws from, so a preview runs at a
 * representative speed. Derived rather than written down: a literal here would
 * drift the moment the band moved.
 *
 * A preview deliberately does NOT re-roll. Nobody is being timed, and a loop
 * that changed pace each pass would read as a glitch.
 */
const PREVIEW_DURATION_MS = (BASE_DURATION_MIN_MS + BASE_DURATION_MAX_MS) / 2

/** Tailwind's `sm`. Hand-kept — v4 has no JS config to read the value from. */
const SM_UP = '(min-width: 40rem)'

/**
 * Bounds the preview.
 *
 * A pinned height plus `overflow-hidden` because `SkeletonLoader` is
 * `h-full w-full` and built to overflow and be clipped — the same thing
 * `RecapPanel` had to account for.
 *
 * Deliberately not `pairwise-runner`'s `STIMULUS_CANVAS`: that one is `h-full`
 * and load-bearing for the guarantee that every variant gets an identical
 * footprint within a matchup, so footprint never becomes a second variable.
 * None of that applies here, and borrowing it would imply it did.
 */
const PREVIEW_CANVAS =
  'h-56 w-full overflow-hidden rounded-lg border bg-muted/40 p-4'

/**
 * The animation itself, running on a loop.
 *
 * The popover unmounts its content when closed, so the five other rows cost no
 * animation frames. `running` is still threaded through because the drawer does
 * not: vaul keeps content mounted for the duration of its exit animation, and a
 * clock left ticking behind a closing sheet is pure waste.
 */
function PreviewStage({
  variant,
  running,
}: {
  variant: ExperimentVariant
  running: boolean
}) {
  const Indicator = loadingIndicators[variant.id]
  // The variant's own base, but without the per-matchup jitter: nobody is being
  // timed here, and re-rolling would make one preview inconsistent with itself
  // between loops.
  const progress = useLoopingProgress(PREVIEW_DURATION_MS, running)
  /*
    Random here, unlike in a run, and it does not contradict the note above:
    that one is about pace, where a loop changing speed mid-cycle reads as a
    glitch. This is picked once per mount and held for as long as the preview is
    open, so nothing changes under the reader. Nothing here is measured either,
    and a fresh line each time you open it advertises the variant better than
    the same one forever.
  */
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000))

  return (
    <div className={PREVIEW_CANVAS}>
      {/*
        Centred where it fits, top-aligned where it doesn't — see the utility in
        index.css. A full-frame indicator is `h-full`, which resolves to the
        whole box and clips from the bottom, and a `size-12` spinner simply
        centres; neither needs the fallback. The quote does: this box is 192px
        of content height and a long line easily passes that, and plain
        `items-center` overflowed it at both ends, so the preview opened partway
        into the sentence. Same geometry as RecapPanel.
      */}
      <div className="flex h-full items-safe-center justify-center">
        {Indicator && <Indicator progress={progress} seed={seed} />}
      </div>
    </div>
  )
}

/**
 * Lets someone reading the standings see what a loading state actually looked
 * like, without putting six animations on the page at once.
 *
 * A popover on pointer devices and a bottom drawer on phones: the same content
 * either way, but a popover on a narrow screen leaves the full-frame skeleton
 * almost no room, and a drawer anchored to a table row on a wide screen is far
 * more interruption than a peek warrants.
 *
 * The name and description come from the seeded variant rather than from the
 * Elo aggregate, which carries no copy. That is also what rescues the control
 * condition: `blank` renders nothing at all, so an uncaptioned preview would be
 * an empty box that reads as broken instead of as the point.
 */
export function IndicatorPreview({ variant }: { variant: ExperimentVariant }) {
  const [open, setOpen] = useState(false)
  const isWide = useMediaQuery(SM_UP)

  /*
    An element rather than a component, and that distinction is load-bearing:
    `asChild` renders through Radix's Slot, which merges the trigger's own
    props — onClick, aria-expanded, aria-haspopup, ref — onto whatever it is
    given. A wrapper component that accepts only its own props silently drops
    all of them, and the result is a button that looks right and opens nothing.
    `Button` spreads what it receives onto the DOM node, so it is a valid Slot
    child; a bespoke wrapper around it is not.

    A name in a table reads as plain text, so the dotted underline and the icon
    are what say it can be pressed. Visible text is the name alone — the sr-only
    tail is what makes the accessible name describe the action.
  */
  const trigger = (
    <Button
      type="button"
      variant="link"
      className="h-auto p-0 font-medium text-foreground underline decoration-dotted underline-offset-4"
    >
      {variant.label}
      {/*
        aria-hidden rather than the role="presentation" used on the standalone
        indicator svgs: this icon sits inside an accessible name, and hiding it
        is what keeps that name clean.
      */}
      <Eye aria-hidden />
      <span className="sr-only">— preview this loading state</span>
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
        <PopoverContent
          className="w-80"
          aria-label={`${variant.label} preview`}
        >
          <PopoverHeader>
            <PopoverTitle>{variant.label}</PopoverTitle>
            <PopoverDescription>{variant.description}</PopoverDescription>
          </PopoverHeader>
          <PreviewStage variant={variant} running={open} />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{variant.label}</DrawerTitle>
          <DrawerDescription>{variant.description}</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0">
          <PreviewStage variant={variant} running={open} />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
