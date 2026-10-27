// A finite burst with quiet endpoints; it never flickers while the visitor is
// reading. Opening and closing share this envelope and can interrupt each other.
export function glitchEnvelope(elapsed: number, duration: number) {
  if (elapsed <= 0 || elapsed >= duration || duration <= 0) return 0
  return Math.sin(Math.PI * elapsed / duration) ** 2 * .65
}
