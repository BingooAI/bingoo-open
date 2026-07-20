/**
 * SlideEls.tsx — the "slide layer" renderers: list · table · chart · stat · quote.
 *
 * These are what a deck tool has and a whiteboard engine doesn't, and they obey
 * the same two laws as everything else here:
 *
 *   • ON THE TYPE SCALE. A bullet is `body`, a KPI is `huge`, a table cell is
 *     `label` — the SAME absolute size as those rungs anywhere else in the
 *     lesson. Fitting may only shrink, never grow. So a bulleted slide and a
 *     manipulative stage sit side by side without a visible seam.
 *   • MATH BY CODE. Bar heights, pie angles and gridlines are DERIVED from the
 *     data in frame() (`max`, `total`). Nobody — not an author, not an LLM —
 *     can hand us a chart whose bars contradict its numbers, because the bars
 *     are not authored at all.
 *
 * `reveal[i]` (0..1 per row, sampled from the timeline) is the deck "build":
 * bullets appear one at a time, bound to a narration cue, and scrubbing
 * backwards un-builds them because the whole thing is a pure function of t.
 */
import * as React from 'react'
import type {
  RenderItem,
  ThemeTokens,
  ListRenderContent,
  TableRenderContent,
  ChartRenderContent,
  StatRenderContent,
  QuoteRenderContent,
} from '@bingoo/explainer'
import { resolveStyle } from '../theme/tokens'
import { itemTransform, wrapText } from './util'
import { rungSize } from '@bingoo/explainer'

type Canvas = { w: number; h: number }
const col = (theme: ThemeTokens, id: string | undefined, fb: string) =>
  (id ? (theme.colors[id] ?? id) : undefined) ?? fb
const sansOf = (theme: ThemeTokens) => theme.fonts?.sans ?? 'system-ui, sans-serif'

/** Rows slide in from the left as they build — the deck "appear" feel. */
function rowIn(r: number, dx = 26): { opacity: number; tx: number } {
  const v = Math.max(0, Math.min(1, r))
  return { opacity: v, tx: (1 - v) * dx }
}

/* ─────────────────────────────────────────────────────────────────────── list */

export function ListEl({ item, theme, canvas }: { item: RenderItem; theme: ThemeTokens; canvas: Canvas }) {
  const c = item.content as ListRenderContent
  const { transform, opacity } = itemTransform(item)
  const s = resolveStyle(theme, item.style)
  const { w, h } = item.rect
  const n = c.items.length
  if (!n) return null

  // Start at the authored rung and step DOWN only until every line fits. The
  // rung is the RANK — a bullet must not outgrow a body paragraph elsewhere.
  const ideal = rungSize(item.style?.fontSize ?? (c.dense ? 'label' : 'body'), canvas)
  const marker = c.style !== 'none'
  const indent = marker ? Math.min(w * 0.09, ideal * 1.9) : 0
  const textW = w - indent

  let size = ideal
  let lines: string[][] = []
  for (; size >= ideal * 0.6; size -= 1) {
    lines = c.items.map((t) => wrapText(t, size, textW))
    const total = lines.reduce((a, ls) => a + ls.length, 0)
    const gaps = (n - 1) * size * 0.55
    if (total * size * 1.26 + gaps <= h) break
  }

  const lineH = size * 1.26
  const gap = size * 0.55
  const blockH = lines.reduce((a, ls) => a + ls.length * lineH, 0) + (n - 1) * gap
  let y = Math.max(0, (h - blockH) / 2)

  const ink = s.stroke
  const accent = col(theme, 'accent', '#e07a42')
  const good = col(theme, 'good', '#3f9d5a')
  const font = s.fontFamily

  const rows: React.ReactElement[] = []
  c.items.forEach((_, i) => {
    const ls = lines[i]!
    const rv = c.reveal[i] ?? 1
    const { opacity: o, tx } = rowIn(rv)
    const top = y
    rows.push(
      <g key={i} opacity={o} transform={`translate(${tx} 0)`}>
        {marker ? (
          <Marker
            style={c.style}
            i={i}
            x={indent * 0.5}
            y={top + size * 0.78}
            size={size}
            accent={c.style === 'check' ? good : accent}
            font={font}
          />
        ) : null}
        <text
          x={indent}
          y={top + size * 0.8}
          fontSize={size}
          fontWeight={600}
          fill={ink}
          style={{ fontFamily: font, userSelect: 'none' }}
        >
          {ls.map((ln, j) => (
            <tspan key={j} x={indent} dy={j === 0 ? 0 : lineH}>
              {ln}
            </tspan>
          ))}
        </text>
      </g>,
    )
    y += ls.length * lineH + gap
  })

  return (
    <g transform={transform} opacity={opacity}>
      {rows}
    </g>
  )
}

function Marker({
  style,
  i,
  x,
  y,
  size,
  accent,
  font,
}: {
  style: ListRenderContent['style']
  i: number
  x: number
  y: number
  size: number
  accent: string
  font: string
}) {
  if (style === 'number')
    return (
      <text
        x={x}
        y={y}
        fontSize={size * 0.9}
        fontWeight={800}
        fill={accent}
        textAnchor="middle"
        style={{ fontFamily: font }}
      >
        {i + 1}.
      </text>
    )
  if (style === 'check')
    return (
      <path
        d={`M ${x - size * 0.3} ${y - size * 0.28} l ${size * 0.22} ${size * 0.24} l ${size * 0.42} ${-size * 0.52}`}
        fill="none"
        stroke={accent}
        strokeWidth={size * 0.13}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )
  if (style === 'dash')
    return (
      <line
        x1={x - size * 0.3}
        y1={y - size * 0.28}
        x2={x + size * 0.3}
        y2={y - size * 0.28}
        stroke={accent}
        strokeWidth={size * 0.12}
        strokeLinecap="round"
      />
    )
  return <circle cx={x} cy={y - size * 0.28} r={size * 0.19} fill={accent} />
}

/* ──────────────────────────────────────────────────────────────────────ual table */

export function TableEl({ item, theme, canvas }: { item: RenderItem; theme: ThemeTokens; canvas: Canvas }) {
  const c = item.content as TableRenderContent
  const { transform, opacity } = itemTransform(item)
  const { w, h } = item.rect
  const hasHead = !!c.header?.length
  const cols = Math.max(c.header?.length ?? 0, ...c.rows.map((r) => r.length), 1)
  const nRows = c.rows.length + (hasHead ? 1 : 0)
  if (!nRows) return null

  const rowH = h / nRows
  const colW = w / cols
  const size = Math.min(rungSize('label', canvas), rowH * 0.46)
  const ink = col(theme, 'ink', '#2b2724')
  const soft = col(theme, 'inkSoft', '#7d736a')
  const faint = col(theme, 'faint', '#d8cfc2')
  const font = sansOf(theme)
  const alignOf = (i: number) => c.align?.[i] ?? (i === 0 ? 'left' : 'center')
  const cellX = (i: number) => {
    const a = alignOf(i)
    const pad = colW * 0.1
    return a === 'left' ? i * colW + pad : a === 'right' ? (i + 1) * colW - pad : i * colW + colW / 2
  }
  const anchorOf = (i: number) => {
    const a = alignOf(i)
    return a === 'left' ? 'start' : a === 'right' ? 'end' : 'middle'
  }

  return (
    <g transform={transform} opacity={opacity}>
      {hasHead ? (
        <>
          <rect
            x={0}
            y={0}
            width={w}
            height={rowH}
            rx={rowH * 0.18}
            fill={col(theme, 'accent', '#e07a42')}
            opacity={0.12}
          />
          {c.header!.map((t, i) => (
            <text
              key={i}
              x={cellX(i)}
              y={rowH / 2 + size * 0.36}
              fontSize={size}
              fontWeight={800}
              fill={ink}
              textAnchor={anchorOf(i)}
              style={{ fontFamily: font, userSelect: 'none', letterSpacing: '0.02em' }}
            >
              {t}
            </text>
          ))}
        </>
      ) : null}

      {c.rows.map((row, ri) => {
        const y0 = (ri + (hasHead ? 1 : 0)) * rowH
        const { opacity: o, tx } = rowIn(c.reveal[ri] ?? 1)
        return (
          <g key={ri} opacity={o} transform={`translate(${tx} 0)`}>
            {ri % 2 === 1 ? <rect x={0} y={y0} width={w} height={rowH} fill={faint} opacity={0.25} /> : null}
            <line x1={0} y1={y0} x2={w} y2={y0} stroke={faint} strokeWidth={1.5} />
            {row.map((t, ci) => (
              <text
                key={ci}
                x={cellX(ci)}
                y={y0 + rowH / 2 + size * 0.36}
                fontSize={size}
                fontWeight={ci === 0 ? 700 : 600}
                fill={ci === 0 ? ink : soft}
                textAnchor={anchorOf(ci)}
                style={{ fontFamily: font, userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}
              >
                {t}
              </text>
            ))}
          </g>
        )
      })}
    </g>
  )
}

/* ────────────────────────────────────────────────────────────────────── chart */

const PALETTE = ['accent', 'accent2', 'good', 'warn', 'leafDeep', 'inkSoft']

export function ChartEl({ item, theme, canvas }: { item: RenderItem; theme: ThemeTokens; canvas: Canvas }) {
  const c = item.content as ChartRenderContent
  const { transform, opacity } = itemTransform(item)
  if (!c.series.length) return null
  const pie = c.chart === 'pie' || c.chart === 'donut'
  return (
    <g transform={transform} opacity={opacity}>
      {pie ? (
        <PieChart c={c} theme={theme} rect={item.rect} canvas={canvas} />
      ) : (
        <AxisChart c={c} theme={theme} rect={item.rect} canvas={canvas} />
      )}
    </g>
  )
}

/** bar (horizontal) · column (vertical) · line · area — all share one axis frame. */
function AxisChart({
  c,
  theme,
  rect,
  canvas,
}: {
  c: ChartRenderContent
  theme: ThemeTokens
  rect: { w: number; h: number }
  canvas: Canvas
}) {
  const size = rungSize('label', canvas) * 0.82
  const font = sansOf(theme)
  const ink = col(theme, 'ink', '#2b2724')
  const soft = col(theme, 'inkSoft', '#7d736a')
  const faint = col(theme, 'faint', '#d8cfc2')
  const horizontal = c.chart === 'bar'

  // gutters: room for the labels, derived from the type size (not guessed px)
  const padL = horizontal ? Math.min(rect.w * 0.3, size * 7) : size * 3.2
  const padB = horizontal ? size * 2.2 : size * 2.6
  const padT = size * 1.4
  const padR = size * 1.6
  const pw = Math.max(1, rect.w - padL - padR)
  const ph = Math.max(1, rect.h - padT - padB)

  const TICKS = 4
  const ticks = Array.from({ length: TICKS + 1 }, (_, i) => (c.max * i) / TICKS)
  const n = c.series.length

  const grid = ticks.map((v, i) => {
    const f = v / c.max
    return horizontal ? (
      <g key={i}>
        <line
          x1={padL + f * pw}
          y1={padT}
          x2={padL + f * pw}
          y2={padT + ph}
          stroke={faint}
          strokeWidth={1}
          opacity={0.7}
        />
        <text
          x={padL + f * pw}
          y={padT + ph + size * 1.3}
          fontSize={size * 0.8}
          fill={soft}
          textAnchor="middle"
          style={{ fontFamily: font, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmt(v)}
        </text>
      </g>
    ) : (
      <g key={i}>
        <line
          x1={padL}
          y1={padT + (1 - f) * ph}
          x2={padL + pw}
          y2={padT + (1 - f) * ph}
          stroke={faint}
          strokeWidth={1}
          opacity={0.7}
        />
        <text
          x={padL - size * 0.5}
          y={padT + (1 - f) * ph + size * 0.32}
          fontSize={size * 0.8}
          fill={soft}
          textAnchor="end"
          style={{ fontFamily: font, fontVariantNumeric: 'tabular-nums' }}
        >
          {fmt(v)}
        </text>
      </g>
    )
  })

  const band = (horizontal ? ph : pw) / n
  const thick = band * 0.62

  const marks: React.ReactElement[] = []
  if (c.chart === 'line' || c.chart === 'area') {
    const pts = c.series.map((s, i) => ({
      x: padL + band * (i + 0.5),
      y: padT + (1 - s.value / c.max) * ph,
      r: c.reveal[i] ?? 1,
    }))
    const shown = pts.filter((p) => p.r > 0.02)
    const d = shown.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const stroke = col(theme, 'accent', '#e07a42')
    if (c.chart === 'area' && shown.length > 1) {
      marks.push(
        <path
          key="area"
          d={`${d} L ${shown[shown.length - 1]!.x} ${padT + ph} L ${shown[0]!.x} ${padT + ph} Z`}
          fill={stroke}
          opacity={0.16}
        />,
      )
    }
    if (shown.length > 1)
      marks.push(
        <path
          key="line"
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={size * 0.22}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      )
    pts.forEach((p, i) =>
      marks.push(<circle key={`p${i}`} cx={p.x} cy={p.y} r={size * 0.3} fill={stroke} opacity={p.r} />),
    )
  } else {
    c.series.forEach((s, i) => {
      const f = (s.value / c.max) * (c.reveal[i] ?? 1) // the BUILD grows the bar
      const fill = col(theme, s.color ?? PALETTE[i % PALETTE.length], '#e07a42')
      if (horizontal) {
        const y = padT + band * i + (band - thick) / 2
        marks.push(
          <rect
            key={i}
            x={padL}
            y={y}
            width={Math.max(0, f * pw)}
            height={thick}
            rx={thick * 0.22}
            fill={fill}
          />,
        )
        if (c.showValues && f > 0.02)
          marks.push(
            <text
              key={`v${i}`}
              x={padL + f * pw + size * 0.5}
              y={y + thick / 2 + size * 0.32}
              fontSize={size * 0.85}
              fontWeight={700}
              fill={ink}
              style={{ fontFamily: font, fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(s.value)}
              {c.unit ?? ''}
            </text>,
          )
      } else {
        const bh = Math.max(0, f * ph)
        const x = padL + band * i + (band - thick) / 2
        marks.push(
          <rect key={i} x={x} y={padT + ph - bh} width={thick} height={bh} rx={thick * 0.18} fill={fill} />,
        )
        if (c.showValues && f > 0.02)
          marks.push(
            <text
              key={`v${i}`}
              x={x + thick / 2}
              y={padT + ph - bh - size * 0.42}
              fontSize={size * 0.85}
              fontWeight={700}
              fill={ink}
              textAnchor="middle"
              style={{ fontFamily: font, fontVariantNumeric: 'tabular-nums' }}
            >
              {fmt(s.value)}
              {c.unit ?? ''}
            </text>,
          )
      }
    })
  }

  const cats = c.series.map((s, i) =>
    horizontal ? (
      <text
        key={i}
        x={padL - size * 0.6}
        y={padT + band * (i + 0.5) + size * 0.34}
        fontSize={size * 0.9}
        fontWeight={700}
        fill={ink}
        textAnchor="end"
        style={{ fontFamily: font }}
        opacity={c.reveal[i] ?? 1}
      >
        {s.label}
      </text>
    ) : (
      <text
        key={i}
        x={padL + band * (i + 0.5)}
        y={padT + ph + size * 1.5}
        fontSize={size * 0.9}
        fontWeight={700}
        fill={ink}
        textAnchor="middle"
        style={{ fontFamily: font }}
        opacity={c.reveal[i] ?? 1}
      >
        {s.label}
      </text>
    ),
  )

  return (
    <>
      {grid}
      {marks}
      {cats}
      <line x1={padL} y1={padT + ph} x2={padL + pw} y2={padT + ph} stroke={soft} strokeWidth={2} />
    </>
  )
}

function PieChart({
  c,
  theme,
  rect,
  canvas,
}: {
  c: ChartRenderContent
  theme: ThemeTokens
  rect: { w: number; h: number }
  canvas: Canvas
}) {
  const size = rungSize('label', canvas) * 0.82
  const font = sansOf(theme)
  const ink = col(theme, 'ink', '#2b2724')
  const legendW = Math.min(rect.w * 0.42, size * 10)
  const cw = rect.w - legendW
  const R = Math.max(1, Math.min(cw, rect.h) / 2 - size * 0.6)
  const cx = cw / 2
  const cy = rect.h / 2
  const inner = c.chart === 'donut' ? R * 0.55 : 0

  let acc = 0
  const slices = c.series.map((s, i) => {
    const frac = c.total > 0 ? s.value / c.total : 0
    const a0 = acc * Math.PI * 2 - Math.PI / 2
    acc += frac
    const a1 = acc * Math.PI * 2 - Math.PI / 2
    const rv = c.reveal[i] ?? 1
    const fill = col(theme, s.color ?? PALETTE[i % PALETTE.length], '#e07a42')
    return { i, a0, a1, fill, rv, frac, label: s.label }
  })

  const arc = (a0: number, a1: number) => {
    const large = a1 - a0 > Math.PI ? 1 : 0
    const p = (a: number, r: number) => `${cx + Math.cos(a) * r} ${cy + Math.sin(a) * r}`
    if (inner > 0)
      return `M ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} L ${p(a1, inner)} A ${inner} ${inner} 0 ${large} 0 ${p(a0, inner)} Z`
    return `M ${cx} ${cy} L ${p(a0, R)} A ${R} ${R} 0 ${large} 1 ${p(a1, R)} Z`
  }

  return (
    <>
      {slices.map((s) => (
        <path
          key={s.i}
          d={arc(s.a0, s.a1)}
          fill={s.fill}
          opacity={s.rv}
          stroke={col(theme, 'paper', '#f7f2e9')}
          strokeWidth={3}
        />
      ))}
      {slices.map((s, i) => {
        const ly = rect.h / 2 - (slices.length * size * 1.7) / 2 + i * size * 1.7 + size * 0.6
        return (
          <g key={`l${s.i}`} opacity={s.rv}>
            <rect
              x={cw + size * 0.4}
              y={ly - size * 0.62}
              width={size * 0.8}
              height={size * 0.8}
              rx={size * 0.2}
              fill={s.fill}
            />
            <text
              x={cw + size * 1.6}
              y={ly}
              fontSize={size * 0.88}
              fontWeight={700}
              fill={ink}
              style={{ fontFamily: font, fontVariantNumeric: 'tabular-nums' }}
            >
              {s.label} · {Math.round(s.frac * 100)}%
            </text>
          </g>
        )
      })}
    </>
  )
}

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 10) / 10))

/* ─────────────────────────────────────────────────────────────── stat / quote */

export function StatEl({ item, theme, canvas }: { item: RenderItem; theme: ThemeTokens; canvas: Canvas }) {
  const c = item.content as StatRenderContent
  const { transform, opacity } = itemTransform(item)
  const { w, h } = item.rect
  const font = sansOf(theme)

  const labelSize = rungSize('label', canvas) * 0.9
  // the number owns the cell; the caption is a footnote under it
  let valueSize = Math.min(rungSize('huge', canvas), h * 0.52)
  while (valueSize > labelSize && c.value.length * valueSize * 0.62 > w * 0.9) valueSize -= 2

  const accent = col(theme, c.color ?? 'accent', '#e07a42')
  const soft = col(theme, 'inkSoft', '#7d736a')
  const hasLabel = !!c.label
  const cy = hasLabel ? h * 0.44 : h * 0.55

  return (
    <g transform={transform} opacity={opacity}>
      <text
        x={w / 2}
        y={cy}
        fontSize={valueSize}
        fontWeight={800}
        fill={accent}
        textAnchor="middle"
        style={{ fontFamily: font, userSelect: 'none', fontVariantNumeric: 'tabular-nums' }}
      >
        {c.value}
        {c.unit ? (
          <tspan fontSize={valueSize * 0.5} fill={soft}>
            {c.unit}
          </tspan>
        ) : null}
      </text>
      {hasLabel ? (
        <text
          x={w / 2}
          y={h * 0.78}
          fontSize={labelSize}
          fontWeight={700}
          fill={soft}
          textAnchor="middle"
          style={{ fontFamily: font, userSelect: 'none' }}
        >
          {c.label}
        </text>
      ) : null}
    </g>
  )
}

export function QuoteEl({ item, theme, canvas }: { item: RenderItem; theme: ThemeTokens; canvas: Canvas }) {
  const c = item.content as QuoteRenderContent
  const { transform, opacity } = itemTransform(item)
  const s = resolveStyle(theme, item.style)
  const { w, h } = item.rect

  const ideal = rungSize(item.style?.fontSize ?? 'title', canvas)
  let size = ideal
  let lines = wrapText(c.text, size, w * 0.88)
  while (size > ideal * 0.55 && lines.length * size * 1.3 > h * 0.78) {
    size -= 2
    lines = wrapText(c.text, size, w * 0.88)
  }
  const lineH = size * 1.3
  const bar = col(theme, 'accent', '#e07a42')
  const top = Math.max(0, (h - lines.length * lineH) / 2)
  const x = w * 0.09

  return (
    <g transform={transform} opacity={opacity}>
      <rect
        x={0}
        y={top - size * 0.3}
        width={size * 0.16}
        height={lines.length * lineH + size * 0.3}
        rx={size * 0.08}
        fill={bar}
      />
      <text
        x={x}
        y={top + size * 0.82}
        fontSize={size}
        fontWeight={700}
        fill={s.stroke}
        style={{ fontFamily: s.fontFamily, userSelect: 'none', fontStyle: 'italic' }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={x} dy={i === 0 ? 0 : lineH}>
            {ln}
          </tspan>
        ))}
      </text>
      {c.by ? (
        <text
          x={x}
          y={top + lines.length * lineH + size * 0.9}
          fontSize={size * 0.5}
          fontWeight={700}
          fill={col(theme, 'inkSoft', '#7d736a')}
          style={{ fontFamily: sansOf(theme), userSelect: 'none' }}
        >
          — {c.by}
        </text>
      ) : null}
    </g>
  )
}
