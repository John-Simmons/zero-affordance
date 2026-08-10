import { NavLink } from 'react-router'
import { TvMinimalPlay } from 'lucide-react'

import { Container } from '@/components/layout/container'
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

        <nav className="ml-2 hidden items-center gap-1 sm:flex">
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
        </div>
      </Container>
    </header>
  )
}
