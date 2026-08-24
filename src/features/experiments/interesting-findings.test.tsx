import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { InterestingFindings } from '@/features/experiments/interesting-findings'
import { seedExperiments } from '@/lib/data/seed'
import type { MatchInsights } from '@/lib/data/types'

/**
 * The real seeded variants, so a name resolves to its preview the same way it
 * does on the results screen — a fixture with invented ids would pass while
 * every name on the card fell back to plain text.
 */
const variants = seedExperiments.find(
  (e) => e.id === 'exp_loading_perception',
)!.variants

const insights: MatchInsights = {
  experimentId: 'exp_loading_perception',
  totalMatches: 120,
  handicaps: [
    {
      variantId: 'baking',
      label: 'Cooking a meal',
      wins: 24,
      meanGapMs: 400,
      meanRelativeGap: 0.11,
    },
    {
      variantId: 'skeleton',
      label: 'Skeleton',
      wins: 0,
      meanGapMs: 0,
      meanRelativeGap: 0,
    },
  ],
  positionSplit: { first: 46, second: 54, ties: 20 },
  gapAccuracy: [
    { maxRelativeGap: 0.04, correct: 34, scored: 71 },
    { maxRelativeGap: 0.09, correct: 48, scored: 84 },
    { maxRelativeGap: null, correct: 38, scored: 57 },
  ],
  pairRecords: [
    { aId: 'blank', bId: 'quote', aWins: 4, bWins: 9, ties: 1 },
    { aId: 'baking', bId: 'blank', aWins: 3, bWins: 6, ties: 0 },
  ],
  replayAccuracy: {
    replayed: { correct: 9, scored: 20 },
    firstView: { correct: 66, scored: 100 },
  },
  redos: [
    { variantId: 'quote', label: 'Quote', replayed: 12, matches: 40 },
    { variantId: 'skeleton', label: 'Skeleton', replayed: 0, matches: 40 },
  ],
  contradictions: {
    cyclic: 14,
    triples: 200,
    visitorsWithCycle: 6,
    visitorsScored: 10,
  },
  accuracySpread: {
    buckets: [
      { minPercent: 0, maxPercent: 20, visitors: 1 },
      { minPercent: 20, maxPercent: 40, visitors: 3 },
      { minPercent: 40, maxPercent: 60, visitors: 8 },
      { minPercent: 60, maxPercent: 80, visitors: 4 },
      { minPercent: 80, maxPercent: 100, visitors: 2 },
    ],
    medianPercent: 55,
    visitors: 18,
  },
}

/** `TooltipProvider` mirrors `AppProviders`; the variant previews sit under it. */
function renderFindings(props: ComponentProps<typeof InterestingFindings>) {
  return render(
    <TooltipProvider>
      <InterestingFindings {...props} />
    </TooltipProvider>,
  )
}

describe('InterestingFindings', () => {
  it('answers each question from the insights it is given', () => {
    renderFindings({ insights, isLoading: false, variants })

    // The mean gap, in the same tenths-of-a-second the matchup cards use.
    expect(screen.getByText('0.4s')).toBeInTheDocument()
    // The second-slot share, which is the number the split bar draws.
    expect(screen.getByText('54%')).toBeInTheDocument()
    // Loading states took 12 of the 22 decided matchups against the control:
    // quote's 9 wins plus cooking's 3, against the blank screen's 4 and 6.
    // Scoped to its own finding — 55% is also the median score below it, and
    // an unscoped match would pass on either one.
    const control = screen.getByText(
      'Is showing something better than showing nothing at all?',
    ).parentElement!
    expect(control).toHaveTextContent('55%')
  })

  it('names only a variant that has actually won while slower', () => {
    // Skeleton's mean gap is zero because it has never won from behind the
    // clock, not because it wins by a hair. Naming it would report an absence
    // as an answer.
    renderFindings({ insights, isLoading: false, variants })

    const question = screen.getByText(
      'Which loading animation overcame the largest gap on average when voted as faster while actually being slower?',
    )
    expect(question.parentElement).toHaveTextContent('Cooking a meal')
    expect(question.parentElement).not.toHaveTextContent('Skeleton')
  })

  it('marks a thin finding without hiding it', () => {
    renderFindings({
      insights: {
        ...insights,
        handicaps: [
          {
            variantId: 'baking',
            label: 'Cooking a meal',
            wins: 6,
            meanGapMs: 400,
            meanRelativeGap: 0.11,
          },
        ],
      },
      isLoading: false,
      variants,
    })

    // The answer still renders — the count is what carries the warning.
    expect(screen.getByText('0.4s')).toBeInTheDocument()
    expect(
      screen.getByText(/From 6 wins while running longer — still early/),
    ).toBeInTheDocument()
  })

  it('leaves a well-supported finding uncaveated', () => {
    renderFindings({ insights, isLoading: false, variants })
    expect(
      screen.getByText(/From 24 wins while running longer\./),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/24 wins while running longer — still early/),
    ).toBeNull()
  })

  it('compares replayed matchups against single viewings', () => {
    renderFindings({ insights, isLoading: false, variants })
    const finding = screen.getByText(
      'Are matchups judged more accurately when people replay them?',
    ).parentElement!

    // 9 of 20 against 66 of 100 — both rates, so a reader can see that the
    // replayed group is the harder one rather than the better-judged one.
    expect(finding).toHaveTextContent('45%')
    expect(finding).toHaveTextContent('66%')
  })

  it('names only a variant that has actually been replayed', () => {
    // Skeleton has a replay rate of zero, so it sorts last and must never be
    // the answer; a corpus with no redos at all drops the finding entirely.
    renderFindings({ insights, isLoading: false, variants })
    const finding = screen.getByText(
      'Which loading animation makes people ask for a replay most often?',
    ).parentElement!

    expect(finding).toHaveTextContent('Quote')
    expect(finding).not.toHaveTextContent('Skeleton')

    renderFindings({
      insights: { ...insights, redos: [] },
      isLoading: false,
      variants,
    })
    expect(screen.queryAllByText(/ask for a replay/)).toHaveLength(1)
  })

  it('leads the contradiction finding with the share of people, not of triples', () => {
    // 6 of 10 people voted in a circle at least once, against 14 of 200
    // triples. The first is the number a reader can feel; the second is the
    // one that sounds like nothing happened.
    renderFindings({ insights, isLoading: false, variants })
    const finding = screen.getByText(
      'How often do people contradict themselves?',
    ).parentElement!

    expect(finding).toHaveTextContent('60%')
    expect(finding).toHaveTextContent('7%')
  })

  it('draws every band of the spread, including the empty ones', () => {
    renderFindings({
      insights: {
        ...insights,
        accuracySpread: {
          buckets: [
            { minPercent: 0, maxPercent: 20, visitors: 0 },
            { minPercent: 20, maxPercent: 40, visitors: 0 },
            { minPercent: 40, maxPercent: 60, visitors: 9 },
            { minPercent: 60, maxPercent: 80, visitors: 0 },
            { minPercent: 80, maxPercent: 100, visitors: 0 },
          ],
          medianPercent: 50,
          visitors: 9,
        },
      },
      isLoading: false,
      variants,
    })

    // A band with nobody in it is part of the shape — dropping the empty ones
    // would turn a single spike into a distribution that looks uniform.
    expect(screen.getByText('0–20%')).toBeInTheDocument()
    expect(screen.getByText('80–100%')).toBeInTheDocument()
  })

  it('drops the control finding when nothing has played the blank screen', () => {
    // An experiment without that variant should lose one finding, not throw.
    renderFindings({
      insights: { ...insights, pairRecords: [] },
      isLoading: false,
      variants,
    })

    expect(
      screen.queryByText(/Is showing something better than showing nothing/),
    ).toBeNull()
    expect(
      screen.getByText(
        'Which loading animation overcame the largest gap on average when voted as faster while actually being slower?',
      ),
    ).toBeInTheDocument()
  })

  it('names whichever slot the votes actually favored', () => {
    // The fixture leans second, so the default rendering names the second slot.
    renderFindings({ insights, isLoading: false, variants })
    expect(
      screen.getByText(/of votes went to whichever animation played second/),
    ).toBeInTheDocument()

    // Flipping the split has to flip the sentence: reporting the second slot's
    // 46% here would leave the reader to work out where the pull actually is.
    renderFindings({
      insights: {
        ...insights,
        positionSplit: { first: 54, second: 46, ties: 20 },
      },
      isLoading: false,
      variants,
    })
    const flipped = screen.getAllByText(
      /of votes went to whichever animation played first/,
    )
    expect(flipped).toHaveLength(1)
    expect(flipped[0]).toHaveTextContent('54%')
  })

  it('says so when nobody has played yet', () => {
    renderFindings({
      insights: {
        experimentId: 'exp_loading_perception',
        totalMatches: 0,
        handicaps: [],
        positionSplit: { first: 0, second: 0, ties: 0 },
        gapAccuracy: [],
        pairRecords: [],
        replayAccuracy: {
          replayed: { correct: 0, scored: 0 },
          firstView: { correct: 0, scored: 0 },
        },
        redos: [],
        contradictions: {
          cyclic: 0,
          triples: 0,
          visitorsWithCycle: 0,
          visitorsScored: 0,
        },
        accuracySpread: { buckets: [], medianPercent: 0, visitors: 0 },
      },
      isLoading: false,
      variants,
    })

    expect(
      screen.getByText(/Nobody has played this one yet/),
    ).toBeInTheDocument()
    // An empty corpus renders no findings at all rather than a column of dashes.
    expect(screen.queryByText(/actually being slower/)).toBeNull()
  })

  it('renders the card while the query is still out', () => {
    renderFindings({ insights: undefined, isLoading: true, variants })

    // The title is outside the loading branch on purpose: the section keeps its
    // place in the page while its body arrives, so nothing below it jumps.
    expect(screen.getByText('Other findings')).toBeInTheDocument()
    expect(screen.queryByText(/actually being slower/)).toBeNull()
  })
})
