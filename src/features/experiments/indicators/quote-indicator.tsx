import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A line of text to read while you wait, with an animating ellipsis.
 *
 * The quote varies per appearance. Text only alters a perceived wait while it
 * is being *read*, and a line you have already seen is scenery — with one fixed
 * quote this variant came up in five of the fifteen matchups and was read
 * properly in roughly one of them, so four fifths of its rating measured a
 * block of familiar shapes rather than the format under test.
 *
 * Which quote is chosen by `seed`, a prop, rather than picked in here. Three
 * reasons, and the second is the load-bearing one:
 *
 *   1. `progress` re-renders this ~150 times per appearance, so a pick in the
 *      render body would strobe. React's StrictMode double-invokes render too.
 *   2. The runner mounts this component TWICE for one appearance — once in the
 *      stimulus canvas, then again from scratch in the vote-time recap panel at
 *      `progress={1}`. Anything drawn inside would differ between the two, and
 *      the recap would be reminding the participant of something that never
 *      played.
 *   3. Keeping it a pure function of props is what keeps the tests honest.
 *
 * The pool is matched for length on purpose. Length is what this variant asks
 * of the participant, so a 30-character line and a 140-character one are not
 * the same stimulus, and the difference would land in this variant's own
 * rating as noise. The upper bound is set by the recap panel on a phone, which
 * is about 114px tall and clips anything past three lines.
 *
 * The variant id is deliberately unchanged, so this rating still carries
 * matches played when it showed one fixed quote — `computeElo` replays all
 * history, so those votes stay in the path. A knowing trade: a new id would
 * have reset to 1500 and split one format across two rows, and the format —
 * something to read — is what is under test, not the particular line.
 *
 * Only the ellipsis tracks `progress`, and it cycles rather than advancing to a
 * fixed end — so this signals activity without implying completion.
 */
const QUOTES: { text: string; author: string }[] = [
  {
    text: 'Good design is as little design as possible.',
    author: 'Dieter Rams',
  },
  {
    text: 'The details are not the details. They make the design.',
    author: 'Charles Eames',
  },
  {
    text: 'Simple things should be simple, complex things should be possible.',
    author: 'Alan Kay',
  },
  {
    text: 'People ignore design that ignores people.',
    author: 'Frank Chimero',
  },
  { text: 'Above all else show the data.', author: 'Edward Tufte' },
  {
    text: "Design is so simple, that's why it is so complicated.",
    author: 'Paul Rand',
  },
  {
    text: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
  },
  {
    text: 'The most profound technologies are those that disappear.',
    author: 'Mark Weiser',
  },
  {
    text: 'Any sufficiently advanced technology is indistinguishable from magic.',
    author: 'Arthur C. Clarke',
  },
  {
    text: 'Design is the silent ambassador of your brand.',
    author: 'Paul Rand',
  },
  {
    text: 'Good design is obvious. Great design is transparent.',
    author: 'Joe Sparano',
  },
  {
    text: 'Styles come and go. Good design is a language, not a style.',
    author: 'Massimo Vignelli',
  },
  { text: 'Design is thinking made visual.', author: 'Saul Bass' },
  { text: 'Good design is good business.', author: 'Thomas Watson Jr.' },
  {
    text: 'Digital design is like painting, except the paint never dries.',
    author: 'Neville Brody',
  },
]

/**
 * Defensive in the same spirit as `clamp01`, and for the same reason: a
 * negative first tick once indexed `frames[-1]` and took the page down on
 * `undefined.padEnd()`. `QUOTES[seed % QUOTES.length]` has exactly that shape
 * for a negative or non-finite seed.
 */
function quoteFor(seed: number) {
  const n = QUOTES.length
  if (!Number.isFinite(seed)) return QUOTES[0]
  return QUOTES[((Math.trunc(seed) % n) + n) % n]
}

export function QuoteIndicator({
  progress,
  seed,
}: {
  progress: number
  seed: number
}) {
  const { text, author } = quoteFor(seed)
  // Cycles roughly six times over a run, independent of how long that run is.
  const dots = Math.floor(clamp01(progress) * 18) % 4

  return (
    <figure className="max-w-md space-y-3 text-center">
      <blockquote className="text-base leading-relaxed text-balance text-foreground">
        “{text}”
      </blockquote>
      <figcaption className="text-xs text-muted-foreground">
        {author}
      </figcaption>
      {/* Fixed width so a changing dot count can never reflow the line above. */}
      <span className="block font-mono text-sm whitespace-pre text-muted-foreground">
        {'.'.repeat(dots).padEnd(3, ' ')}
      </span>
    </figure>
  )
}
