import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { createSupabaseProvider } from '@/lib/data/supabase'

/**
 * A stand-in for the realtime half of a Supabase client that reproduces the two
 * behaviours this code has to survive, both verified against
 * `@supabase/realtime-js` 2.112.2:
 *
 *  1. `channel(name)` returns the EXISTING channel when the client already
 *     holds that name (`RealtimeClient.channel`), rather than a fresh one.
 *  2. `on('postgres_changes', …)` THROWS once the channel has joined
 *     (`RealtimeChannel.on`).
 *
 * Both are load-bearing. A fake that handed out a new channel every time, or
 * let `on` be called twice, would pass whether or not the bug was fixed.
 */
function createFakeClient() {
  const live = new Map<string, FakeChannel>()
  const created: FakeChannel[] = []

  class FakeChannel {
    // Plain fields, not parameter properties: `erasableSyntaxOnly` is on.
    name: string
    subscribed = false
    handlers: (() => void)[] = []
    constructor(name: string) {
      this.name = name
    }

    on(_type: string, _filter: unknown, cb: () => void) {
      if (this.subscribed) {
        throw new Error(
          `cannot add \`postgres_changes\` callbacks for realtime:${this.name} after \`subscribe()\`.`,
        )
      }
      this.handlers.push(cb)
      return this
    }

    subscribe() {
      this.subscribed = true
      return this
    }

    /** Pretend a matching row arrived. */
    emit() {
      this.handlers.forEach((h) => h())
    }
  }

  const client = {
    channel(name: string) {
      const existing = live.get(name)
      if (existing) return existing
      const channel = new FakeChannel(name)
      live.set(name, channel)
      created.push(channel)
      return channel
    },
    async removeChannel(channel: FakeChannel) {
      live.delete(channel.name)
      return 'ok'
    },
  }

  return { client: client as unknown as SupabaseClient, live, created }
}

const provider = (client: SupabaseClient) => createSupabaseProvider(client)

describe('supabase realtime subscriptions', () => {
  /**
   * The staging regression. Two hooks watch the match table — the standings and
   * the history chart — so `subscribeToEloAggregate` is called twice for one
   * experiment. Before the shared channel, the second call reached `.on()` on
   * the already-joined channel the first had left behind and threw, taking the
   * whole results screen down with it.
   */
  it('lets two callers watch one experiment', () => {
    const { client, created } = createFakeClient()
    const p = provider(client)
    let standings = 0
    let history = 0

    expect(() => {
      p.subscribeToEloAggregate!('exp_1', () => (standings += 1))
      p.subscribeToEloAggregate!('exp_1', () => (history += 1))
    }).not.toThrow()

    // One channel, one `postgres_changes` registration, both callers fed.
    expect(created).toHaveLength(1)
    expect(created[0].handlers).toHaveLength(1)

    created[0].emit()
    expect([standings, history]).toEqual([1, 1])
  })

  it('keeps feeding the others when one caller leaves', () => {
    const { client, created } = createFakeClient()
    const p = provider(client)
    let standings = 0
    let history = 0

    const off = p.subscribeToEloAggregate!('exp_1', () => (standings += 1))
    p.subscribeToEloAggregate!('exp_1', () => (history += 1))

    off()
    created[0].emit()
    expect([standings, history]).toEqual([0, 1])
  })

  it('closes the channel only when the last caller leaves', async () => {
    const { client, created, live } = createFakeClient()
    const p = provider(client)

    const offA = p.subscribeToEloAggregate!('exp_1', () => {})
    const offB = p.subscribeToEloAggregate!('exp_1', () => {})

    offA()
    expect(live.size).toBe(1)

    offB()
    await Promise.resolve()
    expect(live.size).toBe(0)
    expect(created).toHaveLength(1)
  })

  /**
   * `removeChannel` only drops the topic once the server acks the leave, so a
   * resubscribe can land while the old channel is still registered and still
   * joined. Naming each channel uniquely is what stops the client handing that
   * one back — where `.on()` would throw exactly as in the bug above.
   */
  it('builds a fresh channel after a teardown rather than reusing the name', () => {
    const { client, created } = createFakeClient()
    const p = provider(client)

    p.subscribeToEloAggregate!('exp_1', () => {})()

    let seen = 0
    expect(() => {
      p.subscribeToEloAggregate!('exp_1', () => (seen += 1))
    }).not.toThrow()

    expect(created).toHaveLength(2)
    expect(created[1].name).not.toBe(created[0].name)

    created[1].emit()
    expect(seen).toBe(1)
  })

  it('keeps different experiments on their own channels', () => {
    const { client, created } = createFakeClient()
    const p = provider(client)
    let one = 0
    let two = 0

    p.subscribeToEloAggregate!('exp_1', () => (one += 1))
    p.subscribeToEloAggregate!('exp_2', () => (two += 1))

    expect(created).toHaveLength(2)
    created[0].emit()
    expect([one, two]).toEqual([1, 0])
  })

  // The same defect sat in all four subscribe methods; they now share one path.
  it('shares a channel for the other subscriptions too', () => {
    const { client, created } = createFakeClient()
    const p = provider(client)

    expect(() => {
      p.subscribeToVideoIdeas!(() => {})
      p.subscribeToVideoIdeas!(() => {})
      p.subscribeToSurveyAggregate!('s_1', () => {})
      p.subscribeToSurveyAggregate!('s_1', () => {})
      p.subscribeToExperimentAggregate!('exp_1', () => {})
      p.subscribeToExperimentAggregate!('exp_1', () => {})
    }).not.toThrow()

    expect(created).toHaveLength(3)
  })
})
