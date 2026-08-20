import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { HomePage } from '@/routes/home'
import { ThemeProvider } from '@/providers/theme-provider'
import { siteConfig } from '@/config/site'

describe('HomePage', () => {
  it('renders the tagline and section links', () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <MemoryRouter>
            <HomePage />
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>,
    )

    expect(screen.getByText(siteConfig.tagline)).toBeInTheDocument()
    // The hero's supporting copy is a dictionary entry for the term the
    // channel is named after, so assert on the headword and its sense.
    expect(screen.getByText(siteConfig.definition.headword)).toBeInTheDocument()
    for (const { sense } of siteConfig.definition.senses) {
      expect(screen.getByText(sense)).toBeInTheDocument()
    }
    // The hero is intentionally CTA-free — navigation lives in the section
    // cards below it, so assert on those links instead. One card per content
    // section of the site: the studies catalogue and the ideas board.
    expect(
      screen.getByRole('link', { name: /browse studies/i }),
    ).toHaveAttribute('href', '/studies')
    expect(screen.getByRole('link', { name: /browse ideas/i })).toHaveAttribute(
      'href',
      '/ideas',
    )
  })
})
