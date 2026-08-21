/**
 * Central site configuration — name, nav, and external links.
 * Edit here rather than hard-coding strings across components.
 */
export interface NavItem {
  title: string
  href: string
}

/** One numbered sense of a dictionary entry, with an optional usage example. */
export interface DefinitionSense {
  sense: string
  example?: string
  /** Credited after the example, outside its quotation marks. */
  attribution?: string
}

export const siteConfig = {
  name: 'Zero Affordance',
  tagline: 'Exploring how we interact with everyday technology.',
  /** Not currently rendered — kept for reuse in the hero or page metadata. */
  description:
    'Finding answers through studies about the everyday products and interactions in our lives.',
  /** Rendered as a dictionary entry in the home page hero. */
  definition: {
    headword: 'affordance',
    partOfSpeech: 'noun',
    pronunciation: '/əˈfɔːdəns/',
    senses: [
      {
        sense:
          'the quality or property of an object or interface that makes clear how it can or should be used.',
        example:
          'How am I supposed to use this terrible app when there are zero affordances?',
        attribution: 'me (often)',
      },
    ] satisfies DefinitionSense[],
  },
  youtubeUrl: 'https://www.youtube.com/@johnsim',
  nav: [
    { title: 'Home', href: '/' },
    { title: 'Studies', href: '/studies' },
    { title: 'Video Ideas', href: '/ideas' },
    { title: 'About', href: '/about' },
  ] satisfies NavItem[],
} as const
