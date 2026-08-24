import { NavLink } from 'react-router'

import { Container } from '@/components/layout/container'
import { siteConfig } from '@/config/site'
import { DATA_SOURCE_LABEL } from '@/lib/data'
import { cn } from '@/lib/utils'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 py-8 text-sm text-muted-foreground">
      <Container className="flex flex-col items-center gap-4">
        {/*
          A second route to every page, at every width — not a mobile fallback.

          Deliberately plain anchors: no overlay, no focus management, nothing to
          open or close. If the header menu ever breaks, this still works, and it
          is the path that gives `/about` an entry point at all — nothing else in
          the app links to it.
        */}
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
        >
          {siteConfig.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                cn(
                  'transition-colors hover:text-foreground',
                  isActive && 'font-medium text-foreground',
                )
              }
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="flex flex-col items-center justify-between gap-2 self-stretch sm:flex-row">
          <p>
            © {new Date().getFullYear()} {siteConfig.name}
          </p>
          <p className="text-xs">
            Data source:{' '}
            <span className="font-medium">{DATA_SOURCE_LABEL}</span>
          </p>
        </div>
      </Container>
    </footer>
  )
}
