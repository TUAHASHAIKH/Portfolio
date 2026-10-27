// Keep wheel gestures close to the visible scene. A large mouse/trackpad burst
// must not queue several seconds of travel after the user's hand has stopped.
export function wheelPixels(delta: number, mode: number, viewport: number) {
  return delta * (mode === 1 ? 16 : mode === 2 ? viewport : 1)
}

export function boundedScrollTarget(target: number, visible: number, pixels: number, lead: number) {
  const pending = target - visible
  const origin = pending * pixels < 0 ? visible : target
  return Math.max(visible - lead, Math.min(visible + lead, origin + pixels))
}

export function ownsNavigationKey(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(
    'button, a, input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="listbox"], [role="menu"]',
  ))
}
