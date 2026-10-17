'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'

type Piece = { center: THREE.Vector3; point: THREE.Vector3; motion: { slow: number } }
type Node = { id: number; progress: number; leaving: boolean; x: number; y: number }

export function Measurements({ pieces, cursor, reduced }: { pieces: Piece[]; cursor: THREE.Vector3; reduced: boolean }) {
  const { camera, size } = useThree()
  const svg = useRef<SVGSVGElement>(null)
  const groups = useRef<(SVGGElement | null)[]>([])
  const labels = useRef<(SVGTextElement | null)[]>([])
  const lines = useRef<(SVGPathElement | null)[]>([])
  const nodes = useRef<Node[]>([])
  const edges = useRef<[number, number][]>([])
  const signature = useRef('')
  const scratch = useMemo(() => ({ point: new THREE.Vector3(), towardCamera: new THREE.Vector3(), selection: new THREE.Vector3() }), [])

  useFrame((_, frameDelta) => {
    if (!svg.current) return
    const delta = Math.min(frameDelta, .25)
    scratch.towardCamera.copy(camera.position).sub(cursor).normalize()
    scratch.selection.copy(cursor).add(scratch.towardCamera)
    const candidates = reduced ? [] : pieces
      .map((piece, id) => ({ id, distance: piece.point.distanceToSquared(scratch.selection), open: piece.motion.slow }))
      .filter(piece => piece.open > .1 && piece.distance < 4)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(piece => piece.id)

    const selected = nodes.current
    // Match the short stagger: one point enters in 100 ms or leaves in 60 ms.
    if (!selected.some(node => node.leaving || node.progress < 1)) {
      const outgoing = selected.find(node => !candidates.includes(node.id))
      if (outgoing) outgoing.leaving = true
      else if (selected.length < 5) {
        const incoming = candidates.find(id => !selected.some(node => node.id === id))
        if (incoming !== undefined) selected.push({ id: incoming, progress: 0, leaving: false, x: 0, y: 0 })
      }
    }
    for (let index = selected.length - 1; index >= 0; index--) {
      const node = selected[index]
      node.progress = THREE.MathUtils.clamp(node.progress + delta / (node.leaving ? -.06 : .1), 0, 1)
      if (node.leaving && node.progress === 0) selected.splice(index, 1)
    }

    const key = selected.map(node => node.id).join(',')
    if (key !== signature.current) {
      signature.current = key
      const links: [number, number][] = [], degree = new Map<number, number>()
      // Stable degree-two proximity graph; an isolated node always gets a neighbor.
      selected.forEach(node => {
        const neighbors = selected.filter(other => other.id !== node.id)
          .sort((a, b) => pieces[a.id].point.distanceToSquared(pieces[node.id].point) - pieces[b.id].point.distanceToSquared(pieces[node.id].point))
        for (const other of neighbors) {
          const exists = links.some(([a, b]) => (a === node.id && b === other.id) || (b === node.id && a === other.id))
          if (exists || (degree.get(node.id) || 0) >= 2 || (degree.get(other.id) || 0) >= 2) continue
          links.push([node.id, other.id]); degree.set(node.id, (degree.get(node.id) || 0) + 1); degree.set(other.id, (degree.get(other.id) || 0) + 1)
        }
        if (!degree.get(node.id) && neighbors.length) {
          const neighbor = neighbors[0].id
          links.push([node.id, neighbor]); degree.set(node.id, 1); degree.set(neighbor, (degree.get(neighbor) || 0) + 1)
        }
      })
      edges.current = links
    }

    for (let index = 0; index < 5; index++) {
      const node = selected[index], group = groups.current[index]
      if (!group) continue
      if (!node) { group.setAttribute('opacity', '0'); continue }
      const piece = pieces[node.id]
      scratch.point.copy(piece.center).normalize().multiplyScalar(.2).add(piece.point).project(camera)
      node.x = (scratch.point.x * .5 + .5) * size.width
      node.y = (-scratch.point.y * .5 + .5) * size.height
      group.setAttribute('transform', `translate(${node.x} ${node.y}) scale(${node.progress})`)
      group.setAttribute('opacity', String(node.progress))
      group.dataset.piece = String(node.id)
      const number = String(Math.floor(piece.center.distanceTo(piece.point) * 50) % 100).padStart(2, '0')
      const label = labels.current[index]
      if (label) {
        label.textContent = number
        const rightSide = node.x > size.width * .5
        label.setAttribute('x', rightSide ? '10' : '-10')
        label.setAttribute('text-anchor', rightSide ? 'start' : 'end')
      }
    }
    for (let index = 0; index < 10; index++) {
      const path = lines.current[index], edge = edges.current[index]
      if (!path) continue
      const a = edge && selected.find(node => node.id === edge[0]), b = edge && selected.find(node => node.id === edge[1])
      if (!a || !b) { path.setAttribute('opacity', '0'); continue }
      const progress = Math.min(a.progress, b.progress)
      path.setAttribute('d', `M${a.x},${a.y} L${THREE.MathUtils.lerp(a.x, b.x, progress)},${THREE.MathUtils.lerp(a.y, b.y, progress)}`)
      path.setAttribute('opacity', String(.25 * progress))
    }
  }, .5)

  useEffect(() => {
    const host = document.getElementById('ice-measurements')
    if (!host) return
    // DOM overlays need their own DOM renderer, independently of the Three reconciler.
    const root = createRoot(host)
    root.render(<svg ref={svg} className="measurement-plexus" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
    <g fill="none" stroke="white" strokeWidth=".75">{Array.from({ length: 10 }, (_, index) => <path key={index} ref={path => { lines.current[index] = path }} opacity={0} />)}</g>
    {Array.from({ length: 5 }, (_, index) => <g key={index} className="measurement-node" ref={group => { groups.current[index] = group }} opacity={0}>
      <path d="M-3.5 0H3.5M0-3.5V3.5" fill="none" stroke="white" strokeWidth=".9" />
      <text className="measurement-number" ref={text => { labels.current[index] = text }} x={-10} y={-8} textAnchor="end" fill="white">00</text>
    </g>)}
    </svg>)
    return () => root.unmount()
  // The five DOM slots are stable; only their attributes change during animation.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { svg.current?.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`) }, [size])
  return null
}
