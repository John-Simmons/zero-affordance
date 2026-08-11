import { Container } from '@/components/layout/container'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/config/site'

export function AboutPage() {
  return (
    <Container className="max-w-2xl py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        About {siteConfig.name}
      </h1>
      <div className="mt-6 space-y-4 text-pretty text-muted-foreground">
        <p>
          {siteConfig.name} is a companion to the YouTube series of the same name created by John Simmons exploring UX
          design, human–computer interaction, and psychology. Videos pose the
          questions; this site lets you take part.
        </p>
        <p>
          Every survey and experiment here stores real, evolving data — so the
          results you see reflect the community as it grows. Nothing requires an
          account; participation is anonymous.
        </p>
      </div>
      <Button asChild className="mt-8">
        <a href={siteConfig.youtubeUrl} target="_blank" rel="noreferrer">
          Visit the channel
        </a>
      </Button>
    </Container>
  )
}
