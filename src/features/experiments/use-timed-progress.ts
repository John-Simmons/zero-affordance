import { useEffect, useRef, useState } from 'react'

/**
 * Drives `progress` from 0 to 1 over `durationMs` while `running` is true, then
 * calls `onDone` exactly once.
 *
 * This is the single clock for the whole experiment. Indicators are pure
 * functions of the value it produces rather than self-timing animations —
 * anything running on its own clock would drift from the duration the matchup
 * assigned it, and the Elo handicap corrects for that exact duration.
 *
 * Uses rAF rather than setInterval so the value tracks wall-clock time instead
 * of accumulating drift: the whole experiment measures perceived duration, so an
 * indicator that quietly ran long would corrupt the data it feeds.
 */
export function useTimedProgress(
  durationMs: number,
  running: boolean,
  onDone: () => void,
): number {
  const [progress, setProgress] = useState(0)
  // Kept in a ref so a caller passing an inline arrow doesn't restart the run.
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  useEffect(() => {
    if (!running) return
    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      // Clamped at BOTH ends. rAF passes the timestamp of the frame's start,
      // which can predate the `performance.now()` above when this effect runs
      // after that frame began — so the first tick can otherwise be negative.
      const p = Math.min(Math.max((now - start) / durationMs, 0), 1)
      setProgress(p)
      if (p < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        onDoneRef.current()
      }
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [running, durationMs])

  return progress
}

/**
 * Drives `progress` 0 → 1 over and over while `running` is true.
 *
 * **Not for the experiment.** `useTimedProgress` above is deliberately the
 * single clock for a matchup: an indicator that ran to its own beat would drift
 * from the duration the matchup assigned it, and the Elo handicap corrects for
 * that exact duration. This one exists only for previews outside a run, where
 * nothing is being measured, so there is no data for a second clock to corrupt.
 *
 * Wraps with a modulo instead of restarting, which is what keeps the loop
 * clean: the value never lands on 1, so no frame shows a completed animation
 * before the next pass begins. Re-running `useTimedProgress` by toggling
 * `running` does exactly that — its `progress` state is not reset, so the old
 * end state stays on screen until the first new frame lands.
 */
export function useLoopingProgress(
  durationMs: number,
  running: boolean,
): number {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!running) return
    // The modulo makes the cycle boundary seamless, but it cannot help a fresh
    // start: without this, re-running (reopening a preview that stayed mounted)
    // renders wherever the last pass stopped until the first frame lands.
    setProgress(0)
    let frame = 0
    const start = performance.now()

    const tick = (now: number) => {
      // Floored for the same reason the one-shot version clamps: rAF passes the
      // frame's start time, which can predate `start` and would otherwise make
      // the modulo negative.
      const elapsed = Math.max(now - start, 0)
      setProgress((elapsed % durationMs) / durationMs)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [running, durationMs])

  return progress
}
