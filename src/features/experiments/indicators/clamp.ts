/**
 * Clamp to 0..1 so every indicator is total over any input.
 *
 * Not defensive padding: a negative first tick once indexed `frames[-1]` and
 * took the whole page down with `undefined.padEnd()`. The clock clamps at
 * source now, and indicators clamp again because they are the layer that
 * actually crashes.
 */
export function clamp01(progress: number): number {
  return Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0
}
