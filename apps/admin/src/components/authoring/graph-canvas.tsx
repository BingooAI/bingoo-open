'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type WheelEvent } from 'react'
import {
  ArrowDownUp,
  ArrowUpDown,
  Group,
  Maximize2,
  Minimize2,
  Network,
  RotateCcw,
  TreePine,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Đồ thị tương tác dùng chung — màu theo loại/độ phủ, click để sáng liên kết, zoom/pan,
 * toàn màn hình, và 2 kiểu bố cục (tầng theo tiên quyết · cây).
 *
 * Nhãn được XUỐNG DÒNG (tối đa 3 dòng) chứ không cắt cụt: một node bị mất chữ là một quyết định
 * biên soạn bị mù — người soạn phải đọc được KC nói về cái gì thì mới duyệt được.
 */

export type NodeStatus = 'full' | 'partial' | 'none' | 'untethered' | undefined

export interface GNode {
  id: string
  label: string
  /** OBJECTIVE | SKILL | KNOWLEDGE | … hoặc 'LESSON' cho lớp khoá học. */
  kind: string
  /** Ép vào một băng cố định (0 = trên cùng). Không truyền → suy từ tiên quyết. */
  band?: number
  /** Độ phủ — tô màu cảnh báo (mục tiêu chưa dạy / KC dạy thừa). */
  status?: NodeStatus
  /** Dòng phụ hiện dưới nhãn (vd facets, mã LO). */
  meta?: string
  /** MẠCH kiến thức (strand) — để gom nhóm và THU GỌN. Một khung thật có ~300 mục tiêu; không thu
   *  gọn được thì đồ thị chỉ là một đám chỉ rối, nhìn cho vui chứ không duyệt được. */
  group?: string
}

export interface GEdge {
  from: string
  to: string
  relType: string
}

const W = 190
const H = 66
const GX = 60
const GY = 26
const BAND_GAP = 110

const ORDERING = new Set(['PREREQUISITE', 'ENABLES', 'COMPOSES'])

/** Màu theo LOẠI node. Độ phủ (status) ghi đè để cảnh báo nổi lên trước. */
function nodeColor(n: GNode): { fill: string; stroke: string } {
  if (n.status === 'none') return { fill: 'var(--color-danger-soft)', stroke: 'var(--color-danger)' }
  if (n.status === 'partial') return { fill: 'var(--color-warning-soft)', stroke: 'var(--color-warning)' }
  if (n.status === 'full') return { fill: 'var(--color-success-soft)', stroke: 'var(--color-success)' }
  if (n.status === 'untethered')
    return { fill: 'var(--color-surface-muted)', stroke: 'var(--color-foreground-subtle)' }

  switch (n.kind) {
    case 'OBJECTIVE':
      return { fill: 'var(--color-primary-soft)', stroke: 'var(--color-primary)' }
    case 'LESSON':
      return { fill: 'var(--color-accent-teal-soft)', stroke: 'var(--color-accent-teal)' }
    case 'SKILL':
      return { fill: 'var(--color-accent-sunbeam-soft)', stroke: 'var(--color-accent-sunbeam)' }
    case 'KNOWLEDGE':
      return { fill: 'var(--color-accent-coral-soft)', stroke: 'var(--color-accent-coral)' }
    default:
      return { fill: 'var(--color-surface-muted)', stroke: 'var(--color-border-strong)' }
  }
}

/** Ưu tiên cảnh báo: cụm mang trạng thái XẤU NHẤT của thành viên. */
const STATUS_RANK: Record<string, number> = { none: 3, partial: 2, untethered: 1, full: 0 }

function edgeColor(relType: string): string {
  if (relType === 'MAPS_TO') return 'var(--color-primary)'
  if (relType === 'TEACHES') return 'var(--color-accent-teal)'
  if (relType === 'ALIGNS') return 'var(--color-accent-coral)'
  return 'var(--color-border-strong)'
}

/** Xuống dòng theo từ — KHÔNG cắt cụt. Tối đa 3 dòng, dòng cuối mới thêm "…". */
function wrap(text: string, maxChars = 24, maxLines = 3): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > maxChars) {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines) break
    } else {
      cur = cur ? `${cur} ${w}` : w
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (lines.length === maxLines) {
    const used = lines.join(' ').length
    if (used < text.length - 1) lines[maxLines - 1] = `${lines[maxLines - 1]?.slice(0, maxChars - 1) ?? ''}…`
  }
  return lines
}

interface Placed extends GNode {
  x: number
  y: number
}

const groupKey = (n: GNode): string | undefined => (n.group ? `${n.band ?? 1}::${n.group}` : undefined)

/**
 * THU GỌN CỤM — thay toàn bộ thành viên của một mạch bằng MỘT node đại diện.
 *
 * Điều KHÔNG được phép xảy ra: thu gọn làm biến mất cảnh báo. Nếu trong mạch "Number" có một mục tiêu
 * chưa được dạy (đỏ), mà cụm lại hiện màu trung tính, thì việc thu gọn đã che đúng thứ người ta mở đồ
 * thị lên để tìm. Nên cụm luôn mang trạng thái XẤU NHẤT của thành viên, và ghi rõ còn bao nhiêu mục.
 */
function collapseGroups(
  nodes: GNode[],
  edges: GEdge[],
  collapsed: ReadonlySet<string>,
): { nodes: GNode[]; edges: GEdge[]; sizes: Map<string, number> } {
  if (collapsed.size === 0) return { nodes, edges, sizes: new Map() }

  const members = new Map<string, GNode[]>()
  const keep: GNode[] = []
  for (const n of nodes) {
    const k = groupKey(n)
    if (k && collapsed.has(k)) members.set(k, [...(members.get(k) ?? []), n])
    else keep.push(n)
  }

  const metaId = (k: string): string => `grp:${k}`
  const idToMeta = new Map<string, string>()
  const metas: GNode[] = []
  const sizes = new Map<string, number>()

  for (const [k, ms] of members) {
    for (const m of ms) idToMeta.set(m.id, metaId(k))
    const worst = ms.reduce<NodeStatus>((acc, m) => {
      const a = STATUS_RANK[acc ?? ''] ?? -1
      const b = STATUS_RANK[m.status ?? ''] ?? -1
      return b > a ? m.status : acc
    }, undefined)
    const first = ms[0]
    metas.push({
      id: metaId(k),
      label: first?.group ?? k,
      kind: 'GROUP',
      meta: `${ms.length} mục · bấm để mở`,
      ...(first?.band !== undefined ? { band: first.band } : {}),
      ...(worst ? { status: worst } : {}),
      ...(first?.group ? { group: first.group } : {}),
    })
    sizes.set(metaId(k), ms.length)
  }

  const remap = (id: string): string => idToMeta.get(id) ?? id
  const seen = new Set<string>()
  const outEdges: GEdge[] = []
  for (const e of edges) {
    const from = remap(e.from)
    const to = remap(e.to)
    if (from === to) continue // cạnh nội bộ cụm → nuốt vào trong cụm
    const key = `${from}→${to}·${e.relType}`
    if (seen.has(key)) continue // nhiều cạnh gộp lại thành một
    seen.add(key)
    outEdges.push({ from, to, relType: e.relType })
  }

  return { nodes: [...keep, ...metas], edges: outEdges, sizes }
}

type Layout = 'layered' | 'tree'
export type Direction = 'top-down' | 'bottom-up'

/**
 * Bố cục: BĂNG = lớp ngữ nghĩa (Mục tiêu → Năng lực → Bài học), xếp thành các HÀNG chồng lên nhau;
 * ĐỘ SÂU tiên quyết chạy sang PHẢI trong mỗi hàng. Đọc trái→phải, trên→dưới.
 *
 * `direction`:
 *   top-down  — Mục tiêu trên, Bài học dưới. Đọc "chuẩn → kiến thức → dạy"; mục tiêu KHÔNG có đường
 *               kéo xuống = CHƯA ĐƯỢC DẠY, nhìn phát thấy lỗ hổng.
 *   bottom-up — đảo lại, kể theo chiều bằng chứng đi lên.
 *
 * VẤN ĐỀ THẬT không phải hướng mà là CẠNH CHỒNG CHÉO: nếu thứ tự node trong mỗi băng tuỳ tiện thì
 * 15 mục tiêu × 15 KC cắt nhau thành mớ chỉ rối, không đọc được gì. Nên phải SẮP LẠI THEO TRỌNG TÂM
 * (barycenter): mỗi node được kéo về gần trung bình vị trí các node nó nối sang băng kia. Quét vài
 * lượt xuôi–ngược là số giao cắt giảm mạnh — đây mới là thứ làm đồ thị dễ nhìn.
 */
function layout(nodes: GNode[], edges: GEdge[], mode: Layout, direction: Direction): { placed: Placed[] } {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const bandOf = (id: string): number => byId.get(id)?.band ?? 1
  const ord = edges.filter(
    (e) => ORDERING.has(e.relType) && byId.has(e.from) && byId.has(e.to) && bandOf(e.from) === bandOf(e.to),
  )
  const cross = edges.filter((e) => byId.has(e.from) && byId.has(e.to) && bandOf(e.from) !== bandOf(e.to))

  const bands = [...new Set(nodes.map((n) => bandOf(n.id)))].sort((a, b) => a - b)

  // XƯƠNG SỐNG = băng có nhiều quan hệ tiên quyết nhất (thực tế: lớp Năng lực).
  // Đặt nó trước theo ĐỘ SÂU, rồi các băng khác BÁM THEO nó.
  const ordCount = new Map<number, number>()
  for (const e of ord) ordCount.set(bandOf(e.from), (ordCount.get(bandOf(e.from)) ?? 0) + 1)
  const spine =
    bands.length === 1
      ? (bands[0] as number)
      : ([...ordCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? bands[1] ?? bands[0] ?? 1)

  // ── ĐỘ SÂU trong xương sống ───────────────────────────────────────────────
  const spineIds = nodes.filter((n) => bandOf(n.id) === spine).map((n) => n.id)
  const depth = new Map<string, number>(spineIds.map((id) => [id, 0]))

  if (mode === 'layered') {
    for (let pass = 0; pass < spineIds.length; pass++) {
      let moved = false
      for (const e of ord) {
        if (bandOf(e.from) !== spine) continue
        const want = (depth.get(e.from) ?? 0) + 1
        if (want > (depth.get(e.to) ?? 0)) {
          depth.set(e.to, want)
          moved = true
        }
      }
      if (!moved) break
    }
  } else {
    const indeg = new Map<string, number>(spineIds.map((id) => [id, 0]))
    for (const e of ord) if (bandOf(e.to) === spine) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
    let frontier = spineIds.filter((id) => (indeg.get(id) ?? 0) === 0)
    const seen = new Set(frontier)
    let level = 0
    while (frontier.length) {
      const next: string[] = []
      for (const id of frontier) {
        depth.set(id, level)
        for (const e of ord) {
          if (e.from !== id || seen.has(e.to)) continue
          seen.add(e.to)
          next.push(e.to)
        }
      }
      frontier = next
      level++
    }
  }

  const pos = new Map<string, { x: number; y: number }>()

  // Xương sống: cột = độ sâu, các node cùng độ sâu xếp chồng theo hàng.
  const byDepth = new Map<number, string[]>()
  for (const id of spineIds) {
    const d = depth.get(id) ?? 0
    byDepth.set(d, [...(byDepth.get(d) ?? []), id])
  }
  let spineRows = 1
  for (const [d, list] of byDepth) {
    list.forEach((id, i) => pos.set(id, { x: d * (W + GX), y: i * (H + GY) }))
    spineRows = Math.max(spineRows, list.length)
  }
  const spineH = spineRows * (H + GY)

  // ── Các băng khác BÁM THEO xương sống ─────────────────────────────────────
  // x = TRỌNG TÂM của các node xương sống mà nó nối tới → cạnh liên-lớp thành đường NGẮN, gần thẳng
  // đứng, thay vì cắt chéo cả màn hình. Node không nối gì thì dồn về cuối.
  const neigh = new Map<string, string[]>()
  for (const e of cross) {
    neigh.set(e.from, [...(neigh.get(e.from) ?? []), e.to])
    neigh.set(e.to, [...(neigh.get(e.to) ?? []), e.from])
  }

  const others = bands.filter((b) => b !== spine)
  const bandNodes = new Map<number, string[]>()

  for (const b of others) {
    const ids = nodes.filter((n) => bandOf(n.id) === b).map((n) => n.id)
    const bx = new Map<string, number>()
    ids.forEach((id, i) => {
      const ns = (neigh.get(id) ?? []).filter((n) => pos.has(n))
      bx.set(
        id,
        ns.length
          ? ns.reduce((sum, n) => sum + (pos.get(n)?.x ?? 0), 0) / ns.length
          : Number.MAX_SAFE_INTEGER - ids.length + i, // không neo vào đâu → dồn cuối
      )
    })

    // Sắp theo trọng tâm rồi GIÃN RA để không đè nhau (giữ nguyên thứ tự → không sinh giao cắt mới).
    const sorted = [...ids].sort((a, b2) => (bx.get(a) ?? 0) - (bx.get(b2) ?? 0))
    let cursor = -Infinity
    sorted.forEach((id) => {
      const want = Math.min(bx.get(id) ?? 0, 1e6)
      const x = Math.max(want, cursor + W + 24)
      pos.set(id, { x, y: 0 })
      cursor = x
    })
    bandNodes.set(b, sorted)
  }

  // ── Xếp các băng thành HÀNG theo chiều đã chọn ────────────────────────────
  const laid = direction === 'top-down' ? bands : [...bands].reverse()
  const placed: Placed[] = []
  let yOffset = 0

  for (const b of laid) {
    const ids = b === spine ? spineIds : (bandNodes.get(b) ?? [])
    for (const id of ids) {
      const n = byId.get(id)
      const p = pos.get(id)
      if (!n || !p) continue
      placed.push({ ...n, x: p.x, y: yOffset + (b === spine ? p.y : 0) })
    }
    yOffset += (b === spine ? spineH : H + GY) + BAND_GAP
  }

  return { placed }
}

export function GraphCanvas({
  nodes,
  edges,
  legend,
  height = 520,
}: {
  nodes: GNode[]
  edges: GEdge[]
  legend?: { color: string; label: string }[]
  height?: number
}) {
  const [mode, setMode] = useState<Layout>('layered')
  const [dir, setDir] = useState<Direction>('top-down')
  const [scale, setScale] = useState(1)
  const [pan, setPan] = useState({ x: 20, y: 20 })
  const [sel, setSel] = useState<string | null>(null)
  const [full, setFull] = useState(false)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const allGroups = useMemo(
    () => [...new Set(nodes.map(groupKey).filter((k): k is string => k !== undefined))],
    [nodes],
  )

  // Đồ thị lớn thì MẶC ĐỊNH thu gọn. Một khung thật (Cambridge: 289 mục tiêu) mà đổ hết ra một lượt
  // thì không ai đọc được gì — mở đồ thị ra chỉ để thấy mình bất lực. Vào là thấy các MẠCH trước,
  // rồi tự bung mạch mình quan tâm.
  const [collapsed, setCollapsed] = useState<Set<string>>(() =>
    nodes.length > 40 ? new Set(nodes.map(groupKey).filter((k): k is string => k !== undefined)) : new Set(),
  )

  const view = useMemo(() => collapseGroups(nodes, edges, collapsed), [nodes, edges, collapsed])
  const vnodes = view.nodes
  const vedges = view.edges

  const { placed } = useMemo(() => layout(vnodes, vedges, mode, dir), [vnodes, vedges, mode, dir])
  const pos = useMemo(() => new Map(placed.map((p) => [p.id, p])), [placed])

  /** Khung bao quanh từng mạch ĐANG MỞ — để mắt gom được các node cùng mạch, và bấm nhãn là gọn lại. */
  const hulls = useMemo(() => {
    const by = new Map<string, Placed[]>()
    for (const p of placed) {
      const k = groupKey(p)
      if (!k || p.kind === 'GROUP') continue
      by.set(k, [...(by.get(k) ?? []), p])
    }
    return [...by.entries()]
      .filter(([, ms]) => ms.length > 1)
      .map(([k, ms]) => ({
        key: k,
        label: ms[0]?.group ?? k,
        x: Math.min(...ms.map((m) => m.x)) - 10,
        y: Math.min(...ms.map((m) => m.y)) - 22,
        w: Math.max(...ms.map((m) => m.x)) - Math.min(...ms.map((m) => m.x)) + W + 20,
        h: Math.max(...ms.map((m) => m.y)) - Math.min(...ms.map((m) => m.y)) + H + 32,
      }))
  }, [placed])

  const toggleGroup = useCallback((k: string) => {
    setCollapsed((c) => {
      const next = new Set(c)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })
    setSel(null)
  }, [])

  /** Node/cạnh liên quan tới node đang chọn — dùng để làm sáng, phần còn lại mờ đi. */
  const related = useMemo(() => {
    if (!sel) return null
    const nodeIds = new Set<string>([sel])
    const edgeKeys = new Set<string>()
    vedges.forEach((e, i) => {
      if (e.from === sel || e.to === sel) {
        nodeIds.add(e.from)
        nodeIds.add(e.to)
        edgeKeys.add(`${i}`)
      }
    })
    return { nodeIds, edgeKeys }
  }, [sel, vedges])

  const onWheel = useCallback((e: WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    setScale((s) => Math.min(2.5, Math.max(0.25, s * (e.deltaY < 0 ? 1.12 : 0.89))))
  }, [])

  const reset = useCallback(() => {
    setScale(1)
    setPan({ x: 20, y: 20 })
    setSel(null)
  }, [])

  // Esc để thoát toàn màn hình.
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [full])

  if (nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-foreground-muted">
        Chưa có node nào.
      </div>
    )
  }

  const btn =
    'grid size-8 place-items-center rounded-lg border border-border bg-surface text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground'

  return (
    <div
      className={cn(
        'relative rounded-xl border border-border bg-surface',
        full && 'fixed inset-0 z-50 rounded-none',
      )}
    >
      {/* thanh điều khiển */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          type="button"
          className={cn(btn, mode === 'layered' && 'border-primary text-primary')}
          onClick={() => setMode('layered')}
          title="Xếp tầng theo tiên quyết"
        >
          <Network className="size-4" />
        </button>
        <button
          type="button"
          className={cn(btn, mode === 'tree' && 'border-primary text-primary')}
          onClick={() => setMode('tree')}
          title="Xem dạng cây"
        >
          <TreePine className="size-4" />
        </button>
        <span className="w-1" />
        <button
          type="button"
          className={btn}
          onClick={() => setDir((d) => (d === 'top-down' ? 'bottom-up' : 'top-down'))}
          title={
            dir === 'top-down'
              ? 'Đang TOP-DOWN (chuẩn → kiến thức → dạy) — bấm để đảo'
              : 'Đang BOTTOM-UP (dạy → kiến thức → chuẩn) — bấm để đảo'
          }
        >
          {dir === 'top-down' ? <ArrowDownUp className="size-4" /> : <ArrowUpDown className="size-4" />}
        </button>
        {allGroups.length > 1 ? (
          <>
            <span className="w-1" />
            <button
              type="button"
              className={cn(btn, collapsed.size > 0 && 'border-primary text-primary')}
              onClick={() => setCollapsed((c) => (c.size > 0 ? new Set() : new Set(allGroups)))}
              title={
                collapsed.size > 0
                  ? `Đang thu gọn ${collapsed.size}/${allGroups.length} mạch — bấm để bung hết`
                  : `Thu gọn cả ${allGroups.length} mạch`
              }
            >
              {collapsed.size > 0 ? <Ungroup className="size-4" /> : <Group className="size-4" />}
            </button>
          </>
        ) : null}
        <span className="w-1" />
        <button
          type="button"
          className={btn}
          onClick={() => setScale((s) => Math.min(2.5, s * 1.2))}
          title="Phóng to"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          type="button"
          className={btn}
          onClick={() => setScale((s) => Math.max(0.25, s / 1.2))}
          title="Thu nhỏ"
        >
          <ZoomOut className="size-4" />
        </button>
        <button type="button" className={btn} onClick={reset} title="Về mặc định">
          <RotateCcw className="size-4" />
        </button>
        <button type="button" className={btn} onClick={() => setFull((f) => !f)} title="Toàn màn hình (Esc)">
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      </div>

      {/* chú giải */}
      {legend?.length ? (
        <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-border bg-surface/90 px-2.5 py-1.5 backdrop-blur">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-foreground-muted">
              <span className="size-2.5 rounded-sm" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      ) : null}

      {sel ? (
        <button
          type="button"
          onClick={() => setSel(null)}
          className="absolute bottom-3 left-3 z-10 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground-muted hover:text-foreground"
        >
          Bỏ chọn ({related?.nodeIds.size ?? 1} node liên quan)
        </button>
      ) : null}

      <svg
        width="100%"
        height={full ? '100%' : height}
        onWheel={onWheel}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
          ;(e.target as Element).setPointerCapture?.(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (!drag.current) return
          setPan({
            x: drag.current.px + (e.clientX - drag.current.x),
            y: drag.current.py + (e.clientY - drag.current.y),
          })
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        className={cn('touch-none select-none', drag.current ? 'cursor-grabbing' : 'cursor-grab')}
        role="img"
        aria-label="Đồ thị năng lực"
      >
        <defs>
          <marker
            id="gc-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-border-strong)" />
          </marker>
        </defs>

        <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
          {/* khung mạch đang mở — bấm nhãn để thu gọn lại */}
          {hulls.map((h) => (
            <g key={h.key} className="cursor-pointer" onClick={() => toggleGroup(h.key)}>
              <rect
                x={h.x}
                y={h.y}
                width={h.w}
                height={h.h}
                rx={14}
                fill="none"
                stroke="var(--color-border)"
                strokeDasharray="6 5"
              />
              <text
                x={h.x + 10}
                y={h.y + 14}
                fill="var(--color-foreground-subtle)"
                className="text-[10px] font-semibold uppercase"
              >
                {h.label} · thu gọn
              </text>
            </g>
          ))}

          {/* cạnh */}
          {vedges.map((e, i) => {
            const a = pos.get(e.from)
            const b = pos.get(e.to)
            if (!a || !b) return null
            const dim = related !== null && !related.edgeKeys.has(`${i}`)
            const lateral = !ORDERING.has(e.relType)
            const sameBand = (a.band ?? 1) === (b.band ?? 1)

            // Cùng băng = TIÊN QUYẾT → nối ngang (trái→phải, theo trục độ sâu).
            // Khác băng = liên kết lớp (MAPS_TO/TEACHES) → nối dọc (đáy↔đỉnh, theo trục băng).
            const alongX = sameBand

            const [x1, y1, x2, y2] = alongX
              ? [a.x + W, a.y + H / 2, b.x, b.y + H / 2]
              : [a.x + W / 2, a.y + H, b.x + W / 2, b.y]
            const mx = (x1 + x2) / 2
            const my = (y1 + y2) / 2
            const d = alongX
              ? `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
              : `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`

            return (
              <path
                key={`${e.from}-${e.to}-${e.relType}-${i}`}
                d={d}
                fill="none"
                stroke={edgeColor(e.relType)}
                strokeWidth={related?.edgeKeys.has(`${i}`) ? 2.2 : 1.4}
                strokeDasharray={lateral ? '5 4' : undefined}
                markerEnd="url(#gc-arrow)"
                opacity={dim ? 0.1 : 0.75}
              />
            )
          })}

          {/* node */}
          {placed.map((n) => {
            const c = nodeColor(n)
            const dim = related !== null && !related.nodeIds.has(n.id)
            const isSel = sel === n.id
            const isGroup = n.kind === 'GROUP'
            const lines = wrap(n.label)

            return (
              <g
                key={n.id}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  // Bấm vào CỤM = bung ra. Bấm vào node thường = làm sáng liên kết.
                  if (isGroup) toggleGroup(n.id.slice(4))
                  else setSel((s) => (s === n.id ? null : n.id))
                }}
              >
                <rect
                  x={n.x}
                  y={n.y}
                  width={W}
                  height={H}
                  rx={10}
                  fill={c.fill}
                  stroke={c.stroke}
                  strokeWidth={isSel || isGroup ? 2.5 : 1.2}
                  strokeDasharray={isGroup ? '7 4' : undefined}
                />
                {lines.map((ln, i) => (
                  <text
                    key={i}
                    x={n.x + W / 2}
                    y={n.y + 17 + i * 13}
                    textAnchor="middle"
                    fill="var(--color-foreground)"
                    className="text-[11px] font-semibold"
                  >
                    {ln}
                  </text>
                ))}
                <text
                  x={n.x + W / 2}
                  y={n.y + H - 8}
                  textAnchor="middle"
                  fill="var(--color-foreground-muted)"
                  className="text-[9px]"
                >
                  {n.meta ?? n.kind}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
