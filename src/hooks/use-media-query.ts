import { useCallback, useSyncExternalStore } from 'react'

/**
 * Whether the viewport currently matches a media query.
 *
 * `useSyncExternalStore` rather than the usual `useState` + `useEffect` pair
 * because the snapshot is read during the first render. A component that picks
 * between two controls on this value therefore never paints the wrong one and
 * swaps it a frame later — with an effect-based hook the initial value is
 * always the default, so a phone would briefly render the desktop control
 * before correcting itself.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    // Nothing server-renders this SPA, but the argument is what makes the hook
    // safe if anything ever pre-renders it: assume the narrow layout, which
    // degrades to a drawer rather than to a popover anchored at nothing.
    () => false,
  )
}
