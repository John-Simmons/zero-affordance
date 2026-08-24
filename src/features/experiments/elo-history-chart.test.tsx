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
 * renders an empty box. Reporting a fixed size is what lets the axes and the
 * reference line exist to be asserted on at all.
 *
 * It does not get as far as the line paths themselves — those need SVG geometry
 * happy-dom has no answer for — so nothing here asserts on the drawn marks. The
 * palette is the useful proxy instead: the lines are stroked with
 * `var(--color-<id>)`, and both the emitted stylesheet and the legend's
 * swatches are checked against those same ids below.
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
    // apart. It renders from the seeded variants, so what this pins is that
    // every line gets a name — and a readable one, not a raw id like
    // "classic_spinner".
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

    // The legend sits outside the chart and paints from the palette directly
    // rather than from the `--color-<id>` variables, which exist only while the
    // chart is mounted. Nothing structural ties the two together, so what has to
    // be pinned is that they still agree line for line: the swatch beside a name
    // is the colour that name's line is stroked with.
    const swatches = [...container.querySelectorAll('li [style*="--swatch"]')]
    expect(swatches).toHaveLength(experiment.variants.length)
    experiment.variants.forEach((v, i) => {
      const stroke = style.match(
        new RegExp(`--color-${v.id}:\\s*(#[0-9a-f]{6})`),
      )![1]
      expect(swatches[i].getAttribute('style')).toContain(
        `--swatch-light: ${stroke}`,
      )
    })
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
