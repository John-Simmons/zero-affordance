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
    'A companion to the Zero Affordance YouTube channel — interactive surveys and experiments about UX, human–computer interaction, and the mind.',
  // TODO: replace with your real channel URL.
  youtubeUrl: 'https://www.youtube.com/',
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Surveys', href: '/surveys' },
    { title: 'Experiments', href: '/experiments' },
    { title: 'About', href: '/about' },
  ] satisfies NavItem[],
} as const
