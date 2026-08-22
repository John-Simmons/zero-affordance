import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { MatchupStrip } from '@/features/experiments/matchup-strip'
import { seedExperiments } from '@/lib/data/seed'
import type { ExperimentVariant, MatchInput } from '@/lib/data/types'

/**
 * Pulled from the seed rather than hand-written, the same trick
 * `indicator-preview.test.tsx` uses: a fixture would keep passing after the
 * real variants changed underneath it.
 */
const variants = seedExperiments.find((e) => e.id === 'exp_loading_perception')!
  .variants as ExperimentVariant[]

const [spinner, bar] = variants

function match(over: Partial<MatchInput> = {}): MatchInput {
  return {
    experimentId: 'exp_loading_perception',
    visitorId: 'v1',
    variantAId: spinner.id,
    variantBId: bar.id,
    durationAMs: 2400,
    durationBMs: 3100,
    outcome: 'a',
    redone: false,
    ...over,
  }
}

/**
 * Force the narrow layout.
 *
 * jsdom answers media queries against its 1024px window, so everything here
 * gets the hover card unless told otherwise — the same reason
 * `indicator-preview.test.tsx` exercises a popover rather than its drawer.
 */
function goNarrow() {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches: false,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MatchupStrip', () => {
  it('reads out the whole matchup, not just its colour', async () => {
    render(
      <MatchupStrip
        variants={variants}
        matches={[
          match({ outcome: 'a' }),
          match({ outcome: 'b' }),
          match({ outcome: 'tie' }),
          match({ durationAMs: 2000, durationBMs: 2000 }),
        ]}
      />,
    )

    // A hover card has no role and is never announced, so the chip's own name
    // has to carry everything the card shows: which matchup, how it was called,
    // and what the two sides ran.
    expect(
      screen.getByRole('button', {
        name: `Matchup 1: You correctly chose ${spinner.label} as faster. ${spinner.label} 2.4s, faster. ${bar.label} 3.1s.`,
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: new RegExp(
          `Matchup 2: You incorrectly chose ${bar.label} as faster`,
        ),
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /matchup 3: You called this one too close to call/i,
      }),
    ).toBeInTheDocument()
    // Nothing is crowned when both ran the same length.
    expect(
      screen.getByRole('button', {
        name: `Matchup 4: You chose ${spinner.label} as faster, but both ran for exactly the same time. ${spinner.label} 2.0s. ${bar.label} 2.0s.`,
      }),
    ).toBeInTheDocument()
  })

  it('opens onto both loading states, their real durations, and which won', async () => {
    const user = userEvent.setup()
    render(<MatchupStrip variants={variants} matches={[match()]} />)

    expect(screen.queryByText(/· faster/)).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button'))

    // The indicator itself, not just the shell: the progress bar renders a
    // percentage, so its presence proves the component reached its end state.
    expect(await screen.findByText('2.4s · faster')).toBeInTheDocument()
    expect(screen.getByText('3.1s')).toBeInTheDocument()
    expect(screen.getByText(`Second · ${bar.label}`)).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    // Names the loading state that was picked, not "the faster one" — the card
    // opens on this line, so there is no diagram above it to resolve a pronoun
    // against.
    expect(
      screen.getByText(`You correctly chose ${spinner.label} as faster.`),
    ).toBeInTheDocument()
  })

  it('explains a grey chip rather than leaving it bare', async () => {
    const user = userEvent.setup()
    render(
      <MatchupStrip
        variants={variants}
        matches={[match({ durationAMs: 2000, durationBMs: 2000 })]}
      />,
    )
    await user.hover(screen.getByRole('button'))

    expect(
      await screen.findByText(
        `You chose ${spinner.label} as faster, but both ran for exactly the same time.`,
      ),
    ).toBeInTheDocument()
    // The verdict line says "as faster"; what must be absent is the marker that
    // crowns one of the two durations, since neither side was shorter.
    expect(screen.queryByText(/· faster/)).not.toBeInTheDocument()
  })

  it('opens a titled drawer on a phone, where hover never fires', async () => {
    goNarrow()
    const user = userEvent.setup()
    render(<MatchupStrip variants={variants} matches={[match()]} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))

    // Unlike the hover card, this one IS announced — so it gets a title, and
    // that title is what says which matchup you opened.
    const drawer = await screen.findByRole('dialog')
    expect(drawer).toHaveTextContent('Matchup 1')
    expect(drawer).toHaveTextContent('2.4s · faster')
  })
})
