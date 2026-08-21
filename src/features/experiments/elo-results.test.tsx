import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { EloResults } from '@/features/experiments/elo-results'
import type { EloAggregate } from '@/lib/data/types'

const aggregate: EloAggregate = {
  experimentId: 'exp_loading_perception',
  totalMatches: 12,
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

describe('EloResults', () => {
  it('renders the plain name when no wrapper is given', () => {
    render(<EloResults aggregate={aggregate} isLoading={false} />)
    expect(screen.getByText('Skeleton')).toBeInTheDocument()
    // The table renders from an aggregate alone. If this ever becomes a button
    // by default, the standings have quietly taken on a dependency on the
    // experiment's components.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  // The rating leads its own cell, which is what puts every rating and the
  // "Elo rating" header on one left edge. Asserting the whole cell text also
  // catches the separating space going missing, which would leave the pair
  // announced as "1520(+12)".
  it('reads the rating and its change as one cell', () => {
    render(
      <EloResults
        aggregate={aggregate}
        isLoading={false}
        deltas={{ skeleton: 12 }}
        voteCount={15}
      />,
    )
    expect(screen.getByRole('cell', { name: '1520 (+12)' })).toBeInTheDocument()
  })

  it('adds no column for the change', () => {
    render(
      <EloResults
        aggregate={aggregate}
        isLoading={false}
        deltas={{ skeleton: 12 }}
        voteCount={15}
      />,
    )
    // Header and body must agree, or the columns shear.
    expect(screen.getAllByRole('columnheader')).toHaveLength(4)
    expect(screen.getAllByRole('cell')).toHaveLength(4)
  })

  // A tab strip with one tab is a label wearing a control's clothes, so the
  // tabs only appear once there is a second view to switch to.
  it('shows no tabs when given nothing to switch to', () => {
    render(<EloResults aggregate={aggregate} isLoading={false} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('opens on the table and switches to the chart', async () => {
    render(
      <EloResults
        aggregate={aggregate}
        isLoading={false}
        chart={<p>Ratings over time</p>}
      />,
    )

    // The table is the precise answer; the chart is context for it.
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.queryByText('Ratings over time')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Over time' }))

    expect(screen.getByText('Ratings over time')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('lets the caller wrap the name', () => {
    render(
      <EloResults
        aggregate={aggregate}
        isLoading={false}
        renderLabel={(r) => <button type="button">{r.label} preview</button>}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Skeleton preview' }),
    ).toBeInTheDocument()
  })
})
