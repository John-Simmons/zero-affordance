/**
 * Nothing at all — the control condition.
 *
 * The canvas keeps its size (the runner fixes that), so this is a genuinely
 * empty frame for the duration of the wait rather than a collapsed one. Any
 * perceived-speed difference the other five show has to be measured against
 * showing the user nothing, which is what this provides.
 */
export function BlankIndicator() {
  return null
}
