/**
 * Central site configuration — name, nav, and external links.
 * Edit here rather than hard-coding strings across components.
 */
export interface NavItem {
  title: string
  href: string
}

export const siteConfig = {
  name: 'Zero Affordance',
  tagline: 'The psychology of how we interact with technology.',
  description:
    'A companion to the Zero Affordance series on YouTube — interactive surveys and experiments about UX, human–computer interaction, and the mind.',
  youtubeUrl: 'https://www.youtube.com/@johnsim',
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Studies', href: '/studies' },
    { title: 'Video Ideas', href: '/ideas' },
    { title: 'About', href: '/about' },
  ] satisfies NavItem[],
} as const
