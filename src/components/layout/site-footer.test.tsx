import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { SiteFooter } from '@/components/layout/site-footer'
import { siteConfig } from '@/config/site'

describe('SiteFooter', () => {
  it('links to every configured route', () => {
    render(
      <MemoryRouter>
        <SiteFooter />
      </MemoryRouter>,
    )

    // Addressed by landmark name rather than by link text: the header carries
    // the same four names, so an unscoped query would be ambiguous the moment
    // both are on the page.
    const nav = screen.getByRole('navigation', { name: 'Footer' })
    for (const item of siteConfig.nav) {
      expect(
        within(nav).getByRole('link', { name: item.title }),
      ).toHaveAttribute('href', item.href)
    }
  })
})
