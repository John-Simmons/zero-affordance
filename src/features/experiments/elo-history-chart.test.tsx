import { render, screen } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'

import { EloHistoryChart } from '@/features/experiments/elo-history-chart'
import { START_RATING } from '@/lib/data/aggregate'
import { seedExperiments } from '@/lib/data/seed'
import type { EloHistory } from '@/lib/data/types'

const experiment = seedExperiments.find(
  (e) => e.id === 'exp_loading_perception',
)!

const history: EloHistory = {
  experimentId: experiment.id,
  totalMatches: 2,
  points: [0, 1, 2].map((matchCount) => ({
    matchCount,
    ratings: Object.fromEntries(
      experiment.variants.map((v, i) => [v.id, START_RATING + i * matchCount]),
    ),
  })),
}

/**
 * happy-dom lays nothing out, so recharts' ResponsiveContainer measures 0x0 and
 * renders an empty box. Reporting a fixed size is what lets the axes, the
 * reference line and the legend exist to be asserted on at all.
 *
 * It does not get as far as the line paths themselves — those need SVG geometry
 * happy-dom has no answer for — so nothing here asserts on the drawn marks. The
 * legend is the useful proxy: it is built from the `Line` elements' own keys and
 * resolved through the chart config, so it goes blank or falls back to raw ids
 * the moment those two disagree.
 */
beforeAll(() => {
  const size = { width: 640, height: 288 }
  globalThis.ResizeObserver = class {
    // A plain field, not a parameter property: `erasableSyntaxOnly` is on.
    cb: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb
    }
    observe(target: Element) {
      this.cb(
        [{ target, contentRect: size } as unknown as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      )
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      ...size,
      top: 0,
      left: 0,
      right: 640,
      bottom: 288,
      x: 0,
      y: 0,
    }),
  })
})

describe('EloHistoryChart', () => {
  it('names every line by its loading state, not its id', () => {
    render(
      <EloHistoryChart
        experiment={experiment}
        history={history}
        isLoading={false}
      />,
    )
    // The legend is what stops colour being the only thing telling six lines
    // apart, so a config keyed off something the lines do not use would show
    // nothing here — or raw ids like "classic_spinner".
    for (const v of experiment.variants) {
      expect(screen.getByText(v.label)).toBeInTheDocument()
    }
  })

  it('gives each loading state its own colour, in declared order', () => {
    const { container } = render(
      <EloHistoryChart
        experiment={experiment}
        history={history}
        isLoading={false}
      />,
    )
    const style = container.querySelector('style')!.innerHTML
    // Colour follows the variant's position, so a reordered leaderboard cannot
    // repaint the lines.
    for (const v of experiment.variants) {
      expect(style).toContain(`--color-${v.id}:`)
    }
    const hexes = style.match(/#[0-9a-f]{6}/g) ?? []
    expect(new Set(hexes).size).toBeGreaterThanOrEqual(
      experiment.variants.length,
    )
  })

  it('says so rather than drawing an empty axis with no matches', () => {
    render(
      <EloHistoryChart
        experiment={experiment}
        history={{ ...history, totalMatches: 0, points: [] }}
        isLoading={false}
      />,
    )
    expect(screen.getByText(/No matchups recorded yet/)).toBeInTheDocument()
  })
})
