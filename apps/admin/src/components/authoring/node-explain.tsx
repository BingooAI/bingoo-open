// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { HelpCircle, Hash, Layers, Link2, Sparkles } from 'lucide-react'
import { Badge } from '@bingoo.ai/ui-web'
import { explainRelation, type RelationBasis } from '@bingoo.ai/authoring'
import type { Facets } from '@bingoo.ai/facets'
import type { GraphViewDto } from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

// Cạnh nào MÁY chứng được thứ tự, cạnh nào là phán đoán người soạn — câu {vi,en} theo mã.
const REL_KEY: Record<RelationBasis, string> = {
  'ordering-proven': 'relProven',
  'ordering-contradicted': 'relContradicted',
  'ordering-judgment': 'relJudgment',
  mapping: 'relMapping',
  lateral: 'relLateral',
}
const REL_TONE: Record<RelationBasis, string> = {
  'ordering-proven': 'text-info',
  'ordering-contradicted': 'text-danger',
  'ordering-judgment': 'text-warning',
  mapping: 'text-info',
  lateral: 'text-foreground-subtle',
}

/**
 * DIỄN GIẢI một node khi người soạn bấm vào đồ thị khung (XAI).
 *
 * Đồ thị vốn chỉ vẽ hình; bấm một node xong "rồi sao?" — đây là câu trả lời: node này LÀ gì
 * (loại, mã, mạch), **FACETS** phân biệt nó với KC khác (thứ quyết định hai KC có phải một —
 * người duyệt phải thấy), và nó ĐỨNG ĐÂU trong mạng (đo mục tiêu nào, cần gì trước, thuộc về ai)
 * bằng ngôn ngữ thường. Không endpoint mới: mọi thứ suy từ đồ thị đã tải.
 */

type Node = GraphViewDto['nodes'][number]
type Edge = GraphViewDto['edges'][number]

const loc = (t: Record<string, string>): string => t.vi ?? t.en ?? ''

// facets của node (GraphViewDto để mở) → kiểu Facets cho explainRelation. compareScope tự chịu được
// khoá phi-số/thiếu, nên cast lỏng là an toàn.
const facetsOf = (n?: Node): Facets | undefined => n?.facets as unknown as Facets | undefined

// Thứ tự trục facets ổn định (khớp @bingoo.ai/facets FACET_AXES) — nhãn lấy qua i18n.
const FACET_AXES = ['object', 'channel', 'bloom', 'scope', 'representation'] as const

/** Một quan hệ nhìn từ góc node đang chọn: nhãn thường + node đầu kia + cạnh gốc (để giải thích). */
interface Rel {
  labelKey: string
  other: string
  from: string
  to: string
  relType: string
}

function relationsOf(slug: string, edges: Edge[]): Rel[] {
  const out: Rel[] = []
  for (const e of edges) {
    const isFrom = e.from === slug
    const isTo = e.to === slug
    if (!isFrom && !isTo) continue
    const other = isFrom ? e.to : e.from
    const relType = e.relType ?? ''
    let labelKey: string
    switch (relType) {
      case 'MAPS_TO':
        // objective → KC: mục tiêu "đo bằng" KC; KC "phục vụ" mục tiêu.
        labelKey = isFrom ? 'explainRelMeasuredBy' : 'explainRelServes'
        break
      case 'PREREQUISITE':
      case 'ENABLES':
        labelKey = isFrom ? 'explainRelOpens' : 'explainRelNeeds'
        break
      case 'COMPOSES':
        labelKey = isFrom ? 'explainRelPartOf' : 'explainRelContains'
        break
      case 'ALIGNS':
        labelKey = 'explainRelAligns'
        break
      case 'VARIANT_OF':
        labelKey = 'explainRelVariant'
        break
      default:
        labelKey = 'explainRelRelated'
    }
    out.push({ labelKey, other, from: e.from, to: e.to, relType })
  }
  return out
}

/** Một giá trị facet → chuỗi đọc được (scope là record {trục: số}; còn lại là chuỗi/enum). */
function facetValue(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => `${k}: ${String(val)}`)
      .join(' · ')
  }
  return String(v)
}

export function NodeExplain({ slug, nodes, edges }: { slug: string; nodes: Node[]; edges: Edge[] }) {
  const t = useTranslations('admin.authoring')
  const [openRel, setOpenRel] = useState<number | null>(null)
  const enumLabel = (ns: string, k: string): string => (t.has(`${ns}.${k}`) ? t(`${ns}.${k}`) : k)

  const node = nodes.find((n) => n.slug === slug)
  const byId = new Map(nodes.map((n) => [n.slug, n]))
  if (!node) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-[13px] text-foreground-subtle">
        {t('explainSelectHint')}
      </div>
    )
  }

  const facets = node.facets ?? {}
  const shownFacets = FACET_AXES.map((axis) => ({ axis, val: facetValue(facets[axis]) })).filter(
    (f) => f.val !== '',
  )
  const relations = relationsOf(node.slug, edges)

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="soft" color={node.kind === 'OBJECTIVE' ? 'primary' : 'teal'}>
          {enumLabel('bdKind', node.kind)}
        </Badge>
        {node.code ? (
          <Badge tone="outline" color="neutral" className="font-mono">
            {node.code}
          </Badge>
        ) : null}
        {node.strand ? (
          <Badge tone="soft" color="neutral">
            {node.strand}
          </Badge>
        ) : null}
      </div>

      <p className="text-sm font-medium leading-relaxed text-foreground">{loc(node.title) || node.slug}</p>

      {/* FACETS — danh tính KC. Người duyệt phải thấy vì sao đây là KC riêng, không phải cái khác. */}
      {shownFacets.length ? (
        <div>
          <h5 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
            <Sparkles className="size-3" />
            {t('explainFacets')}
          </h5>
          <ul className="space-y-1">
            {shownFacets.map((f) => (
              <li key={f.axis} className="flex items-baseline gap-2 text-[12px]">
                <span className="shrink-0 text-foreground-subtle">{enumLabel('facetAxis', f.axis)}</span>
                <span className="text-foreground-muted">{f.val}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* QUAN HỆ — node đứng đâu trong mạng, bằng ngôn ngữ thường. */}
      <div>
        <h5 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          <Link2 className="size-3" />
          {t('explainRelations')}
        </h5>
        {relations.length ? (
          <ul className="space-y-1">
            {relations.map((r, i) => {
              const other = byId.get(r.other)
              const ex = explainRelation(facetsOf(byId.get(r.from)), facetsOf(byId.get(r.to)), r.relType)
              const open = openRel === i
              return (
                <li key={i} className="text-[12px] leading-snug">
                  <div className="flex items-baseline gap-1.5">
                    <span className="shrink-0 text-foreground-muted">{t(r.labelKey)}</span>
                    <span className="text-foreground">
                      {other ? loc(other.title) || other.slug : r.other}
                    </span>
                    <button
                      type="button"
                      onClick={() => setOpenRel(open ? null : i)}
                      aria-label={t('relWhy')}
                      aria-expanded={open}
                      className="focus-ring ml-auto shrink-0 rounded p-0.5 text-foreground-subtle hover:text-primary"
                    >
                      <HelpCircle className="size-3" />
                    </button>
                  </div>
                  {open ? (
                    <p
                      className={cn(
                        'mt-1 rounded-md border border-border/60 bg-surface-muted p-2 text-[11px] leading-relaxed',
                        REL_TONE[ex.basis],
                      )}
                    >
                      {t(REL_KEY[ex.basis])}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-foreground-subtle">{t('explainNoRelations')}</p>
        )}
      </div>

      <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] text-foreground-subtle">
        <Hash className="size-3 shrink-0" />
        <span className="truncate font-mono">{node.slug}</span>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-foreground-subtle">
        <Layers className="size-3 shrink-0 opacity-70" />
        {t('explainDerived')}
      </p>
    </div>
  )
}
