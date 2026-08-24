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
      //
      // A centred column rather than the full canvas: during playback the frame
      // is the full width of the card (~750px), and body text run across all of
      // it wraps at ~110 characters, which reads like a wall rather than a page.
      className="mx-auto max-w-sm animate-in space-y-2 duration-200 fade-in-0"
    >
      <h4 className="text-sm leading-snug font-medium text-foreground">
        Lorem ipsum dolor sit amet
      </h4>
      <p className="text-[10px] text-muted-foreground uppercase">
        Consectetur · 4 min read
      </p>
      {/*
        Deliberately taller than the frame. The canvas clips it (overflow-hidden
        on STIMULUS_CANVAS), so the article is cut mid-paragraph the way a real
        page continues below the fold — which is the point, since a page that
        ends neatly inside the box reads as a mock rather than as content.

        Paragraph lengths are uneven both because real prose is, and because
        even ones would risk the cut landing exactly on a paragraph break, where
        it would look like the text simply ran out.
      */}
      <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
        <p>
          Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut
          enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi
          ut aliquip ex ea commodo consequat. Duis aute irure dolor in
          reprehenderit in voluptate velit esse.
        </p>
        <p>
          Excepteur sint occaecat cupidatat non proident, sunt in culpa qui
          officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde
          omnis iste natus error sit voluptatem.
        </p>
        <p>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
          fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem
          sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor
          sit amet, consectetur, adipisci velit, sed quia non numquam eius modi
          tempora incidunt.
        </p>
        <p>
          Ut labore et dolore magnam aliquam quaerat voluptatem. Quis autem vel
          eum iure reprehenderit qui in ea voluptate velit esse quam nihil
          molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas
          nulla pariatur. Temporibus autem quibusdam et aut officiis debitis aut
          rerum necessitatibus saepe eveniet.
        </p>
        <p>
          At vero eos et accusamus et iusto odio dignissimos ducimus qui
          blanditiis praesentium voluptatum deleniti atque corrupti quos dolores
          et quas molestias excepturi sint occaecati cupiditate non provident,
          similique sunt in culpa.
        </p>
        <p>
          Et harum quidem rerum facilis est et expedita distinctio. Nam libero
          tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
          minus id quod maxime placeat facere possimus.
        </p>
      </div>
    </article>
  )
}
