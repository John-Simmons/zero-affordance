/**
 * The default: a rotating arc.
 *
 * Indeterminate on purpose — it ignores `progress` entirely and spins at its own
 * rate. That is not a violation of the progress-driven contract but the point of
 * this variant: it signals activity while conveying nothing about how much is
 * left, which is exactly the property the experiment is testing.
 */
export function ClassicSpinner() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-12 animate-spin text-muted-foreground"
      role="presentation"
    >
      {/* Track */}
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="opacity-20"
      />
      {/* Arc — a quarter of the circumference (2πr ≈ 119.4). */}
      <circle
        cx="24"
        cy="24"
        r="19"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="30 90"
      />
    </svg>
  )
}
