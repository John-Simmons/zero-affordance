import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A meal being cooked in two acts: stir, then bake.
 *
 * Determinate, but not in the way the other determinate variant is. The
 * progress bar interpolates one quantity continuously; this one cuts between
 * two discrete scenes at the half, so "how far along am I" is read off
 * *which* scene is showing rather than off how full something is. That is the
 * property under test — a narrative of named steps, where the steps are the
 * units of progress.
 *
 * Each scene loops on its own clock, which is not the violation of the
 * progress-driven contract it looks like. What that rule protects is anything
 * implying completion, because the Elo handicap corrects for the duration the
 * matchup assigned and an animation that finished early would be measuring a
 * wait that didn't happen. Every loop here returns to its own first frame, so
 * none of them implies an endpoint — they read as "this step is in progress",
 * exactly as `animate-spin` does on the classic spinner. The stage boundary is
 * the completion-implying part, and that is driven entirely by `progress`.
 *
 * ## Two acts at 1.25s
 *
 * An act gets half the run — 900–1800ms out of the 1800–3600ms band — so
 * whatever it is doing has to fit inside that or it is cut off partway through
 * the gesture. The unit to fit is the BEAT: one complete movement and back,
 * which is not always the same as one pass of the keyframes. Here it is: both
 * sets are a single beat across 0% to 100%, so the duration on the utility is
 * the duration of the gesture.
 *
 * Both numbers moved together, and the act length moved with them. Dropping
 * the pour cut the run into halves rather than thirds, which bought each
 * remaining act 300–600ms on its own; at the 0.75s the art arrived from Figma
 * at, that meant a beat and a half of stirring in a typical act, and the whole
 * thing read as hurried. At 1.25s a typical act is about one beat: the spoon
 * completes its sweep and returns, the steam rises and settles, once, and the
 * scene changes.
 *
 * At the SHORTEST act it is roughly three quarters of a beat — the spoon is
 * past the far end of its sweep and on the way back when the act ends, the
 * steam past its peak and descending. That is the trade for the slower tempo,
 * and it is the right way round: a gesture read as unhurried and cut off is
 * still legible as stirring, where a completed gesture at double speed reads
 * as frantic. The previous art was retimed against exactly this balance from
 * the other side.
 *
 * The two sets share a duration because they are the same decision, not
 * because anything couples them — the acts never appear together, so a future
 * change could pace them separately. What is genuinely coupled is inside the
 * bake act: the oven body, handle and timer are static and sit 40px lower than
 * the old rocking oven to make room for the steam above them, so moving any
 * one of those three means moving all three.
 *
 * Fixed durations, never a fraction of `durationMs`. Scaling a loop to the run
 * would make the pace of the artwork a readout of the wait's length, and the
 * one thing an idle must not do is leak the duration it is idling through —
 * the same trap documented on the quote indicator's ellipsis.
 *
 * A consequence worth knowing: a scene is still cut off wherever its loop
 * happens to be when the half ends, and a short run gives each act less than a
 * full beat. That is fine — each is an idle, so there is no moment in it the
 * participant is waiting to see — but it does mean the artwork must read as
 * itself from its first frame, since sometimes that is most of what plays.
 *
 * ## Why the file says cooking and the registry key says `baking`
 *
 * This replaced a hand-coded SVG bake, and the variant id has been deliberately
 * left alone through every redraw since — including the cut from three acts to
 * two. `computeElo` replays all history, so the matches that variant already
 * played stay in the path; a new id would have reset it to 1500 and split one
 * row of the standings into two. The same knowing trade the quote indicator
 * documents — what is under test is the format (an illustrated narrative that
 * visibly advances), and that has not changed, only the drawing has.
 *
 * ## Theming
 *
 * The Figma exports were `#454545` shapes on an opaque white rect. The rect is
 * gone so the canvas shows through, and every fill is `currentColor` off the
 * `text-muted-foreground` on each root `<svg>` — which is what makes these
 * invert with the theme instead of staying a dark-on-white postage stamp in
 * dark mode. Nothing is lost by flattening every shape to one colour: they were
 * already a single flat `#454545`, and the white was only ever the background.
 *
 * Muted rather than `text-foreground`, which is what these arrived on. This is
 * the only indicator drawn as large solid silhouettes, so full foreground put
 * far more ink on the canvas than anything it is rated against — the spinner is
 * a stroke on `text-muted-foreground`, the progress bar and the skeleton are
 * `bg-foreground` at 70% and 10% — and one variant reading as heavier than the
 * rest is a difference in the stimulus that has nothing to do with the format
 * being tested. The same token as the spinner, so the two match exactly.
 *
 * An opaque token rather than an alpha like the bar's `/70`, and that is not a
 * preference: these scenes stack filled paths — the handle and the timer sit on
 * top of the oven body, the spoon on the bowl — and a translucent fill would
 * composite at every overlap, drawing the seams as darker shapes that are not
 * in the artwork.
 *
 * Keyframes live in `cooking.css` next door; `origin-top-left` on each animated
 * element is load-bearing, see the note there.
 */

/** Act one: a spoon turns in the bowl. */
function StirScene() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-40 w-auto text-muted-foreground"
      role="presentation"
    >
      <g clipPath="url(#cooking-stir-clip)">
        {/* Bowl — static, the spoon turns inside it. */}
        <path
          transform="translate(94 212.667)"
          d="M212 5.33338C212 63.8756 164.542 111.333 106 111.333C47.4578 111.333 0 63.8756 0 5.33338C0 -5.6667 47.4578 5.33335 106 5.33335C164.542 5.33335 212 -6.66665 212 5.33338Z"
          fill="currentColor"
        />
        {/* Spoon */}
        <path
          transform="translate(216.279 264.919) rotate(-150)"
          d="M17.9336 0C27.8382 0 35.8672 11.241 35.8672 25.1074C35.8672 36.5371 30.4114 46.1806 22.9473 49.2178C22.9523 49.3102 22.9551 49.4033 22.9551 49.4971V142.753C22.9551 145.526 20.7069 147.774 17.9336 147.774C15.1604 147.774 12.9121 145.526 12.9121 142.753V49.4971C12.9121 49.4034 12.9148 49.3102 12.9199 49.2178C5.45598 46.1805 2.85259e-05 36.5369 0 25.1074C0 11.2411 8.02912 0.000163083 17.9336 0Z"
          fill="currentColor"
          className="origin-top-left animate-[stir-spoon_1.25s_linear_infinite]"
        />
      </g>
      <defs>
        <clipPath id="cooking-stir-clip">
          <rect width="400" height="400" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

/** Act two: it goes in the oven. */
function BakeScene() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-40 w-auto text-muted-foreground"
      role="presentation"
    >
      <g clipPath="url(#cooking-bake-clip)">
        {/* Oven body, door window and dials, as one subtracted path */}
        <path
          transform="translate(92 160)"
          d="M195 0C206.046 0 215 8.95431 215 20V159C215 170.046 206.046 179 195 179H20C8.95431 179 0 170.046 0 159V20C0 8.95431 8.95431 0 20 0H195ZM41.7246 40.6465C30.679 40.6466 21.7246 49.6008 21.7246 60.6465V141.021C21.7246 152.067 30.679 161.021 41.7246 161.021H173.275C184.321 161.021 193.275 152.067 193.275 141.021V60.6465C193.275 49.6008 184.321 40.6466 173.275 40.6465H41.7246ZM45.6973 8.59863C39.4913 8.59863 34.46 13.8478 34.46 20.3232C34.46 26.7987 39.4913 32.0479 45.6973 32.0479C51.903 32.0476 56.9335 26.7985 56.9336 20.3232C56.9336 13.8479 51.9031 8.59886 45.6973 8.59863ZM80.9062 8.59863C74.7003 8.59863 69.6689 13.8478 69.6689 20.3232C69.669 26.7987 74.7003 32.0479 80.9062 32.0479C87.1121 32.0477 92.1425 26.7986 92.1426 20.3232C92.1426 13.8479 87.1121 8.59882 80.9062 8.59863ZM147.833 10.9434C145.624 10.9434 143.833 12.7342 143.833 14.9434V28.0479C143.833 30.257 145.624 32.0479 147.833 32.0479H173.544C175.753 32.0476 177.544 30.2569 177.544 28.0479V14.9434C177.544 12.7344 175.753 10.9436 173.544 10.9434H147.833Z"
          fill="currentColor"
        />
        {/* Door handle */}
        <rect
          transform="translate(127 219)"
          width="146"
          height="11"
          rx="100"
          fill="currentColor"
        />
        {/* Timer */}
        <path
          transform="translate(200 215)"
          d="M0 4C0 1.79086 1.79086 0 4 0H39C41.2091 0 43 1.79086 43 4V59C43 61.2091 41.2091 63 39 63H4C1.79086 63 0 61.2091 0 59V4Z"
          fill="currentColor"
        />
        {/* Steam off the top — the only thing that moves in this act */}
        <path
          transform="translate(168 81)"
          d="M49.1426 0.0234375C51.8349 -0.361149 43.1531 4.02346 42.6426 9.52344C42.2831 13.3973 44.4409 15.3232 45.6426 19.0234C46.7869 22.5471 48.5303 24.3204 48.6426 28.0234C48.7661 32.0988 45.5449 40.0196 47.6426 36.5234C50.6425 31.5235 50.2065 28.7912 55.6426 26.0234C58.0094 24.8184 66.8522 24.0503 64.6426 25.5234C61.6426 27.5234 57.6821 31.546 58.6426 36.5234C59.2217 39.5244 61.2192 40.61 62.1426 43.5234C63.387 47.45 63.4826 49.9185 63.1426 54.0234C61.2244 77.1803 14.1316 74.7575 3.64258 54.0234C0.496517 47.8045 -0.383905 43.473 0.142578 36.5234C0.525545 31.4686 3.18359 18.9753 3.64258 24.0234C4.14258 29.5234 2.94102 36.9296 8.64258 38.0234C14.5126 39.1496 16.7532 31.8368 18.1426 26.0234C19.2854 21.2416 19.1873 17.7302 16.6426 13.5234C15.5683 11.7475 14.0576 11.3865 13.1426 9.52344C10.7449 4.6413 22.4749 10.5066 26.1426 14.5234C29.4733 18.1714 30.0238 21.5851 30.1426 26.5234C30.2541 31.1634 29.4473 35.3894 27.1426 38.0234C23.6426 42.0234 28.2292 36.9614 31.1426 34.0234C33.1425 32.0066 33.6426 32.5234 36.1426 27.0234C37.9886 22.9621 35.6578 16.4846 35.6426 12.0234C35.6337 9.41838 35.4999 7.54532 37.1426 5.52344C39.2066 2.98304 45.6426 0.523407 49.1426 0.0234375ZM37.1924 40.3057C37.6439 38.8936 35.4801 42.2928 34.623 43.3359C33.941 44.1664 33.4397 46.8542 33.4434 47.9238V47.9717C33.4495 49.7766 33.454 50.9874 34.623 52.875C35.2056 53.8158 33.4437 53.2558 32.3193 52.4941C31.1949 51.7323 32.0397 50.6228 31.7158 50.0234C31.3041 49.2617 30.3196 48.2782 29.7158 47.5234C27.7159 45.0236 24.6671 43.1137 25.9463 44.5234C28.2151 47.0234 26.2158 47.1236 27.2158 48.5234C28.2028 49.905 28.7157 51.0235 27.7158 52.5234C26.6227 54.1631 25.5479 54.9335 25.9463 57.0645C27.7152 66.5234 43.892 70.7628 44.6885 61.2539C44.982 57.7471 42.8237 54.7888 40.5654 52.4941C39.5067 51.4184 37.8172 50.4722 36.9072 49.251C35.8973 47.8955 35.4933 47.1141 35.6426 45.5234C35.8545 43.265 36.6431 42.0235 37.1924 40.3057Z"
          fill="currentColor"
          className="origin-top-left animate-[bake-steam_1.25s_linear_infinite]"
        />
      </g>
      <defs>
        <clipPath id="cooking-bake-clip">
          <rect width="400" height="400" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

/**
 * The two acts in order, half the run each.
 *
 * Ordered, not keyed by name: the index IS the schedule, so the split is read
 * off the array's length rather than written down beside it. Dropping the pour
 * from this array is the whole of what re-cut the run from thirds into halves,
 * and adding a scene back would re-divide it again with no other edit.
 */
const SCENES = [StirScene, BakeScene]

export function CookingIndicator({ progress }: { progress: number }) {
  const p = clamp01(progress)
  // `Math.min` because p === 1 floors to SCENES.length and would index off the
  // end — and p === 1 is not an edge case here but the state the recap panel
  // mounts every single indicator in.
  const Scene =
    SCENES[Math.min(Math.floor(p * SCENES.length), SCENES.length - 1)]

  return <Scene />
}
