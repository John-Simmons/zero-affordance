/**
 * Anonymous, stable visitor identity.
 *
 * We deliberately avoid requiring accounts: experiments and surveys just need a
 * durable per-browser id so we can assign experiment variants deterministically
 * and avoid double-counting. Swap this for real auth later without touching the
 * data layer's public surface.
 */

const STORAGE_KEY = 'za.visitorId'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `v_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function getVisitorId(): string {
  if (typeof localStorage === 'undefined') {
    // SSR / test fallback — ephemeral id.
    return createId()
  }
  let id = localStorage.getItem(STORAGE_KEY)
  if (!id) {
    id = createId()
    localStorage.setItem(STORAGE_KEY, id)
  }
  return id
}

/**
 * Deterministic 32-bit hash (FNV-1a). Used to assign a stable experiment
 * variant from a visitor id without persisting the assignment anywhere.
 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
