// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, Download, Hash, Languages, Layers, Link2, Search, X } from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '@bingoo.ai/ui-web'
import { DecisionTrace } from './decision-trace'
import {
  downloadCasePackage,
  type CaseAssociation,
  type CaseItem,
  type CasePackage,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

/**
 * TRÌNH XEM CASE cho GIÁO VIÊN — không phải JSON thô.
 *
 * Một gói CASE là "khung năng lực ở định dạng máy đọc được". File thô toàn URI và mã kỹ thuật;
 * giáo viên nhìn không ra. Trình này dịch nó về thứ giáo viên nhận ra: các MỤC TIÊU gom theo
 * MẠCH kiến thức, mỗi mục tiêu có mã + phát biểu bằng TIẾNG VIỆT (rơi về tiếng Anh nếu khung
 * chưa dịch). Nhấn một mục tiêu để đọc phát biểu đầy đủ song ngữ và các quan hệ của nó —
 * đủ để một người duyệt (R5) soát trước khi mang khung ra dùng.
 *
 * Bản dịch lấy từ `extensions.localizedStatements` mà encode gài kèm; `fullStatement` (chuẩn CASE)
 * vẫn là tiếng Anh để liên thông. Không có gì kỹ thuật phải hiện lên trước — định danh máy nằm ở
 * chân, cho ai cần.
 */

interface Statement {
  /** Ngôn ngữ giao diện đang chọn (Việt nếu có), đưa lên đọc trước. */
  primary: string
  /** Bản còn lại (tiếng Anh gốc chuẩn), hiện phụ để đối chiếu — rỗng nếu trùng primary. */
  secondary: string
}

function statementOf(item: CaseItem, locale: string): Statement {
  const loc = item.extensions?.localizedStatements ?? {}
  const en = loc['en'] ?? item.fullStatement
  const vi = loc['vi']
  const wantVi = locale.startsWith('vi')
  const primary = wantVi ? (vi ?? en) : en
  const other = wantVi ? en : (vi ?? '')
  return { primary, secondary: other && other !== primary ? other : '' }
}

const levelOf = (item: CaseItem): string | undefined =>
  Array.isArray(item.educationLevel) ? item.educationLevel.join(', ') : item.educationLevel

/** Một quan hệ nhìn từ GÓC của mục tiêu đang chọn: nhãn thường + mục tiêu đầu kia. */
interface Relation {
  labelKey: string
  otherId: string
}

function relationsFor(selectedId: string, assocs: CaseAssociation[]): Relation[] {
  const out: Relation[] = []
  for (const a of assocs) {
    const from = a.originNodeURI?.identifier ?? a.originNodeURI?.uri
    const to = a.destinationNodeURI?.identifier ?? a.destinationNodeURI?.uri
    if (from === undefined || to === undefined) continue
    const isFrom = from === selectedId
    const isTo = to === selectedId
    if (!isFrom && !isTo) continue
    const otherId = isFrom ? to : from
    switch (a.associationType) {
      case 'precedes':
        out.push({ labelKey: isFrom ? 'caseRelPrecedesOut' : 'caseRelPrecedesIn', otherId })
        break
      case 'isChildOf':
      case 'isPartOf':
        out.push({ labelKey: isFrom ? 'caseRelChildOut' : 'caseRelChildIn', otherId })
        break
      case 'exactMatchOf':
      case 'isPeerOf':
        out.push({ labelKey: 'caseRelMatch', otherId })
        break
      default:
        out.push({ labelKey: 'caseRelRelated', otherId })
    }
  }
  return out
}

export function CaseViewer({
  pkg,
  report,
  semver,
  slug,
  onClose,
}: {
  pkg: CasePackage
  report: { issues: { severity: string; code: string; message: string }[] }
  semver: string
  slug: string
  onClose: () => void
}) {
  const t = useTranslations('admin.authoring')
  const locale = useLocale()
  const [selected, setSelected] = useState<string | null>(null)

  // Gom mục tiêu theo MẠCH (conceptKeywords[0]) — bản đồ chương trình giáo viên nhận ra ngay.
  const groups = useMemo(() => {
    const m = new Map<string, CaseItem[]>()
    for (const item of pkg.CFItems) {
      const strand = item.conceptKeywords?.[0] ?? t('caseUngrouped')
      const list = m.get(strand)
      if (list) list.push(item)
      else m.set(strand, [item])
    }
    return [...m.entries()]
  }, [pkg.CFItems, t])

  const byId = useMemo(() => {
    const m = new Map<string, CaseItem>()
    for (const item of pkg.CFItems) {
      m.set(item.identifier, item)
      if (item.uri) m.set(item.uri, item)
    }
    return m
  }, [pkg.CFItems])

  const selectedItem = selected !== null ? byId.get(selected) : undefined
  const relations = selectedItem ? relationsFor(selectedItem.identifier, pkg.CFAssociations) : []

  const doc = pkg.CFDocument

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <Layers className="size-4 shrink-0 text-primary" />
            {t('caseViewerTitle')}
            <Badge tone="soft" color="primary">
              {doc.version ?? semver}
            </Badge>
          </CardTitle>
          <p className="mt-1.5 text-sm text-foreground-muted">{t('caseViewerIntro', { title: doc.title })}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('caseClose')}
          className="grid size-8 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-muted"
        >
          <X className="size-4" />
        </button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Tóm tắt bằng ngôn ngữ thường + tải về */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-foreground-muted">
          <span>
            <b className="text-foreground">{pkg.CFItems.length}</b> {t('caseObjectivesLabel')}
          </span>
          <span>
            <b className="text-foreground">{groups.length}</b> {t('caseStrandsLabel')}
          </span>
          <span>
            <b className="text-foreground">{pkg.CFAssociations.length}</b> {t('caseLinksLabel')}
          </span>
          <span className="uppercase tracking-wide">{doc.language ?? 'en'}</span>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            onClick={() => downloadCasePackage(pkg, slug, semver)}
          >
            <Download className="mr-1.5 size-3.5" />
            {t('caseDownload')}
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_340px]">
          {/* TRÁI: mục tiêu gom theo mạch */}
          <div className="space-y-4">
            {groups.map(([strand, items]) => (
              <div key={strand}>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
                  <Layers className="size-3" />
                  {strand} · {items.length}
                </h4>
                <ul className="space-y-1">
                  {items.map((item) => {
                    const s = statementOf(item, locale)
                    const active = item.identifier === selected
                    return (
                      <li key={item.identifier}>
                        <button
                          type="button"
                          onClick={() => setSelected(item.identifier)}
                          className={cn(
                            'flex w-full items-baseline gap-2 rounded-md border px-2 py-1.5 text-left text-[13px] transition-colors',
                            active
                              ? 'border-primary bg-primary-soft'
                              : 'border-transparent hover:border-border hover:bg-surface-muted',
                          )}
                        >
                          {item.humanCodingScheme ? (
                            <Badge tone="outline" color="neutral" size="sm" className="shrink-0 font-mono">
                              {item.humanCodingScheme}
                            </Badge>
                          ) : null}
                          <span className="text-foreground">{s.primary}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* PHẢI: diễn giải mục tiêu đang chọn (để review) */}
          <div className="md:sticky md:top-4 md:self-start">
            {selectedItem ? (
              <ObjectiveDetail
                item={selectedItem}
                relations={relations}
                byId={byId}
                locale={locale}
                onPick={setSelected}
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-[13px] text-foreground-subtle">
                {t('caseSelectHint')}
              </div>
            )}
          </div>
        </div>

        {/* Ghi chú khi xuất (rơi rớt / mã thiếu…) — gấp gọn, ngôn ngữ thường */}
        {report.issues.length ? (
          <details className="rounded-lg border border-border bg-surface-muted/40 px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-medium text-foreground-muted">
              {t('caseNotes')} · {report.issues.length}
            </summary>
            <ul className="mt-2 space-y-1">
              {report.issues.map((iss, i) => (
                <li key={i} className="text-[12px] leading-snug text-foreground-subtle">
                  · {iss.message}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ObjectiveDetail({
  item,
  relations,
  byId,
  locale,
  onPick,
}: {
  item: CaseItem
  relations: Relation[]
  byId: Map<string, CaseItem>
  locale: string
  onPick: (id: string) => void
}) {
  const t = useTranslations('admin.authoring')
  const s = statementOf(item, locale)
  const level = levelOf(item)
  const strand = item.conceptKeywords?.[0]
  const [showTrace, setShowTrace] = useState(false)

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.humanCodingScheme ? (
          <Badge tone="solid" color="primary" className="font-mono">
            {item.humanCodingScheme}
          </Badge>
        ) : null}
        {strand ? (
          <Badge tone="soft" color="neutral">
            {strand}
          </Badge>
        ) : null}
        {level ? (
          <Badge tone="outline" color="neutral">
            {t('caseLevelLabel')} {level}
          </Badge>
        ) : null}
      </div>

      {/* Phát biểu — bản đọc trước, rồi bản gốc chuẩn để đối chiếu (giúp người duyệt soát dịch) */}
      <div>
        <p className="text-sm leading-relaxed text-foreground">{s.primary}</p>
        {s.secondary ? (
          <p className="mt-1.5 flex gap-1.5 text-[12px] leading-relaxed text-foreground-subtle">
            <Languages className="mt-[3px] size-3 shrink-0" />
            {s.secondary}
          </p>
        ) : null}
      </div>

      {/* Xem CĂN CỨ — vì sao có mục tiêu này (trích nguồn, mở đúng trang, tô đúng dòng) */}
      <div>
        <button
          type="button"
          onClick={() => setShowTrace((v) => !v)}
          aria-expanded={showTrace}
          className={cn(
            'focus-ring inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
            showTrace
              ? 'border-primary bg-primary-soft text-primary-soft-foreground'
              : 'border-primary/40 text-primary hover:bg-primary-soft',
          )}
        >
          <Search className="size-3" />
          {t('tbWhy')}
        </button>
        {showTrace ? (
          <div className="mt-2">
            <DecisionTrace
              artifact="OBJECTIVE_EXISTS"
              subject={item.identifier}
              onClose={() => setShowTrace(false)}
            />
          </div>
        ) : null}
      </div>

      {/* Quan hệ với mục tiêu khác — ngôn ngữ thường, bấm được để nhảy sang */}
      <div>
        <h5 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          <Link2 className="size-3" />
          {t('caseRelations')}
        </h5>
        {relations.length ? (
          <ul className="space-y-1">
            {relations.map((r, i) => {
              const other = byId.get(r.otherId)
              return (
                <li key={i} className="flex items-baseline gap-1.5 text-[12px]">
                  <span className="shrink-0 text-foreground-muted">{t(r.labelKey)}</span>
                  <ArrowRight className="size-3 shrink-0 self-center text-foreground-subtle" />
                  <button
                    type="button"
                    onClick={() => other && onPick(other.identifier)}
                    className="text-left text-primary hover:underline"
                  >
                    {other?.humanCodingScheme ? `${other.humanCodingScheme} · ` : ''}
                    {other ? statementOf(other, locale).primary : r.otherId}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-[12px] text-foreground-subtle">{t('caseNoRelations')}</p>
        )}
      </div>

      {/* Định danh máy — cho ai cần, để dưới cùng và mờ đi */}
      <div className="flex items-center gap-1.5 border-t border-border/60 pt-2 text-[11px] text-foreground-subtle">
        <Hash className="size-3 shrink-0" />
        <span className="truncate font-mono" title={item.uri ?? item.identifier}>
          {item.identifier}
        </span>
      </div>
    </div>
  )
}
