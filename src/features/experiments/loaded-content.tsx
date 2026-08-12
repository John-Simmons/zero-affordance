/**
 * The "page" that arrives once loading finishes.
 *
 * Takes no props on purpose. Every variant and both sides must reveal exactly
 * the same content — if what loaded differed between two loading states, the
 * participant would partly be judging the payload rather than the wait, and the
 * ratings would stop isolating the animation.
 *
 * The `skeleton` indicator mirrors this layout block for block. That
 * correspondence is the whole premise of skeleton screens, so the two are
 * intended to be edited together.
 */
export function LoadedContent() {
  return (
    <article
      // Identical across variants, so the fade cannot bias a comparison; it is
      // here because an instant snap reads less like a real page arriving.
      className="animate-in space-y-2 duration-200 fade-in-0"
    >
      <h4 className="text-sm leading-snug font-medium text-foreground">
        Lorem ipsum dolor sit amet
      </h4>
      <p className="text-[10px] text-muted-foreground uppercase">
        Consectetur · 4 min read
      </p>
      <div className="space-y-1.5 text-xs leading-relaxed text-muted-foreground">
        <p>
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
          enim ad minim veniam, quis nostrud exercitation ullamco laboris.
        </p>
        <p>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum
          dolore eu fugiat nulla pariatur.
        </p>
      </div>
    </article>
  )
}
