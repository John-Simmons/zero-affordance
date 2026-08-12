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
