import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'
import { EloResults } from '@/features/experiments/elo-results'
import type { EloAggregate } from '@/lib/data/types'

const aggregate: EloAggregate = {
  experimentId: 'exp_loading_perception',
  totalMatches: 12,
  totalParticipants: 4,
  ratings: [
    {
      variantId: 'skeleton',
      label: 'Skeleton',
      rating: 1520,
      matches: 4,
      wins: 3,
      losses: 1,
      ties: 0,
    },
  ],
}

/**
 * `TooltipProvider` mirrors `AppProviders`, which mounts it app-wide — Radix
 * throws without one in scope, and the W–D–L header carries a tooltip.
 */
function renderResults(props: ComponentProps<typeof EloResults>) {
  return render(
    <TooltipProvider>
      <EloResults {...props} />
    </TooltipProvider>,
  )
}

describe('EloResults', () => {
  it('renders the plain name when no wrapper is given', () => {
    renderResults({ aggregate, isLoading: false })
    expect(screen.getByText('Skeleton')).toBeInTheDocument()
    // The table renders from an aggregate alone. If the NAME ever becomes a
    // button by default, the standings have quietly taken on a dependency on
    // the experiment's components. Named rather than bare: the W–D–L header's
    // tooltip is a button too, and it belongs to the table itself.
    expect(
      screen.queryByRole('button', { name: 'Skeleton' }),
    ).not.toBeInTheDocument()
  })

  // The rating leads its own cell, which is what puts every rating and the
  // "Elo rating" header on one left edge. Asserting the whole cell text also
  // catches the separating space going missing, which would leave the pair
  // announced as "1520(+12)".
  it('reads the rating and its change as one cell', () => {
    renderResults({
      aggregate,
      isLoading: false,
      deltas: { skeleton: 12 },
      voteCount: 15,
    })
    expect(screen.getByRole('cell', { name: '1520 (+12)' })).toBeInTheDocument()
  })

  it('adds no column for the change', () => {
    renderResults({
      aggregate,
      isLoading: false,
      deltas: { skeleton: 12 },
      voteCount: 15,
    })
    // Header and body must agree, or the columns shear.
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    expect(screen.getAllByRole('cell')).toHaveLength(4)
  })

  // The standings are complete without a second view, and nothing should be
  // left behind announcing one — no heading over an absent chart.
  it('renders the table alone when given no chart', () => {
    renderResults({ aggregate, isLoading: false })
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Ratings over time')).not.toBeInTheDocument()
    expect(screen.queryByText('Rating over time')).not.toBeInTheDocument()
  })

  it('shows the chart under the table, both at once', () => {
    renderResults({
      aggregate,
      isLoading: false,
      chart: <p>Ratings over time</p>,
    })

    // Both visible with no interaction: they answer different questions about
    // one dataset, and behind a tab nobody compared them.
    const table = screen.getByRole('table')
    const chart = screen.getByText('Ratings over time')
    expect(table).toBeInTheDocument()
    expect(chart).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Rating over time' }),
    ).toBeInTheDocument()

    // Order is the point: the table is the precise answer, the chart is the
    // context for it.
    expect(
      table.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  // The initials are only readable if the thing that expands them is reachable,
  // and a header tip is easy to lose to a column-width tweak.
  it('explains the W–D–L column from its own header', () => {
    renderResults({ aggregate, isLoading: false })
    const header = screen.getByRole('columnheader', { name: /W–D–L/ })
    expect(
      within(header).getByRole('button', {
        name: 'What wins, draws and losses mean',
      }),
    ).toBeInTheDocument()
  })

  // The paragraph names the rating; this is the only thing on the page that
  // says what it is. jsdom answers media queries against its 1024px window, so
  // this exercises the popover — the drawer is the same body behind a different
  // shell, the split `IndicatorPreview` already carries tests for.
  it('explains the rating from the paragraph that names it', async () => {
    renderResults({ aggregate, isLoading: false })
    await userEvent.click(screen.getByRole('button', { name: /Elo rating/ }))
    expect(
      screen.getByRole('dialog', {
        name: 'How the Elo rating is calculated',
      }),
    ).toBeInTheDocument()
    // The one rule a reader is most likely to think is a bug: the duration
    // handicap, which is why record and rating can disagree. Matched loosely —
    // this copy gets reworded often, and the test is here to pin that the rule
    // is still explained, not the sentence it is explained in.
    expect(screen.getByText(/actually slower/)).toBeVisible()
  })

  it('lets the caller wrap the name', () => {
    renderResults({
      aggregate,
      isLoading: false,
      renderLabel: (r) => <button type="button">{r.label} preview</button>,
    })
    expect(
      screen.getByRole('button', { name: 'Skeleton preview' }),
    ).toBeInTheDocument()
  })
})
