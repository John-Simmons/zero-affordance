import { clamp01 } from '@/features/experiments/indicators/clamp'

/**
 * A stylised bread bake, driven entirely by `progress`.
 *
 * Determinate: the dough rises, the oven warms, and the loaf is scored and
 * steaming exactly as the run ends. Nothing here animates on its
 * own clock, so a 1.2s slot and a 2.4s slot both tell a complete story — which
 * matters because the Elo handicap corrects for that assigned duration.
 *
 * Achromatic on purpose. The palette is entirely `oklch(L 0 0)` apart from
 * --destructive and --success, both of which mean something specific; a warm
 * oven glow would be the only hardcoded colour in the codebase. Heat is
 * conveyed with opacity instead.
 *
 * This is motion graphics, not character illustration. If it ever wants to be
 * the latter, only this file changes: swap the SVG for a Lottie scrubbed to
 * `progress` and every other layer stays put.
 */
export function BakingIndicator({ progress }: { progress: number }) {
  const p = clamp01(progress)

  // Dough roughly doubles in height and spreads a little as it proves.
  const doughRx = 15 + p * 8
  const doughRy = 5 + p * 8
  const doughCy = 74 - p * 4

  // The oven warms through the first two-thirds, then holds.
  const heat = Math.min(p / 0.66, 1)

  // Scoring appears once there is a loaf to score; steam only near the end.
  const scored = p > 0.55 ? Math.min((p - 0.55) / 0.2, 1) : 0
  const steam = p > 0.72 ? Math.min((p - 0.72) / 0.2, 1) : 0

  return (
    <svg
      viewBox="0 0 140 110"
      className="h-40 w-auto text-foreground"
      role="presentation"
    >
      {/* Oven body */}
      <rect
        x="18"
        y="22"
        width="104"
        height="80"
        rx="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        className="opacity-70"
      />

      {/* Door window, glowing as it heats */}
      <rect
        x="31"
        y="38"
        width="78"
        height="50"
        rx="7"
        fill="currentColor"
        style={{ opacity: 0.04 + heat * 0.12 }}
      />
      <rect
        x="31"
        y="38"
        width="78"
        height="50"
        rx="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="opacity-40"
      />

      {/* Baking tray */}
      <rect
        x="44"
        y="79"
        width="52"
        height="3"
        rx="1.5"
        fill="currentColor"
        className="opacity-30"
      />

      {/* The loaf */}
      <ellipse
        cx="70"
        cy={doughCy}
        rx={doughRx}
        ry={doughRy}
        fill="currentColor"
        style={{ opacity: 0.25 + p * 0.45 }}
      />

      {/* Slashes across the top, once it has risen */}
      {scored > 0 && (
        <g
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ opacity: scored * 0.5 }}
        >
          <line x1="62" y1={doughCy - 3} x2="67" y2={doughCy - 6} />
          <line x1="70" y1={doughCy - 4} x2="75" y2={doughCy - 7} />
        </g>
      )}

      {/* Steam, drifting once it is nearly done */}
      {steam > 0 && (
        <g
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          style={{ opacity: steam * 0.45 }}
        >
          <path
            d="M60 60 q-3 -5 0 -9 q3 -4 0 -8"
            className="animate-[steam_2.2s_ease-in-out_infinite]"
          />
          <path
            d="M70 57 q-3 -5 0 -9 q3 -4 0 -8"
            className="animate-[steam_2.2s_ease-in-out_infinite_0.4s]"
          />
          <path
            d="M80 60 q-3 -5 0 -9 q3 -4 0 -8"
            className="animate-[steam_2.2s_ease-in-out_infinite_0.8s]"
          />
        </g>
      )}
    </svg>
  )
}
