import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { HomePage } from '@/routes/home'
import { ThemeProvider } from '@/providers/theme-provider'
import { siteConfig } from '@/config/site'

describe('HomePage', () => {
  it('renders the tagline and primary CTAs', () => {
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
    expect(
      screen.getByRole('link', { name: /take a survey/i }),
    ).toBeInTheDocument()
  })
})
