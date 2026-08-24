import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EloHistoryTooltip } from '@/features/experiments/elo-history-tooltip'
import { rankByValue } from '@/features/experiments/elo-ranking'
import type { ExperimentVariant } from '@/lib/data/types'

const variants: ExperimentVariant[] = [
  { id: 'a', label: 'Alpha', description: '' },
  { id: 'b', label: 'Bravo', description: '' },
  { id: 'c', label: 'Charlie', description: '' },
]

const order = variants.map((v) => v.id)

/** One recharts tooltip payload entry per variant, at the given ratings. */
function payloadFor(ratings: Record<string, number>) {
  return variants.map((v) => ({
    graphicalItemId: v.id,
    dataKey: v.id,
    name: v.id,
    value: ratings[v.id],
    color: `var(--color-${v.id})`,
    payload: { matchCount: 40, ...ratings },
  }))
}

function renderTooltip(ratings: Record<string, number>) {
  return (
    <EloHistoryTooltip
      active
      variants={variants}
      payload={payloadFor(ratings)}
    />
  )
}

/** The transform each row carries, in DOM order. */
const transformsOf = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-slot="elo-row"]')].map(
    (el) => el.style.transform,
  )

describe('rankByValue', () => {
  it('ranks highest first', () => {
    const ranks = rankByValue(order, { a: 1400, b: 1600, c: 1500 })
    // Asserted as a mapping, not a sequence: only `.get` is ever used, so the
    // Map's own iteration order is not part of the contract.
    expect(Object.fromEntries(ranks)).toEqual({ b: 0, c: 1, a: 2 })
  })

  // Every loading state opens on the same rating, so without a stable
  // tie-break the whole list would reshuffle on each mouse move.
  it('breaks ties by the given order', () => {
    const ranks = rankByValue(order, { a: 1500, b: 1500, c: 1500 })
    expect(Object.fromEntries(ranks)).toEqual({ a: 0, b: 1, c: 2 })
  })
})

describe('EloHistoryTooltip', () => {
  it('shows every loading state with its rating at that matchup', () => {
    render(renderTooltip({ a: 1400, b: 1600, c: 1500 }))
    expect(screen.getByText('After 40 matchups')).toBeInTheDocument()
    for (const v of variants) {
      expect(screen.getByText(v.label)).toBeInTheDocument()
    }
    expect(screen.getByText('1,600')).toBeInTheDocument()
  })

  /**
   * The heart of it. Rows stay in declared order in the DOM — that is what
   * gives each one a stable identity to animate — and the ranking is carried
   * entirely by the transform.
   */
  it('keeps DOM order fixed and puts the ranking in the transforms', () => {
    const { container } = render(renderTooltip({ a: 1400, b: 1600, c: 1500 }))

    expect(
      [...container.querySelectorAll('[data-slot="elo-row"]')].map(
        (el) => el.textContent,
      ),
    ).toEqual(['Alpha1,400', 'Bravo1,600', 'Charlie1,500'])

    // Ranked b, c, a. Alpha sits in slot 0 and places 3rd (+2 rows); Bravo sits
    // in slot 1 and places 1st (−1); Charlie sits in slot 2 and places 2nd (−1).
    expect(transformsOf(container)).toEqual([
      'translateY(40px)',
      'translateY(-20px)',
      'translateY(-20px)',
    ])
  })

  it('moves the same row elements when the ranking changes', () => {
    const { container, rerender } = render(
      renderTooltip({ a: 1400, b: 1600, c: 1500 }),
    )
    const before = [...container.querySelectorAll('[data-slot="elo-row"]')]

    rerender(renderTooltip({ a: 1700, b: 1600, c: 1500 }))
    const after = [...container.querySelectorAll('[data-slot="elo-row"]')]

    // Same nodes, new positions. Replaced nodes would blink rather than slide,
    // which is exactly what shadcn's index keys would have done.
    expect(after).toHaveLength(before.length)
    after.forEach((el, i) => expect(el).toBe(before[i]))
    expect(transformsOf(container)).toEqual([
      'translateY(0px)',
      'translateY(0px)',
      'translateY(0px)',
    ])
  })

  it('renders nothing when inactive or empty', () => {
    const { container: inactive } = render(
      <EloHistoryTooltip active={false} variants={variants} payload={[]} />,
    )
    expect(inactive).toBeEmptyDOMElement()

    const { container: empty } = render(
      <EloHistoryTooltip active variants={variants} payload={[]} />,
    )
    expect(empty).toBeEmptyDOMElement()
  })
})
