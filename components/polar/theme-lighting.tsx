'use client'

import { useEffect, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color } from 'three'
import { night } from './theme-uniform'

// Keep the GPU hook out of the HTML theme toggle's initial JavaScript bundle.
export function ThemeLighting({ reduced }: { reduced: boolean }) {
  const [target, setTarget] = useState(0)
  const colors = useMemo(() => [new Color('#a0a5b1'),new Color('#07101c')],[])
  useEffect(() => {
    const sync = () => setTarget(document.documentElement.dataset.theme === 'dark' ? 1 : 0)
    night.value = document.documentElement.dataset.theme === 'dark' ? 1 : 0
    sync()
    window.addEventListener('portfolio:theme', sync)
    return () => window.removeEventListener('portfolio:theme', sync)
  }, [])
  useFrame(({ scene }, delta) => {
    night.value = reduced ? target : night.value + (target - night.value) * (1 - Math.exp(-Math.min(delta, .1) * 5))
    if (Math.abs(night.value - target) < .0001) night.value = target
    if (scene.background instanceof Color) scene.background.copy(colors[0]).lerp(colors[1],night.value)
  }, -2)
  return null
}
