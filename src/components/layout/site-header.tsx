import { NavLink } from 'react-router'
import { TvMinimalPlay } from 'lucide-react'

import { Container } from '@/components/layout/container'
import { MobileNav } from '@/components/layout/mobile-nav'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <Container className="flex h-14 items-center gap-4">
        <NavLink to="/" className="font-heading text-base font-semibold">
          {siteConfig.name}
        </NavLink>

        {/* Labelled because the footer now has a nav too — without names the
            two landmarks are indistinguishable to a screen reader. */}
        <nav
          aria-label="Main"
          className="ml-2 hidden items-center gap-1 sm:flex"
        >
          {siteConfig.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end={item.href === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                  isActive && 'font-medium text-foreground',
                )
              }
            >
              {item.title}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label="YouTube channel"
          >
            <a href={siteConfig.youtubeUrl} target="_blank" rel="noreferrer">
              <TvMinimalPlay />
            </a>
          </Button>
          <ThemeToggle />
          <MobileNav />
        </div>
      </Container>
    </header>
  )
}
