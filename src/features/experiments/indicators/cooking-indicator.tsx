import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A meal being cooked in three acts: pour, stir, bake.
 *
 * Determinate, but not in the way the other determinate variant is. The
 * progress bar interpolates one quantity continuously; this one cuts between
 * three discrete scenes at the thirds, so "how far along am I" is read off
 * *which* scene is showing rather than off how full something is. That is the
 * property under test — a narrative of named steps, where the steps are the
 * units of progress.
 *
 * Each scene loops on its own 2s clock, which is not the violation of the
 * progress-driven contract it looks like. What that rule protects is anything
 * implying completion, because the Elo handicap corrects for the duration the
 * matchup assigned and an animation that finished early would be measuring a
 * wait that didn't happen. Every loop here returns to its own first frame, so
 * none of them implies an endpoint — they read as "this step is in progress",
 * exactly as `animate-spin` does on the classic spinner. The stage boundary is
 * the completion-implying part, and that is driven entirely by `progress`.
 *
 * A consequence worth knowing: a scene is cut off wherever its 2s loop happens
 * to be when the third ends, and a ~2.5s run gives each scene well under one
 * full cycle. That is fine — each is an idle, so there is no moment in it the
 * participant is waiting to see — but it does mean the artwork must read as
 * itself from its first frame, since sometimes that is nearly all that plays.
 *
 * ## Why the file says cooking and the registry key says `baking`
 *
 * This replaced a hand-coded SVG bake, and the variant id was deliberately left
 * alone. `computeElo` replays all history, so the matches that variant already
 * played stay in the path; a new id would have reset it to 1500 and split one
 * row of the standings into two. The same knowing trade the quote indicator
 * documents — what is under test is the format (an illustrated narrative that
 * visibly advances), and that has not changed, only the drawing has.
 *
 * ## Theming
 *
 * The Figma exports were `#454545` shapes on an opaque white rect. The rect is
 * gone so the canvas shows through, and every fill is `currentColor` off the
 * `text-foreground` on each root `<svg>` — which is what makes these invert with
 * the theme instead of staying a dark-on-white postage stamp in dark mode.
 * Nothing is lost by flattening every shape to one colour: they were already a
 * single flat `#454545`, and the white was only ever the background.
 *
 * Keyframes live in `cooking.css` next door; `origin-top-left` on each animated
 * element is load-bearing, see the note there.
 */

/** Act one: the jug tips over the bowl. */
function PourScene() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-40 w-auto text-foreground"
      role="presentation"
    >
      <g clipPath="url(#cooking-pour-clip)">
        {/* Bowl — static, the one fixed thing across the first two acts. */}
        <path
          transform="translate(94 212.667)"
          d="M212 5.33338C212 63.8756 164.542 111.333 106 111.333C47.4578 111.333 0 63.8756 0 5.33338C0 -5.6667 47.4578 5.33335 106 5.33335C164.542 5.33335 212 -6.66665 212 5.33338Z"
          fill="currentColor"
        />
        {/* Jug */}
        <rect
          transform="translate(214.066 156.384) rotate(-110.099)"
          width="71"
          height="101"
          rx="5"
          fill="currentColor"
          className="origin-top-left animate-[pour-jug_2s_linear_infinite]"
        />
        {/* The stream falling from it */}
        <path
          transform="translate(184 127)"
          d="M26.7697 0.612427C31.7846 5.34578 31.0289 10.1601 32.0792 16.607C33.1294 23.0539 30.9193 28.8917 31.4155 36.7483C31.9117 44.6049 37.914 61.0597 38.0523 67.5526C38.1906 74.0455 36.1616 77.9871 36.7249 84.1395C37.2883 90.292 42.2395 93.5222 40.707 99.5417C39.1745 105.561 3.45124 105.602 0.886167 98.9493C-1.67891 92.2962 1.91386 87.91 4.20457 81.1776C6.49528 74.4452 12.2755 69.8025 14.8235 61.6287C17.3714 53.4549 13.3473 43.0619 15.4871 31.4168C17.627 19.7716 21.7548 -4.12093 26.7697 0.612427Z"
          fill="currentColor"
          className="origin-top-left animate-[pour-stream_2s_linear_infinite]"
        />
      </g>
      <defs>
        <clipPath id="cooking-pour-clip">
          <rect width="400" height="400" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}

/** Act two: a spoon turns in the same bowl. */
function StirScene() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-40 w-auto text-foreground"
      role="presentation"
    >
      <g clipPath="url(#cooking-stir-clip)">
        {/*
          Byte-for-byte the bowl from PourScene, and deliberately duplicated
          rather than hoisted into a shared component. The two scenes are
          separate exports that happen to agree today; factoring the agreement
          out would make a later edit to one silently change the other.
        */}
        <path
          transform="translate(94 212.667)"
          d="M212 5.33338C212 63.8756 164.542 111.333 106 111.333C47.4578 111.333 0 63.8756 0 5.33338C0 -5.6667 47.4578 5.33335 106 5.33335C164.542 5.33335 212 -6.66665 212 5.33338Z"
          fill="currentColor"
        />
        {/* Spoon */}
        <path
          transform="translate(265.465 267.928) rotate(-163.925)"
          d="M17.9336 0C27.8382 0 35.8672 11.241 35.8672 25.1074C35.8672 36.5371 30.4114 46.1806 22.9473 49.2178C22.9523 49.3102 22.9551 49.4033 22.9551 49.4971V142.753C22.9551 145.526 20.7069 147.774 17.9336 147.774C15.1604 147.774 12.9121 145.526 12.9121 142.753L12.9121 49.4971C12.9121 49.4034 12.9148 49.3102 12.9199 49.2178C5.45598 46.1805 2.85259e-05 36.5369 0 25.1074C0 11.2411 8.02912 0.000163083 17.9336 0Z"
          fill="currentColor"
          className="origin-top-left animate-[stir-spoon_2s_linear_infinite]"
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

/** Act three: it goes in the oven. */
function BakeScene() {
  return (
    <svg
      viewBox="0 0 400 400"
      className="h-40 w-auto text-foreground"
      role="presentation"
    >
      <g clipPath="url(#cooking-bake-clip)">
        {/* Oven body, door window and dials, as one subtracted path */}
        <path
          transform="translate(92 120)"
          d="M195 0C206.046 0 215 8.95431 215 20V159C215 170.046 206.046 179 195 179H20C8.95431 179 0 170.046 0 159V20C0 8.95431 8.95431 0 20 0H195ZM41.7246 40.6465C30.679 40.6466 21.7246 49.6008 21.7246 60.6465V141.021C21.7246 152.067 30.679 161.021 41.7246 161.021H173.275C184.321 161.021 193.275 152.067 193.275 141.021V60.6465C193.275 49.6008 184.321 40.6466 173.275 40.6465H41.7246ZM45.6973 8.59863C39.4913 8.59863 34.46 13.8478 34.46 20.3232C34.46 26.7987 39.4913 32.0479 45.6973 32.0479C51.903 32.0476 56.9335 26.7985 56.9336 20.3232C56.9336 13.8479 51.9031 8.59886 45.6973 8.59863ZM80.9062 8.59863C74.7003 8.59863 69.6689 13.8478 69.6689 20.3232C69.669 26.7987 74.7003 32.0479 80.9062 32.0479C87.1121 32.0477 92.1425 26.7986 92.1426 20.3232C92.1426 13.8479 87.1121 8.59882 80.9062 8.59863ZM147.833 10.9434C145.624 10.9434 143.833 12.7342 143.833 14.9434V28.0479C143.833 30.257 145.624 32.0479 147.833 32.0479H173.544C175.753 32.0476 177.544 30.2569 177.544 28.0479V14.9434C177.544 12.7344 175.753 10.9436 173.544 10.9434H147.833Z"
          fill="currentColor"
          className="origin-top-left animate-[bake-body_2s_linear_infinite]"
        />
        {/* Door handle */}
        <rect
          transform="translate(127 179)"
          width="146"
          height="11"
          rx="100"
          fill="currentColor"
          className="origin-top-left animate-[bake-handle_2s_linear_infinite]"
        />
        {/* Timer */}
        <path
          transform="translate(200 175)"
          d="M0 4C0 1.79086 1.79086 0 4 0H39C41.2091 0 43 1.79086 43 4V59C43 61.2091 41.2091 63 39 63H4C1.79086 63 0 61.2091 0 59V4Z"
          fill="currentColor"
          className="origin-top-left animate-[bake-timer_2s_linear_infinite]"
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
 * The three acts in order, an equal third of the run each.
 *
 * Ordered, not keyed by name: the index IS the schedule, so the split is read
 * off the array's length rather than written down beside it. Adding a fourth
 * scene re-divides the run into quarters with no other edit.
 */
const SCENES = [PourScene, StirScene, BakeScene]

export function CookingIndicator({ progress }: { progress: number }) {
  const p = clamp01(progress)
  // `Math.min` because p === 1 floors to SCENES.length and would index off the
  // end — and p === 1 is not an edge case here but the state the recap panel
  // mounts every single indicator in.
  const Scene =
    SCENES[Math.min(Math.floor(p * SCENES.length), SCENES.length - 1)]

  return <Scene />
}
