import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'

import { SiteHeader } from '@/components/layout/site-header'
import { siteConfig } from '@/config/site'
import { ThemeProvider } from '@/providers/theme-provider'

/**
 * `ThemeProvider` because the header renders `ThemeToggle`, which throws
 * without it; `MemoryRouter` because every link is a `NavLink`.
 *
 * Note Tailwind classes do nothing in happy-dom, so `hidden sm:flex` hides
 * nothing here — the inline nav and the mobile trigger both render, and every
 * link name appears more than once. Queries have to be scoped, which is exactly
 * what the `aria-label` on each `<nav>` is for.
 */
function renderHeader() {
  return render(
    <ThemeProvider>
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('SiteHeader', () => {
  it('offers a labelled menu trigger, closed to begin with', () => {
    renderHeader()
    expect(
      screen.getByRole('button', { name: /open menu/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a named panel listing every configured route', async () => {
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: /open menu/i }))

    const panel = await screen.findByRole('dialog')
    // Driven off the config rather than four hardcoded names, so adding a route
    // cannot leave the mobile menu quietly behind.
    for (const item of siteConfig.nav) {
      expect(
        within(panel).getByRole('link', { name: item.title }),
      ).toBeInTheDocument()
    }
  })

  it('closes the panel when a link is followed', async () => {
    // The regression this whole change is about: a NavLink inside an overlay
    // navigates without dismissing it, leaving the menu open over the new page.
    const user = userEvent.setup()
    renderHeader()
    await user.click(screen.getByRole('button', { name: /open menu/i }))

    const panel = await screen.findByRole('dialog')
    await user.click(within(panel).getByRole('link', { name: 'About' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks the current route, and only that route', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/studies']}>
          <SiteHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: /open menu/i }))
    const panel = within(await screen.findByRole('dialog'))

    expect(panel.getByRole('link', { name: 'Studies' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // The `end` guard: without it "/" prefix-matches every route and Home
    // renders active on all of them.
    expect(panel.getByRole('link', { name: 'Home' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('closes even when the destination is the current route', async () => {
    // The case a `useLocation` effect would miss — the pathname never changes,
    // so nothing would fire and the panel would sit there.
    const user = userEvent.setup()
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/about']}>
          <SiteHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )
    await user.click(screen.getByRole('button', { name: /open menu/i }))

    const panel = await screen.findByRole('dialog')
    await user.click(within(panel).getByRole('link', { name: 'About' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
