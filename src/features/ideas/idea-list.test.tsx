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
    render(
      <IdeaList ideas={[idea()]} isLoading={false} onToggleVote={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /upvote .*dark patterns/i }),
    ).toBeInTheDocument()
  })

  it('exposes whether this visitor has voted', () => {
    const { rerender } = render(
      <IdeaList
        ideas={[idea({ votedByVisitor: false })]}
        isLoading={false}
        onToggleVote={vi.fn()}
      />,
    )
    // aria-pressed is what tells a screen reader this is a toggle rather than
    // a one-way action — the colour change alone conveys nothing.
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <IdeaList
        ideas={[idea({ votedByVisitor: true })]}
        isLoading={false}
        onToggleVote={vi.fn()}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('reports which idea was voted on', async () => {
    const user = userEvent.setup()
    const onToggleVote = vi.fn()
    render(
      <IdeaList
        ideas={[idea({ id: 'idea_42' })]}
        isLoading={false}
        onToggleVote={onToggleVote}
      />,
    )

    await user.click(screen.getByRole('button'))
    expect(onToggleVote).toHaveBeenCalledWith('idea_42')
  })

  it('invites the first submission when empty', () => {
    render(<IdeaList ideas={[]} isLoading={false} onToggleVote={vi.fn()} />)
    expect(screen.getByText(/no ideas yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
