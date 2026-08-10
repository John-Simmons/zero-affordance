import { Container } from '@/components/layout/container'
import { siteConfig } from '@/config/site'
import { DATA_SOURCE_LABEL } from '@/lib/data'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/60 py-8 text-sm text-muted-foreground">
      <Container className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}
        </p>
        <p className="text-xs">
          Data source: <span className="font-medium">{DATA_SOURCE_LABEL}</span>
        </p>
      </Container>
    </footer>
  )
}
