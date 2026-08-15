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
    // The hero is intentionally CTA-free — navigation lives in the section
    // cards below it, so assert on those links instead. Both now lead to the
    // one catalogue; the cards still explain the two kinds separately.
    const links = screen.getAllByRole('link', { name: /browse studies/i })
    expect(links).toHaveLength(2)
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/studies')
    }
  })
})
