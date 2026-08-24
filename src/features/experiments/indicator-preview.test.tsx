import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { IndicatorPreview } from '@/features/experiments/indicator-preview'
import { seedExperiments } from '@/lib/data/seed'
import type { ExperimentVariant } from '@/lib/data/types'

/**
 * Pulled from the seed rather than hand-written, the same trick
 * `indicators.test.tsx` uses: a fixture would keep passing after the real
 * variants changed underneath it.
 */
const variants = seedExperiments.find((e) => e.id === 'exp_loading_perception')!
  .variants as ExperimentVariant[]

function variantById(id: string): ExperimentVariant {
  return variants.find((v) => v.id === id)!
}

describe('IndicatorPreview', () => {
  it('names the action, not just the row', () => {
    render(<IndicatorPreview variant={variantById('skeleton')} />)
    // The visible text is the bare label; the accessible name has to say what
    // pressing it does, or the control announces as a repeat of the row.
    expect(
      screen.getByRole('button', {
        name: /skeleton — preview this loading state/i,
      }),
    ).toBeInTheDocument()
  })

  it('reveals the animation only once asked', async () => {
    const user = userEvent.setup()
    render(<IndicatorPreview variant={variantById('progress_bar')} />)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))

    // The indicator itself, not just the shell: the progress bar renders a
    // percentage, so its presence proves the clock reached the component.
    expect(await screen.findByRole('dialog')).toHaveTextContent('%')
  })

  it('explains the blank control instead of showing an empty box', async () => {
    const user = userEvent.setup()
    const blank = variantById('blank')
    render(<IndicatorPreview variant={blank} />)
    await user.click(screen.getByRole('button'))

    // `BlankIndicator` renders nothing, so the description is the only thing
    // standing between this preview and something that looks broken.
    expect(await screen.findByRole('dialog')).toHaveTextContent(
      blank.description,
    )
  })
})
