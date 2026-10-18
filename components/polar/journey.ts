export type Journey = { target: number; value: number }

export const clamp = (value: number) => Math.min(1, Math.max(0, value))
export const range = (value: number, start: number, end: number) => clamp((value - start) / (end - start))
export const ease = (value: number) => value * value * (3 - 2 * value)
