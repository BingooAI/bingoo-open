// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { cn } from './lib/cn'

/**
 * Lightweight, token-driven SVG charts for dashboards. Single-hue by default
 * (no legend needed — the title names the series); marks are thin, the grid is
 * recessive, the endpoint is emphasized, and text wears ink tokens, not the
 * series color. Cross-platform note: the geometry maps 1:1 onto react-native-svg
 * for the native port.
 */
export type ChartColor = 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'

const CVAR: Record<ChartColor, string> = {
  primary: 'var(--color-primary)',
  teal: 'var(--color-accent-teal)',
  sunbeam: 'var(--color-accent-sunbeam)',
  coral: 'var(--color-accent-coral)',
  success: 'var(--color-success)',
}

/* ------------------------------- Sparkline ------------------------------- */
export interface SparklineProps {
  data: number[]
  color?: ChartColor
  width?: number
  height?: number
  area?: boolean
  className?: string
  ariaLabel?: string
}

export function Sparkline({
  data,
  color = 'primary',
  width = 100,
  height = 28,
  area = true,
  className,
  ariaLabel = 'Trend',
}: SparklineProps) {
  if (data.length < 2) return null
  const stroke = CVAR[color]
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i): [number, number] => [
    (i / (data.length - 1)) * width,
    height - 2 - ((v - min) / range) * (height - 4),
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]!
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      {area ? <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={stroke} opacity={0.12} /> : null}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={stroke} />
    </svg>
  )
}

/* ------------------------------- AreaChart ------------------------------- */
export interface XYPoint {
  label: string
  value: number
}

export interface AreaChartProps {
  data: XYPoint[]
  color?: ChartColor
  className?: string
  ariaLabel?: string
}

export function AreaChart({ data, color = 'primary', className, ariaLabel = 'Area chart' }: AreaChartProps) {
  const W = 320
  const H = 150
  const padB = 22
  const padT = 8
  const stroke = CVAR[color]
  if (data.length < 2) return null
  const max = Math.max(...data.map((d) => d.value)) || 1
  const plotH = H - padB - padT
  const pts = data.map((d, i): [number, number] => [
    (i / (data.length - 1)) * W,
    padT + plotH - (d.value / max) * plotH,
  ])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]!
  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={cn('w-full', className)}>
      {[0.5, 1].map((f) => (
        <line
          key={f}
          x1={0}
          x2={W}
          y1={padT + plotH * f}
          y2={padT + plotH * f}
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}
      <path d={`${line} L ${W} ${padT + plotH} L 0 ${padT + plotH} Z`} fill={stroke} opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={3.5} fill={stroke} stroke="var(--color-surface)" strokeWidth={2} />
      {data.map((d, i) => (
        <text
          key={d.label}
          x={(i / (data.length - 1)) * W}
          y={H - 6}
          textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
          className="fill-[var(--color-foreground-subtle)] text-[10px]"
        >
          {d.label}
        </text>
      ))}
    </svg>
  )
}

/* -------------------------------- BarChart ------------------------------- */
export interface BarChartProps {
  data: XYPoint[]
  color?: ChartColor
  className?: string
  ariaLabel?: string
}

export function BarChart({ data, color = 'primary', className, ariaLabel = 'Bar chart' }: BarChartProps) {
  const W = 320
  const H = 160
  const padB = 22
  const fill = CVAR[color]
  const max = Math.max(...data.map((d) => d.value)) || 1
  const plotH = H - padB - 8
  const gap = 10
  const bw = (W - gap * (data.length - 1)) / data.length
  return (
    <svg role="img" aria-label={ariaLabel} viewBox={`0 0 ${W} ${H}`} className={cn('w-full', className)}>
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * plotH)
        const x = i * (bw + gap)
        const y = 8 + plotH - h
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={h} rx={5} fill={fill} />
            <text
              x={x + bw / 2}
              y={H - 6}
              textAnchor="middle"
              className="fill-[var(--color-foreground-subtle)] text-[10px]"
            >
              {d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/* ------------------------------- DonutChart ------------------------------ */
export interface DonutSegment {
  label: string
  value: number
  color: ChartColor
}

export interface DonutChartProps {
  data: DonutSegment[]
  size?: number
  thickness?: number
  centerLabel?: ReactNode
  className?: string
  ariaLabel?: string
}

export function DonutChart({
  data,
  size = 140,
  thickness = 18,
  centerLabel,
  className,
  ariaLabel = 'Donut chart',
}: DonutChartProps) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  let acc = 0
  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg role="img" aria-label={ariaLabel} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-muted)"
          strokeWidth={thickness}
        />
        {data.map((d) => {
          const len = (d.value / total) * c
          const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`
          const off = -acc
          acc += len
          return (
            <circle
              key={d.label}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={CVAR[d.color]}
              strokeWidth={thickness}
              strokeDasharray={dash}
              strokeDashoffset={off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )
        })}
      </svg>
      {centerLabel ? (
        <div className="absolute grid place-items-center text-center font-display font-bold text-foreground">
          {centerLabel}
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------- RadarChart ------------------------------ */
export interface RadarChartProps {
  data: XYPoint[]
  max?: number
  color?: ChartColor
  size?: number
  className?: string
  ariaLabel?: string
}

export function RadarChart({
  data,
  max = 100,
  color = 'primary',
  size = 200,
  className,
  ariaLabel = 'Radar chart',
}: RadarChartProps) {
  const stroke = CVAR[color]
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 26
  const n = data.length
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180)
  const at = (i: number, radius: number): [number, number] => [
    cx + Math.cos(angle(i)) * radius,
    cy + Math.sin(angle(i)) * radius,
  ]
  const poly = data
    .map((d, i) => {
      const [x, y] = at(i, (Math.min(d.value, max) / max) * r)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
    >
      {[0.33, 0.66, 1].map((f) => (
        <polygon
          key={f}
          points={data
            .map((_, i) =>
              at(i, r * f)
                .map((v) => v.toFixed(1))
                .join(','),
            )
            .join(' ')}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = at(i, r)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--color-border)" strokeWidth={1} />
      })}
      <polygon
        points={poly}
        fill={stroke}
        fillOpacity={0.18}
        stroke={stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const [x, y] = at(i, r + 12)
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-[var(--color-foreground-muted)] text-[9px]"
          >
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
