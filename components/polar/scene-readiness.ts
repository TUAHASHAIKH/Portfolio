// Keep the last painted scene on screen until its successor has uploaded its
// textures and shaders. Preserve the requested target so scrolling can resume.
export function readyJourneyTarget(target: number, hero: boolean, crystals: boolean, rings: boolean) {
  if (!hero) return 0
  if (!crystals) return Math.min(target, .02)
  if (!rings) return Math.min(target, 3.25)
  return target
}
