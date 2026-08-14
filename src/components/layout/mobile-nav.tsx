import { Menu } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { siteConfig } from '@/config/site'
import { cn } from '@/lib/utils'

/**
 * The site navigation on screens too narrow for the header's inline nav.
 *
 * Without this the app has almost no navigation on a phone: the header nav is
 * `hidden … sm:flex`, the footer carried no links, and `/about` is linked from
 * nowhere else at all — so it was reachable only by typing the URL.
 *
 * `sm:hidden` on the trigger rather than a `useMediaQuery` swap. Tailwind's
 * `hidden` is `display: none`, which removes the element from the accessibility
 * tree outright, so exactly one of this and the inline nav is ever exposed —
 * and the two can't drift out of step the way two independent breakpoint
 * definitions would.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="sm:hidden">
        {/* Matches ThemeToggle beside it — the house pattern for an icon-only
            control is a ghost icon Button carrying an explicit aria-label. */}
        <Button variant="ghost" size="icon" aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>

      <SheetContent side="right">
        <SheetHeader>
          {/*
            A dialog with no accessible name is an outright a11y failure, and
            Radix warns about it — so the title is load-bearing, not decoration.
            The description is only here to satisfy `aria-describedby`; it says
            nothing a sighted user needs, hence sr-only.
          */}
          <SheetTitle>{siteConfig.name}</SheetTitle>
          <SheetDescription className="sr-only">
            Links to the main sections of the site.
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Main" className="flex flex-col px-2">
          {siteConfig.nav.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              // `/` prefix-matches every route, so Home needs an exact match or
              // it renders active everywhere.
              end={item.href === '/'}
              /*
                Closing on the click itself, rather than on a `useLocation`
                effect watching the pathname: tapping the entry for the route
                you are already on doesn't change the pathname, so an effect
                would never fire and the panel would just sit there.

                Plain `onClick` rather than wrapping in `SheetClose asChild` —
                that works too, but Radix's close merges `type="button"` onto
                whatever it clones, and `type` on an `<a>` is not a valid
                attribute (it means something else entirely).
              */
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2.5 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                  isActive && 'bg-muted font-medium text-foreground',
                )
              }
            >
              {item.title}
            </NavLink>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
