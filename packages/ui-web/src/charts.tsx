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
export type ChartColor =
  | 'primary'
  | 'teal'
  | 'sunbeam'
  | 'coral'
  | 'success'
  /**
   * Ba bậc dành riêng cho biểu đồ, đã chạy qua bộ kiểm sáu-mục trên CẢ hai nền (trắng và
   * `#14171f`): dải sáng · sàn chroma · tách được dưới mù màu · sàn mắt thường · tương phản.
   *
   * Thứ tự cam → lam → lục là CÓ CHỦ Ý. Xếp lục cạnh cam thì dưới protanopia hai màu chỉ tách
   * được ΔE 5.8 — dưới cả ngưỡng sàn, tức người mù màu đỏ-lục nhìn ra một khối liền. Chèn lam
   * vào giữa đẩy cặp xấu nhất lên 24.1.
   */
  | 'chart-teach'
  | 'chart-measure'
  | 'chart-done'

const CVAR: Record<ChartColor, string> = {
  primary: 'var(--color-primary)',
  teal: 'var(--color-accent-teal)',
  sunbeam: 'var(--color-accent-sunbeam)',
  coral: 'var(--color-accent-coral)',
  success: 'var(--color-success)',
  'chart-teach': 'var(--color-chart-teach)',
  'chart-measure': 'var(--color-chart-measure)',
  'chart-done': 'var(--color-chart-done)',
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

/**
 * Một trục của radar. `value: null` nghĩa là CHƯA ĐO — khác hẳn `0`.
 *
 * Đây là lý do kiểu này tồn tại thay vì dùng thẳng `XYPoint`. Radar mã hoá độ lớn bằng bán
 * kính, nên một trục thiếu dữ liệu vẽ ở tâm — và tâm đọc ra là *bằng không*. Với một báo cáo
 * về đứa trẻ, "chưa ai đo" bị vẽ thành "được không điểm" là hiểu sai tệ nhất mà hình này có
 * thể gây ra, và nó xảy ra âm thầm: hình vẫn đẹp, vẫn khép kín, chỉ sai.
 *
 * Nên trục chưa đo KHÔNG có đỉnh: đường viền đứt quãng ở đó, nan hoa vẽ nét đứt, và rìa trục
 * mang một vòng rỗng. Hình méo là đúng — dữ liệu vốn khuyết.
 */
export interface RadarPoint {
  label: string
  value: number | null
}

export interface RadarChartProps {
  data: RadarPoint[]
  max?: number
  color?: ChartColor
  size?: number
  className?: string
  ariaLabel?: string
  /** Nhãn cho trục chưa đo, đọc bởi trình đọc màn hình. Người gọi cấp (i18n, R4). */
  unmeasuredLabel?: string
  /** Đơn vị đọc lên trong tooltip gốc của SVG. */
  formatValue?: (value: number) => string
}

export function RadarChart({
  data,
  max = 100,
  color = 'primary',
  size = 200,
  className,
  ariaLabel = 'Radar chart',
  unmeasuredLabel = 'no data',
  formatValue,
}: RadarChartProps) {
  const stroke = CVAR[color]
  const cx = size / 2
  const cy = size / 2
  const r = size / 2 - 26
  const n = data.length
  if (n < 3) return null
  const fmt = formatValue ?? ((v: number) => String(Math.round(v)))
  const angle = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180)
  const at = (i: number, radius: number): [number, number] => [
    cx + Math.cos(angle(i)) * radius,
    cy + Math.sin(angle(i)) * radius,
  ]
  const vertex = (i: number, v: number): [number, number] => at(i, (Math.min(v, max) / max) * r)

  const measured = data.map((d) => d.value !== null)
  const allMeasured = measured.every(Boolean)

  // Khép kín CHỈ khi mọi trục đều có số. Còn một trục khuyết là còn một quãng không biết, và
  // một hình khép kín sẽ bịa mất quãng ấy.
  const closedPoints = allMeasured
    ? data
        .map((d, i) =>
          vertex(i, d.value as number)
            .map((v) => v.toFixed(1))
            .join(','),
        )
        .join(' ')
    : ''

  // Khi khuyết: chỉ nối các cặp trục LIỀN NHAU mà cả hai đều đo được.
  const segments: string[] = []
  if (!allMeasured) {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      if (!measured[i] || !measured[j]) continue
      const [x1, y1] = vertex(i, data[i]!.value as number)
      const [x2, y2] = vertex(j, data[j]!.value as number)
      segments.push(`M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}`)
    }
  }

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${size} ${size}`}
      // Co giãn theo ô chứa. Bản đầu khoá cứng 240px giữa một thẻ rộng gấp mấy lần, nên hình
      // bé tí trong một khoảng trống mênh mông — trông như lỗi dựng, chứ không như một lựa chọn.
      className={cn('h-auto w-full max-w-[320px]', className)}
      preserveAspectRatio="xMidYMid meet"
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

      {/* Vòng ngoài phải nói nó là bao nhiêu — không có mốc thì hình dáng không quy ra được số. */}
      <text
        x={cx}
        y={cy - r - 3}
        textAnchor="middle"
        className="fill-[var(--color-foreground-subtle)] text-[8px]"
      >
        {fmt(max)}
      </text>

      {data.map((d, i) => {
        const [x, y] = at(i, r)
        return (
          <line
            key={`spoke-${d.label}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={1}
            // Nan hoa nét đứt là tín hiệu thứ hai cho "chưa đo", ngoài vòng rỗng ở rìa —
            // để người không phân biệt được nét mảnh vẫn còn một dấu hiệu nữa.
            {...(d.value === null ? { strokeDasharray: '3 3' } : {})}
          />
        )
      })}

      {allMeasured ? (
        <polygon
          points={closedPoints}
          fill={stroke}
          fillOpacity={0.18}
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      ) : (
        segments.map((d) => (
          <path key={d} d={d} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        ))
      )}

      {data.map((d, i) => {
        if (d.value === null) {
          const [x, y] = at(i, r)
          return (
            <circle
              key={`gap-${d.label}`}
              cx={x}
              cy={y}
              r={4}
              fill="var(--color-surface)"
              stroke="var(--color-foreground-subtle)"
              strokeWidth={1.5}
              strokeDasharray="2 2"
            >
              <title>{`${d.label}: ${unmeasuredLabel}`}</title>
            </circle>
          )
        }
        const [x, y] = vertex(i, d.value)
        return (
          <circle
            key={`dot-${d.label}`}
            cx={x}
            cy={y}
            r={4}
            fill={stroke}
            stroke="var(--color-surface)"
            strokeWidth={2}
          >
            <title>{`${d.label}: ${fmt(d.value)}`}</title>
          </circle>
        )
      })}

      {data.map((d, i) => {
        const [x, y] = at(i, r + 12)
        return (
          <text
            key={`label-${d.label}`}
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

/* ------------------------------- StackedBar ------------------------------ */
export interface StackedSegment {
  label: string
  value: number
  color: ChartColor
}

export interface StackedBarProps {
  segments: StackedSegment[]
  className?: string
  ariaLabel?: string
  height?: number
}

/**
 * Phần-trên-tổng theo chiều ngang. Một thanh, các đoạn cách nhau 2px bằng chính màu nền — khe
 * hở là thứ giữ hai đoạn cạnh nhau đọc ra là hai, kể cả khi màu bị mù màu làm cho gần nhau.
 */
export function StackedBar({ segments, className, ariaLabel = 'Breakdown', height = 10 }: StackedBarProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total <= 0) return null
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('flex w-full overflow-hidden rounded-full', className)}
      style={{ height }}
    >
      {segments
        .filter((s) => s.value > 0)
        .map((s, i) => (
          <div
            key={s.label}
            title={`${s.label}: ${s.value}`}
            style={{
              width: `${(s.value / total) * 100}%`,
              background: CVAR[s.color],
              ...(i > 0 ? { marginLeft: 2 } : {}),
            }}
          />
        ))}
    </div>
  )
}

/* ------------------------------- RangeDots ------------------------------- */
export interface RangeRow {
  label: string
  value: number
  lo: number
  hi: number
  color?: ChartColor
}

export interface RangeDotsProps {
  rows: RangeRow[]
  /** Vạch mốc (ngưỡng đạt). Bỏ trống thì không vẽ. */
  reference?: number
  referenceLabel?: string
  max?: number
  className?: string
  formatValue?: (value: number) => string
}

/**
 * Chấm kèm khoảng — hình chính xác nhất cho "một con số và độ bất định của nó".
 *
 * Vị trí mã hoá giá trị (kênh chính xác nhất mắt người có), thanh mảnh là khoảng tin cậy, và
 * vạch đứt là ngưỡng đạt. Radar liếc một cái là thấy hình dáng; hình này mới là chỗ đọc ra
 * con số — và là chỗ duy nhất độ bất định hiện ra được, thứ radar không chở nổi.
 */
export function RangeDots({
  rows,
  reference,
  referenceLabel,
  max = 1,
  className,
  formatValue,
}: RangeDotsProps) {
  if (rows.length === 0) return null
  const fmt = formatValue ?? ((v: number) => `${Math.round((v / max) * 100)}%`)
  const pct = (v: number): number => Math.max(0, Math.min(1, v / max)) * 100

  // MỘT hàng = một lưới ba cột: nhãn · vùng vẽ · số. Bản đầu xếp nhãn LÊN TRÊN thanh và đẩy số
  // sang cột riêng, nên thanh giãn hết chiều rộng thẻ và con số văng ra tận mép — hai thứ vốn
  // thuộc về nhau bị tách xa nhất có thể, và cả hàng đọc ra như một thanh trượt.
  const GRID = 'grid grid-cols-[minmax(0,11rem)_1fr_2.75rem] items-center gap-x-3'

  return (
    <div className={cn('space-y-1', className)}>
      {/* Trục: không có nó thì chấm nằm ở đâu cũng không đọc ra số nào. */}
      <div className={cn(GRID, 'pb-1')}>
        <span />
        <div className="relative h-4 text-[10px] text-foreground-subtle">
          <span className="absolute left-0">{fmt(0)}</span>
          {reference !== undefined && (
            <span
              className="absolute -translate-x-1/2 whitespace-nowrap"
              style={{ left: `${pct(reference)}%` }}
            >
              {referenceLabel ?? fmt(reference)}
            </span>
          )}
          <span className="absolute right-0">{fmt(max)}</span>
        </div>
        <span />
      </div>

      {rows.map((row) => {
        const ink = CVAR[row.color ?? 'primary']
        return (
          <div key={row.label} className={cn(GRID, 'rounded-md py-1 hover:bg-surface-muted')}>
            <span className="truncate text-xs text-foreground" title={row.label}>
              {row.label}
            </span>

            <div
              className="relative h-5"
              title={`${row.label}: ${fmt(row.value)} (${fmt(row.lo)}–${fmt(row.hi)})`}
            >
              {/* Đường nền chạy hết bề rộng — nó là cái thước, không phải dữ liệu. */}
              <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--color-border)]" />
              {reference !== undefined && (
                <div
                  className="absolute inset-y-0 w-px border-l border-dashed border-[var(--color-foreground-subtle)]"
                  style={{ left: `${pct(reference)}%` }}
                />
              )}
              <div
                className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full opacity-45"
                style={{
                  left: `${pct(row.lo)}%`,
                  width: `${Math.max(0.6, pct(row.hi) - pct(row.lo))}%`,
                  background: ink,
                }}
              />
              <div
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-[var(--color-surface)]"
                style={{ left: `${pct(row.value)}%`, background: ink }}
              />
            </div>

            <span className="text-right text-xs font-medium tabular-nums text-foreground">
              {fmt(row.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
