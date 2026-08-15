import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { IdeaList } from '@/features/ideas/idea-list'
import type { VideoIdea } from '@/lib/data/types'

function idea(over: Partial<VideoIdea> = {}): VideoIdea {
  return {
    id: 'idea_1',
    title: 'Why dark patterns work',
    description: 'A teardown of consent flows.',
    voteCount: 3,
    votedByVisitor: false,
    createdAt: '2026-08-15T00:00:00.000Z',
    ...over,
  }
}

describe('IdeaList', () => {
  it('names the vote control, which is otherwise just a chevron', () => {
    render(<IdeaList ideas={[idea()]} isLoading={false} onSetVote={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: /upvote .*dark patterns/i }),
    ).toBeInTheDocument()
  })

  it('exposes whether this visitor has voted', () => {
    const { rerender } = render(
      <IdeaList
        ideas={[idea({ votedByVisitor: false })]}
        isLoading={false}
        onSetVote={vi.fn()}
      />,
    )
    // aria-pressed is what tells a screen reader this is a toggle rather than
    // a one-way action — the colour change alone conveys nothing.
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <IdeaList
        ideas={[idea({ votedByVisitor: true })]}
        isLoading={false}
        onSetVote={vi.fn()}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('asks for the state the visitor wanted, not a flip', async () => {
    // The callback carries the intended state so a request that arrives twice
    // is a no-op rather than an un-vote. A blind toggle here would put that
    // failure mode back however idempotent the backend is.
    const user = userEvent.setup()
    const onSetVote = vi.fn()
    const { rerender } = render(
      <IdeaList
        ideas={[idea({ id: 'idea_42', votedByVisitor: false })]}
        isLoading={false}
        onSetVote={onSetVote}
      />,
    )

    await user.click(screen.getByRole('button'))
    expect(onSetVote).toHaveBeenCalledWith('idea_42', true)

    rerender(
      <IdeaList
        ideas={[idea({ id: 'idea_42', votedByVisitor: true })]}
        isLoading={false}
        onSetVote={onSetVote}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onSetVote).toHaveBeenLastCalledWith('idea_42', false)
  })

  it('locks only the idea whose vote is in flight', async () => {
    // One slow request must not freeze the whole board, and the tapped button
    // must not accept a second click while its first is still travelling.
    render(
      <IdeaList
        ideas={[
          idea({ id: 'idea_1', title: 'Pending one' }),
          idea({ id: 'idea_2', title: 'Other one' }),
        ]}
        isLoading={false}
        onSetVote={vi.fn()}
        pendingIdeaId="idea_1"
      />,
    )

    expect(screen.getByRole('button', { name: /pending one/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /other one/i })).toBeEnabled()
  })

  it('invites the first submission when empty', () => {
    render(<IdeaList ideas={[]} isLoading={false} onSetVote={vi.fn()} />)
    expect(screen.getByText(/no ideas yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
