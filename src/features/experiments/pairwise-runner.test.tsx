import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PairwiseRunner } from '@/features/experiments/pairwise-runner'
import { __setDataProvider } from '@/lib/data'
import type { DataProvider } from '@/lib/data/provider'
import { seedExperiments } from '@/lib/data/seed'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Pulled from the seed rather than hand-written, the same trick
 * `indicator-preview.test.tsx` uses: a fixture would keep passing after the
 * real variants changed underneath it.
 */
const experiment = seedExperiments.find(
  (e) => e.id === 'exp_loading_perception',
)!

const recordMatch = vi.fn(() => Promise.resolve())

/**
 * Only the three methods the runner reaches for. Cast rather than implemented
 * in full: `DataProvider` also covers surveys, ideas and rating experiments,
 * and twenty unreachable stubs would bury what this test actually depends on.
 */
const provider = {
  recordMatch,
  getEloAggregate: () =>
    Promise.resolve({
      experimentId: experiment.id,
      totalMatches: 0,
      ratings: [],
    }),
  getEloHistory: () =>
    Promise.resolve({
      experimentId: experiment.id,
      totalMatches: 0,
      points: [],
    }),
} as unknown as DataProvider

/** Advance the clock, then let React flush whatever the new state scheduled. */
async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms)
  })
}

/**
 * `fireEvent`, not `userEvent` as the other tests use.
 *
 * A matchup is driven entirely by rAF and `setTimeout`, so this test has to own
 * the clock — and `userEvent`'s async pointer sequence waits on that same faked
 * clock, which deadlocks: it will not return until time advances, and time only
 * advances once it returns.
 */
function click(name: RegExp) {
  fireEvent.click(screen.getByRole('button', { name }))
}

/**
 * Drive one matchup from its trigger through to the vote step.
 *
 * A bounded loop rather than one big jump: each stage mounts the next thing
 * only after React has re-rendered, so the clock has to move in slices that
 * give it the chance. Durations are rolled per matchup (1.8–3.6s a side, plus
 * two one-second holds), so the ceiling is deliberately generous.
 */
async function playToVote() {
  click(/^(start|replay) matchup/i)
  for (let i = 0; i < 20; i++) {
    if (screen.queryByRole('button', { name: /first felt faster/i })) return
    await advance(1000)
  }
  throw new Error('never reached the vote step')
}

function redoButton() {
  return screen.getByRole('button', { name: /redo matchup/i })
}

describe('PairwiseRunner redo', () => {
  beforeEach(async () => {
    vi.useFakeTimers({
      toFake: [
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
        'setTimeout',
        'clearTimeout',
      ],
    })
    __setDataProvider(provider)
    recordMatch.mockClear()

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    render(
      // `TooltipProvider` mirrors `AppProviders`, which mounts it app-wide —
      // Radix throws without one in scope, so the spent redo's tooltip needs it
      // here too.
      <QueryClientProvider client={client}>
        <TooltipProvider>
          <PairwiseRunner experiment={experiment} />
        </TooltipProvider>
      </QueryClientProvider>,
    )
    click(/start the experiment/i)
    await advance(0)
  })

  afterEach(() => {
    __setDataProvider(null)
    vi.useRealTimers()
  })

  it('spends its one redo, then goes insensitive for that matchup', async () => {
    await playToVote()
    expect(redoButton()).toHaveTextContent('Redo matchup (1 left)')
    expect(redoButton()).toBeEnabled()

    click(/redo matchup/i)

    // Back at the trigger, and saying so — a redo that landed on the identical
    // "Start matchup 1" screen would look like nothing had happened.
    expect(
      screen.getByRole('button', { name: /replay matchup 1/i }),
    ).toBeInTheDocument()

    await playToVote()
    expect(redoButton()).toHaveTextContent('Redo matchup (0 left)')
    expect(redoButton()).toBeDisabled()

    // The label alone says how many are left, not why there are no more. A
    // disabled button fires no pointer events, so the explanation hangs off the
    // wrapper span rather than the button itself.
    fireEvent.focus(redoButton().parentElement!)
    await advance(500)
    expect(screen.getByText(/one redo per matchup/i)).toBeInTheDocument()
  })

  it('gives the next matchup its own redo', async () => {
    await playToVote()
    click(/redo matchup/i)
    await playToVote()

    click(/too close to call/i)
    await advance(0)

    // The redo is a replay, not a second judgement: one matchup, one row —
    // flagged, so analysis can tell a second viewing from a first. Matches are
    // append-only, so this is the only chance to record it.
    expect(recordMatch).toHaveBeenCalledTimes(1)
    expect(recordMatch).toHaveBeenCalledWith(
      expect.objectContaining({ redone: true }),
    )
    expect(screen.getByText(/matchup 2 of/i)).toBeInTheDocument()

    await playToVote()
    expect(redoButton()).toHaveTextContent('Redo matchup (1 left)')
    expect(redoButton()).toBeEnabled()

    // And a matchup taken at face value is recorded as exactly that.
    click(/too close to call/i)
    await advance(0)
    expect(recordMatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ redone: false }),
    )
  })
})
