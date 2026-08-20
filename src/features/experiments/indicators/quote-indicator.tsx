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
 *   1. This used to re-render ~150 times per appearance off `progress`, so a
 *      pick in the render body would strobe. It no longer takes `progress`, but
 *      React's StrictMode still double-invokes render.
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
 * Nothing here tracks `progress` — the component does not take it. The ellipsis
 * cycles on its own fixed clock, which is what keeps it saying only "still
 * working": it names no endpoint, and it ticks at the same rate whatever
 * duration the matchup assigned. See the note on it below.
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

/**
 * One fill-and-clear of the ellipsis, a dot per quarter.
 *
 * 600ms is the rate this used to run at in the middle of the duration band,
 * kept so the stimulus is unchanged for a typical matchup: the old ellipsis
 * fitted 18 steps — 4.5 cycles — into whatever the run was, and the band's
 * midpoint is 2700ms.
 *
 * Spelled out one class at a time rather than built from a loop. Tailwind scans
 * source text and never executes it, so `animate-[quote-dot-${n}_…]` compiles to
 * nothing at all: the classes land in the DOM, no rule is ever generated for
 * them, and the ellipsis silently sits still. These three strings have to
 * survive a grep for the utility to exist.
 */
const DOT_ANIMATIONS = [
  'animate-[quote-dot-1_600ms_linear_infinite]',
  'animate-[quote-dot-2_600ms_linear_infinite]',
  'animate-[quote-dot-3_600ms_linear_infinite]',
]

export function QuoteIndicator({ seed }: { seed: number }) {
  const { text, author } = quoteFor(seed)

  return (
    <figure className="max-w-md space-y-3 text-center">
      <blockquote className="text-base leading-relaxed text-balance text-foreground">
        “{text}”
      </blockquote>
      <figcaption className="text-xs text-muted-foreground">
        {author}
      </figcaption>
      {/*
        All three dots are always in the layout and only their opacity cycles,
        so a changing count can never reflow the line above.

        Self-timed, and this is the one place in the component where that is
        correct. Deriving the dots from `progress` fitted a fixed NUMBER of
        cycles into the run, which is not the same thing as a fixed rate: the
        band runs 1800–3600ms, so the ellipsis ticked twice as fast on a short
        matchup as on a long one and the variant quietly leaked its own duration
        into the one signal that is meant to say nothing but "still working".
        A participant reading two of these back to back could feel the
        difference.

        Running on its own clock is no more a violation here than it is for the
        spinner or the shimmer, and for the same reason: the cycle returns to
        its own first frame, so it names no endpoint and cannot imply
        completion. Nothing about the Elo handicap is disturbed by it.
      */}
      <span className="block font-mono text-sm text-muted-foreground">
        {DOT_ANIMATIONS.map((animation) => (
          <span key={animation} className={animation}>
            .
          </span>
        ))}
      </span>
    </figure>
  )
}
