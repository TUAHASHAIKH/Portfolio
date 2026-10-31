'use client'

import { useEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { night } from './theme-uniform'

// Keep the GPU hook out of the HTML theme toggle's initial JavaScript bundle.
export function ThemeLighting({ reduced }: { reduced: boolean }) {
  const [target, setTarget] = useState(0)
  useEffect(() => {
    const sync = () => setTarget(document.documentElement.dataset.theme === 'dark' ? 1 : 0)
    night.value = document.documentElement.dataset.theme === 'dark' ? 1 : 0
    sync()
    window.addEventListener('portfolio:theme', sync)
    return () => window.removeEventListener('portfolio:theme', sync)
  }, [])
  useFrame((_, delta) => {
    night.value = reduced ? target : night.value + (target - night.value) * (1 - Math.exp(-Math.min(delta, .1) * 5))
    if (Math.abs(night.value - target) < .0001) night.value = target
  }, -2)
  return null
}
