import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { createMockProvider } from '@/lib/data/mock'
import { seedExperiments, seedSurveys } from '@/lib/data/seed'
import { StudiesPage } from '@/routes/studies'

function renderStudies() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StudiesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('StudiesPage', () => {
  it('lists every survey and every experiment', async () => {
    renderStudies()
    // Driven off the seed rather than hardcoded titles, so adding either kind
    // cannot leave the catalogue quietly showing only one of them.
    for (const s of seedSurveys) {
      expect(await screen.findByText(s.title)).toBeInTheDocument()
    }
    for (const e of seedExperiments) {
      expect(await screen.findByText(e.title)).toBeInTheDocument()
    }
  })

  it('badges each card with its kind', async () => {
    renderStudies()
    // The flat list's only affordance for telling a short survey from a
    // fifteen-matchup experiment. Without this the merge loses information.
    await screen.findByText(seedExperiments[0].title)
    expect(screen.getAllByText('Experiment')).toHaveLength(
      seedExperiments.length,
    )
    expect(screen.queryAllByText('Survey')).toHaveLength(seedSurveys.length)
  })

  it('deep-links each kind to its own detail route', async () => {
    renderStudies()
    await screen.findByText(seedExperiments[0].title)

    // Merging the listings must not merge the destinations — the detail pages
    // are genuinely different and stayed put. Built from the seed so this holds
    // whichever kinds happen to be seeded.
    const links = screen
      .getAllByRole('link')
      .map((a) => a.getAttribute('href') ?? '')

    for (const s of seedSurveys) expect(links).toContain(`/surveys/${s.slug}`)
    for (const e of seedExperiments) {
      expect(links).toContain(`/experiments/${e.slug}`)
    }
  })

  it('offers experiments a way past the run, and surveys none', async () => {
    renderStudies()
    await screen.findByText(seedExperiments[0].title)

    // The catalogue's half of the skip: the detail route reads `view=results`
    // and opens the runner on the standings. If the param ever changes name,
    // this and the runner have to move together.
    for (const e of seedExperiments) {
      const card = screen
        .getByText(e.title)
        .closest('[data-slot="card"]') as HTMLElement
      expect(
        within(card).getByRole('link', { name: /skip to results/i }),
      ).toHaveAttribute('href', `/experiments/${e.slug}?view=results`)
    }

    // Surveys have no results view to skip to, so offering the same button
    // there would be a link to nothing.
    for (const s of seedSurveys) {
      const card = screen
        .getByText(s.title)
        .closest('[data-slot="card"]') as HTMLElement
      expect(
        within(card).queryByRole('link', { name: /skip to results/i }),
      ).toBeNull()
    }
  })

  it('says how many people have already taken part', async () => {
    // Driven off the provider rather than a literal: the seeded baseline stands
    // in for history, and this should keep passing when that history grows.
    const [summary] = await createMockProvider().listExperiments()
    renderStudies()
    const title = await screen.findByText(seedExperiments[0].title)
    const card = title.closest('[data-slot="card"]')!
    expect(
      within(card as HTMLElement).getByText(
        `${summary.participantCount} participants`,
      ),
    ).toBeInTheDocument()
    expect(summary.participantCount).toBeGreaterThan(1)
  })
})
