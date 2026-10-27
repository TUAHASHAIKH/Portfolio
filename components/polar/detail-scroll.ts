import { boundedScrollTarget, wheelPixels } from './scroll-input'

// The modal retains a real scroll container for touch, focus, keyboard, and its
// scrollbar. Only wheel input is eased, and only while there is work to do.
export function smoothDetailScroll(element: HTMLDialogElement) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0
  let value = element.scrollTop
  let target = value
  let written = value
  let lastTime = 0
  let limit = 0

  const stop = () => {
    cancelAnimationFrame(frame)
    frame = 0
    value = target = written = element.scrollTop
  }
  const measure = () => {
    limit = Math.max(0, element.scrollHeight - element.clientHeight)
    target = Math.max(0, Math.min(limit, target))
  }
  const tick = (now: number) => {
    if (!element.open || element.dataset.phase === 'closing' || document.hidden || preference.matches) { stop(); return }
    const elapsed = Math.min((now - lastTime) / 1000, .05)
    lastTime = now
    value += (target - value) * (1 - Math.exp(-12 * elapsed))
    const settled = Math.abs(target - value) < .5
    if (settled) value = target
    element.scrollTop = value
    written = element.scrollTop
    frame = settled ? 0 : requestAnimationFrame(tick)
  }
  const wheel = (event: WheelEvent) => {
    if (!element.open || element.dataset.phase === 'closing' || preference.matches ||
      event.defaultPrevented || !event.cancelable || event.ctrlKey || event.metaKey ||
      !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
    if (!limit) return
    event.preventDefault()
    if (!frame && Math.abs(element.scrollTop - written) > 1) {
      value = target = written = element.scrollTop
    }
    // Keep the floating-point playhead between frames. Reading rounded
    // scrollTop back into it would lose slow, subpixel trackpad movement.
    target = Math.max(0, Math.min(limit, boundedScrollTarget(target, value,
      wheelPixels(event.deltaY, event.deltaMode, element.clientHeight), element.clientHeight * .9)))
    if (!frame) { lastTime = performance.now(); frame = requestAnimationFrame(tick) }
  }
  const scroll = () => {
    // Focus navigation, scrollbar dragging, and gallery changes take ownership
    // immediately; a queued wheel frame must never pull them back.
    if (Math.abs(element.scrollTop - written) > 1) stop()
  }
  const observer = new ResizeObserver(measure)
  observer.observe(element)
  const content = element.querySelector('article')
  if (content) observer.observe(content)
  measure()
  element.addEventListener('wheel', wheel, { passive: false })
  element.addEventListener('scroll', scroll, { passive: true })
  element.addEventListener('touchstart', stop, { passive: true })
  element.addEventListener('pointerdown', stop, { passive: true })
  element.addEventListener('keydown', stop)
  element.addEventListener('close', stop)
  preference.addEventListener('change', stop)
  document.addEventListener('visibilitychange', stop)
  return () => {
    stop()
    observer.disconnect()
    element.removeEventListener('wheel', wheel)
    element.removeEventListener('scroll', scroll)
    element.removeEventListener('touchstart', stop)
    element.removeEventListener('pointerdown', stop)
    element.removeEventListener('keydown', stop)
    element.removeEventListener('close', stop)
    preference.removeEventListener('change', stop)
    document.removeEventListener('visibilitychange', stop)
  }
}
