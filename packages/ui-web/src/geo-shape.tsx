// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { makeSolid, projectSolid, type Solid3DName, type SolidPartKind } from '@bingoo.ai/core'
import { useMemo, useRef, useState, type PointerEvent } from 'react'
import { cn } from './lib/cn'

export type Shape2DName = 'triangle' | 'square' | 'rectangle' | 'pentagon' | 'hexagon' | 'octagon' | 'circle'
export type Shape3DName = Solid3DName

export interface GeoShapePart {
  id: string
  kind: SolidPartKind
}

export interface GeoShapeProps {
  kind: '2d' | '3d'
  name: Shape2DName | Shape3DName
  color?: string
  label?: string
  size?: number
  /** 3D: drag to turn the solid (default true). */
  rotatable?: boolean
  /**
   * 3D: which parts the learner can tap. 'all' = identify mode (tap anything and
   * it reports whether it's a face / curved surface / edge / vertex).
   */
  pick?: SolidPartKind | 'all' | null
  /** Controlled: ids of the picked parts (highlighted). */
  selected?: string[]
  onPick?: (part: GeoShapePart) => void
  /** Draw hidden edges/vertices dashed, like the textbooks (default true). */
  showHidden?: boolean
  pitch?: number
  yaw?: number
  className?: string
}

function poly(sides: number, r = 42, rotate = -90) {
  return Array.from({ length: sides }, (_, i) => {
    const a = ((i / sides) * 360 + rotate) * (Math.PI / 180)
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}
function shadeHex(hex: string, s: number): string {
  const h = hex.replace('#', '')
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  const n = parseInt(full, 16)
  return `rgb(${Math.round(((n >> 16) & 255) * s)},${Math.round(((n >> 8) & 255) * s)},${Math.round((n & 255) * s)})`
}

const SEL = '#f74c6c' // selection accent (coral)

/**
 * 2D + 3D shape figures. The 3D solids are REAL geometry (`@bingoo.ai/core`'s 3D
 * engine): drag to TURN them, and TAP a part — a flat face, the curved surface,
 * an edge, or a vertex — to identify or count it. Hidden edges/vertices are drawn
 * dashed, and hidden parts can only be tapped after turning the solid, which is
 * exactly what "how many faces are hidden?" is teaching. i18n-free.
 */
export function GeoShape({
  kind,
  name,
  color = '#2e62ec',
  label,
  size = 96,
  rotatable = true,
  pick = null,
  selected = [],
  onPick,
  showHidden = true,
  pitch: pitch0 = -22,
  yaw: yaw0 = 32,
  className,
}: GeoShapeProps) {
  const [pitch, setPitch] = useState(pitch0)
  const [yaw, setYaw] = useState(yaw0)
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const stroke = '#101828'

  const solid = useMemo(() => (kind === '3d' ? makeSolid(name as Solid3DName) : null), [kind, name])
  const proj = useMemo(() => (solid ? projectSolid(solid, pitch, yaw, 30) : null), [solid, pitch, yaw])
  const sel = new Set(selected)

  const canDrag = kind === '3d' && rotatable
  const canPick = (k: SolidPartKind) => pick === 'all' || pick === k
  const tap = (id: string, k: SolidPartKind) => {
    if (drag.current?.moved) return // a rotate gesture, not a tap
    if (!canPick(k)) return
    onPick?.({ id, kind: k })
  }

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (!canDrag) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true
    drag.current.x = e.clientX
    drag.current.y = e.clientY
    setYaw((v) => v + dx * 0.6)
    setPitch((v) => Math.max(-85, Math.min(85, v + dy * 0.6)))
  }
  const up = () => {
    // keep `moved` for the click that follows, then clear on the next frame
    const d = drag.current
    requestAnimationFrame(() => {
      if (drag.current === d) drag.current = null
    })
  }

  const body2d = () => {
    switch (name as Shape2DName) {
      case 'circle':
        return <circle cx={50} cy={50} r={42} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'square':
        return <rect x={12} y={12} width={76} height={76} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'rectangle':
        return <rect x={6} y={24} width={88} height={52} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'triangle':
        return <polygon points={poly(3)} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'pentagon':
        return <polygon points={poly(5)} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'hexagon':
        return <polygon points={poly(6)} fill={color} stroke={stroke} strokeWidth={1.6} />
      case 'octagon':
        return <polygon points={poly(8)} fill={color} stroke={stroke} strokeWidth={1.6} />
      default:
        return null
    }
  }

  return (
    <figure className={cn('flex flex-col items-center gap-1', className)}>
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        role="img"
        aria-label={label ?? name}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn(canDrag && 'touch-none cursor-grab active:cursor-grabbing')}
      >
        {kind === '2d' || !proj ? (
          body2d()
        ) : (
          <>
            {/* Faces (a curved surface is many strips sharing one id) */}
            {proj.faces.map((f, i) => {
              const on = sel.has(f.surfaceId)
              return (
                <polygon
                  key={`f${i}`}
                  points={f.points}
                  fill={on ? SEL : shadeHex(color, f.shade)}
                  fillOpacity={on ? 0.85 : 1}
                  stroke={f.kind === 'curved' ? shadeHex(color, f.shade) : stroke}
                  strokeWidth={f.kind === 'curved' ? 0.5 : 1}
                  strokeLinejoin="round"
                  onClick={() => tap(f.surfaceId, f.kind)}
                  className={cn(
                    canPick(f.kind) && 'cursor-pointer',
                    'motion-safe:transition-[r,fill,opacity] duration-2',
                  )}
                  pointerEvents={canPick(f.kind) ? 'auto' : 'none'}
                />
              )
            })}

            {/* Edges — hidden ones dashed (per segment: a rim is half hidden) */}
            {proj.edges.map((e) => {
              const on = sel.has(e.id)
              return (
                <g
                  key={e.id}
                  onClick={() => tap(e.id, 'edge')}
                  className={cn(
                    canPick('edge') && 'cursor-pointer',
                    'motion-safe:transition-[r,fill,opacity] duration-2',
                  )}
                >
                  {e.segs.map((sg, k) =>
                    !sg.visible && !showHidden ? null : (
                      <line
                        key={k}
                        x1={sg.x1}
                        y1={sg.y1}
                        x2={sg.x2}
                        y2={sg.y2}
                        stroke={on ? SEL : stroke}
                        strokeWidth={on ? 2.6 : 1.2}
                        strokeDasharray={sg.visible ? undefined : '2.5 2'}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    ),
                  )}
                  {/* fat invisible hit area */}
                  {canPick('edge')
                    ? e.segs.map((sg, k) => (
                        <line
                          key={`h${k}`}
                          x1={sg.x1}
                          y1={sg.y1}
                          x2={sg.x2}
                          y2={sg.y2}
                          stroke="transparent"
                          strokeWidth={5}
                        />
                      ))
                    : null}
                </g>
              )
            })}

            {/* Vertices */}
            {proj.corners.map((c) =>
              !c.visible && !showHidden ? null : (
                <circle
                  key={c.id}
                  cx={c.x}
                  cy={c.y}
                  r={sel.has(c.id) ? 3.6 : 2.2}
                  fill={sel.has(c.id) ? SEL : c.visible ? stroke : 'white'}
                  stroke={stroke}
                  strokeWidth={1}
                  strokeDasharray={c.visible ? undefined : '1.5 1'}
                  onClick={() => tap(c.id, 'vertex')}
                  className={cn(
                    canPick('vertex') && 'cursor-pointer',
                    'motion-safe:transition-[r,fill,opacity] duration-2',
                  )}
                  pointerEvents={canPick('vertex') ? 'auto' : 'none'}
                />
              ),
            )}
          </>
        )}
      </svg>
      {label ? <figcaption className="text-sm font-semibold text-foreground">{label}</figcaption> : null}
    </figure>
  )
}
