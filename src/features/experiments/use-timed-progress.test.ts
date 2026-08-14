import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useLoopingProgress } from '@/features/experiments/use-timed-progress'

describe('useLoopingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'performance'] })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not run while stopped', () => {
    const { result } = renderHook(() => useLoopingProgress(1000, false))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(0)
  })

  it('advances through a cycle', () => {
    const { result } = renderHook(() => useLoopingProgress(1000, true))
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBeGreaterThan(0.4)
    expect(result.current).toBeLessThan(0.6)
  })

  it('wraps past the end instead of holding at 1', () => {
    // The whole reason this exists rather than reusing `useTimedProgress`,
    // which stops at 1 and stays there.
    const { result } = renderHook(() => useLoopingProgress(1000, true))
    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current).toBeLessThan(0.5)
  })

  it('restarts from the beginning rather than where it stopped', () => {
    const { result, rerender } = renderHook(
      ({ running }) => useLoopingProgress(1000, running),
      { initialProps: { running: true } },
    )
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(result.current).toBeGreaterThan(0.5)

    rerender({ running: false })
    act(() => {
      rerender({ running: true })
    })
    // Without the reset on effect entry this would still read ~0.7, which is
    // the previous pass showing through the first frame of the new one.
    expect(result.current).toBe(0)
  })
})
