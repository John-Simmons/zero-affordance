import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

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

  it('says what each entry will cost you', async () => {
    renderStudies()
    const title = await screen.findByText(seedExperiments[0].title)
    const card = title.closest('[data-slot="card"]')!
    expect(
      within(card as HTMLElement).getByText(
        `${seedExperiments[0].variants.length} variants`,
      ),
    ).toBeInTheDocument()
  })
})
