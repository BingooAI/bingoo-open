// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Stick.tsx — the universal humanoid rig (spec §8). One anonymous stick figure
 * reused across every topic: skeleton + per-beat joint angles + a minimal face
 * (neutral/happy/think/surprise). Angles are absolute degrees from the downward
 * vertical; the choreographer tweens `joints` between poses (spec §4 Pose).
 */
import * as React from 'react'
import type { RenderItem } from '@bingoo.ai/explainer'
import type { ThemeTokens, FaceExpr } from '@bingoo.ai/explainer'
import { resolveStyle } from '../theme/tokens'
import { itemTransform } from './util'

const DEFAULT_JOINTS: Record<string, number> = {
  neck: 0,
  shoulderL: -28,
  elbowL: -20,
  shoulderR: 28,
  elbowR: 20,
  hipL: -12,
  kneeL: -8,
  hipR: 12,
  kneeR: 8,
}

function pt(x: number, y: number, len: number, deg: number) {
  const r = (deg * Math.PI) / 180
  return { x: x + len * Math.sin(r), y: y + len * Math.cos(r) }
}

export function Stick({ item, theme }: { item: RenderItem; theme: ThemeTokens }) {
  const { transform, opacity } = itemTransform(item)
  const s = resolveStyle(theme, item.style)
  const j = { ...DEFAULT_JOINTS, ...(item.pose.joints ?? {}) }
  const face = (item.pose.face ?? 'neutral') as FaceExpr

  const w = item.rect.w
  const h = item.rect.h
  const size = Math.min(h * 0.94, w * 1.7)
  const headR = size * 0.1
  const neckLen = size * 0.05
  const torso = size * 0.32
  const upper = size * 0.17
  const fore = size * 0.16
  const thigh = size * 0.19
  const shin = size * 0.18

  const cx = w / 2
  const topY = h / 2 - size / 2
  const headC = { x: cx, y: topY + headR }
  const neckBottom = pt(headC.x, headC.y + headR, neckLen, j.neck!)
  const shoulder = neckBottom
  const hip = { x: shoulder.x, y: shoulder.y + torso }

  const elbowL = pt(shoulder.x, shoulder.y, upper, j.shoulderL!)
  const handL = pt(elbowL.x, elbowL.y, fore, j.elbowL!)
  const elbowR = pt(shoulder.x, shoulder.y, upper, j.shoulderR!)
  const handR = pt(elbowR.x, elbowR.y, fore, j.elbowR!)
  const kneeL = pt(hip.x, hip.y, thigh, j.hipL!)
  const footL = pt(kneeL.x, kneeL.y, shin, j.kneeL!)
  const kneeR = pt(hip.x, hip.y, thigh, j.hipR!)
  const footR = pt(kneeR.x, kneeR.y, shin, j.kneeR!)

  const bone = {
    stroke: s.stroke,
    strokeWidth: s.strokeWidth * 1.1,
    strokeLinecap: 'round' as const,
    fill: 'none',
  }

  return (
    <g transform={transform} opacity={opacity}>
      {/* limbs */}
      <polyline
        points={`${shoulder.x},${shoulder.y} ${elbowL.x},${elbowL.y} ${handL.x},${handL.y}`}
        {...bone}
      />
      <polyline
        points={`${shoulder.x},${shoulder.y} ${elbowR.x},${elbowR.y} ${handR.x},${handR.y}`}
        {...bone}
      />
      <polyline points={`${hip.x},${hip.y} ${kneeL.x},${kneeL.y} ${footL.x},${footL.y}`} {...bone} />
      <polyline points={`${hip.x},${hip.y} ${kneeR.x},${kneeR.y} ${footR.x},${footR.y}`} {...bone} />
      {/* spine */}
      <line x1={shoulder.x} y1={shoulder.y} x2={hip.x} y2={hip.y} {...bone} />
      {/* head */}
      <circle
        cx={headC.x}
        cy={headC.y}
        r={headR}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        fill={theme.colors.paper ?? '#fff'}
      />
      <Face cx={headC.x} cy={headC.y} r={headR} face={face} color={s.stroke} />
    </g>
  )
}

function Face({
  cx,
  cy,
  r,
  face,
  color,
}: {
  cx: number
  cy: number
  r: number
  face: FaceExpr
  color: string
}) {
  const eyeY = cy - r * 0.15
  const eyeDx = r * 0.4
  const sw = Math.max(2, r * 0.12)
  const dot = (x: number, ry = r * 0.11) => <circle cx={x} cy={eyeY} r={ry} fill={color} />
  let mouth: React.ReactNode
  switch (face) {
    case 'happy':
      mouth = (
        <path
          d={`M ${cx - r * 0.35} ${cy + r * 0.25} Q ${cx} ${cy + r * 0.6} ${cx + r * 0.35} ${cy + r * 0.25}`}
          stroke={color}
          strokeWidth={sw}
          fill="none"
          strokeLinecap="round"
        />
      )
      break
    case 'surprise':
      mouth = <circle cx={cx} cy={cy + r * 0.35} r={r * 0.16} stroke={color} strokeWidth={sw} fill="none" />
      break
    case 'think':
      mouth = (
        <line
          x1={cx - r * 0.2}
          y1={cy + r * 0.35}
          x2={cx + r * 0.3}
          y2={cy + r * 0.3}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )
      break
    case 'neutral':
    default:
      mouth = (
        <line
          x1={cx - r * 0.3}
          y1={cy + r * 0.35}
          x2={cx + r * 0.3}
          y2={cy + r * 0.35}
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      )
  }
  return (
    <g>
      {dot(cx - eyeDx)}
      {dot(cx + eyeDx)}
      {face === 'think' ? (
        <path
          d={`M ${cx + eyeDx - r * 0.2} ${eyeY - r * 0.35} q ${r * 0.2} -${r * 0.12} ${r * 0.4} 0`}
          stroke={color}
          strokeWidth={sw * 0.8}
          fill="none"
          strokeLinecap="round"
        />
      ) : null}
      {mouth}
    </g>
  )
}
