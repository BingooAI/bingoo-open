// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  ShieldCheck,
  ShieldX,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Spinner } from '@bingoo.ai/ui-web'
import { useObjectiveTrace, type ObjectiveTraceDto, type TraceSourceLaneDto } from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

/**
 * TRUY NGƯỢC "vì sao có mục tiêu này" — cho NGƯỜI DUYỆT (R5), không chuyên kỹ thuật.
 *
 * Chỉ BA trạng thái thật, mạnh nhất trước, KHÔNG có thang "chắc chắn":
 *   🟢 tìm thấy nguyên văn trong tài liệu bạn tải lên (bạn tự soi được bằng mắt)
 *   🔵 hệ thống VỪA kiểm lại và điều này vẫn đúng (máy tự tính, không phải AI đoán)
 *   🟡/⚪ AI tự suy luận — cần xác nhận / không lấy từ tài liệu nào
 * "Tìm thấy chuỗi" ≠ "chứng minh mục tiêu": lời xanh nói rõ nó chỉ xác nhận CÓ trong tài liệu.
 * Nếu kiểm-lại-hôm-nay khác lúc duyệt → cảnh báo "cần duyệt lại" (drift), không âm thầm đổi số.
 */

type Tone = 'success' | 'info' | 'warning' | 'danger' | 'muted'

const BG: Record<Tone, string> = {
  success: 'bg-success-soft',
  info: 'bg-info-soft',
  warning: 'bg-warning-soft',
  danger: 'bg-danger-soft',
  muted: 'bg-surface-muted',
}
const IC: Record<Tone, string> = {
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-foreground-subtle',
}

function Lane({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: Tone
  icon: typeof FileText
  title: string
  children: ReactNode
}) {
  return (
    <div className={cn('rounded-md border border-border/60 p-3', BG[tone])}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
        <Icon className={cn('size-3.5 shrink-0', IC[tone])} />
        {title}
      </div>
      <div className="mt-1 text-[12px] leading-relaxed text-foreground-muted">{children}</div>
    </div>
  )
}

// Câu trích trong ngữ cảnh, tô sáng đúng đoạn — để người duyệt tự đối chiếu bằng mắt.
function ExcerptView({ lane }: { lane: TraceSourceLaneDto }) {
  const { excerpt, charStart, charEnd, quote } = lane
  const hasSpan = charStart != null && charEnd != null && charStart < charEnd && charEnd <= excerpt.length
  const body = hasSpan ? (
    <>
      {charStart > 60 ? '…' : ''}
      {excerpt.slice(Math.max(0, charStart - 60), charStart)}
      <mark className="rounded bg-success-soft px-0.5 font-medium text-success">
        {excerpt.slice(charStart, charEnd)}
      </mark>
      {excerpt.slice(charEnd, charEnd + 60)}
      {charEnd + 60 < excerpt.length ? '…' : ''}
    </>
  ) : (
    <span className="italic">“{quote}”</span>
  )
  return (
    <div className="mt-2 rounded bg-surface p-2 text-[12px] leading-relaxed text-foreground-muted">
      {body}
    </div>
  )
}

function SourceLane({ d, t }: { d: ObjectiveTraceDto; t: (k: string) => string }) {
  if (d.source && d.source.verifiedNow) {
    return (
      <Lane tone="success" icon={FileText} title={t('tbSourceFoundTitle')}>
        {t('tbSourceFoundBody')}
        <ExcerptView lane={d.source} />
      </Lane>
    )
  }
  if (d.source && !d.source.verifiedNow) {
    return (
      <Lane tone="warning" icon={FileSearch} title={t('tbSourceUnverifiedTitle')}>
        {t('tbSourceUnverifiedBody')}
        <ExcerptView lane={d.source} />
      </Lane>
    )
  }
  return (
    <Lane tone="muted" icon={FileSearch} title={t('tbSourceNoneTitle')}>
      {t('tbSourceNoneBody')}
    </Lane>
  )
}

function StructuralLane({ s, t }: { s: ObjectiveTraceDto['structural'][number]; t: (k: string) => string }) {
  if (s.checkCode !== 'coverage:nonempty') return null
  return s.passedNow ? (
    <Lane tone="info" icon={ShieldCheck} title={t('tbStructPassTitle')}>
      {t('tbStructCoveragePass')}
    </Lane>
  ) : (
    <Lane tone="danger" icon={ShieldX} title={t('tbStructFailTitle')}>
      {t('tbStructCoverageFail')}
    </Lane>
  )
}

const VERDICT_KEY: Record<string, string> = {
  PENDING: 'tbVerdictPending',
  CONFIRMED: 'tbVerdictConfirmed',
  REJECTED: 'tbVerdictRejected',
  EDITED: 'tbVerdictEdited',
}

export function ObjectiveTrace({ slug, onClose }: { slug: string; onClose?: () => void }) {
  const t = useTranslations('admin.authoring')
  const locale = useLocale()
  const q = useObjectiveTrace(slug)

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t('tbTitle')}</h4>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('tbClose')}
            className="focus-ring shrink-0 rounded p-0.5 text-foreground-subtle hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 py-4 text-[13px] text-foreground-muted">
          <Spinner /> {t('tbLoading')}
        </div>
      ) : q.isError || !q.data ? (
        <p className="py-2 text-[13px] text-foreground-subtle">{t('tbEmpty')}</p>
      ) : (
        <>
          <p className="text-[13px] font-medium leading-relaxed text-foreground">
            {q.data.claim[locale] ?? q.data.claim.vi ?? q.data.claim.en ?? q.data.slug}
          </p>

          {q.data.drift ? (
            <div className="flex items-start gap-1.5 rounded-md bg-warning-soft p-2.5 text-[12px] text-warning">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span className="leading-relaxed">{t('tbDriftWarn')}</span>
            </div>
          ) : null}

          <SourceLane d={q.data} t={t} />
          {q.data.structural.map((s) => (
            <StructuralLane key={s.checkCode} s={s} t={t} />
          ))}

          {/* Người duyệt — quyền cao nhất (R5). KHÔNG có thang tin cậy nào ở đây. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-[12px]">
            {q.data.verdict === 'CONFIRMED' ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-success" />
            ) : q.data.verdict === 'REJECTED' ? (
              <ShieldX className="size-3.5 shrink-0 text-danger" />
            ) : (
              <Clock className="size-3.5 shrink-0 text-foreground-subtle" />
            )}
            <span className="text-foreground-muted">
              {t(VERDICT_KEY[q.data.verdict] ?? 'tbVerdictPending')}
            </span>
            {q.data.decidedAt ? (
              <span className="text-foreground-subtle">
                · {new Date(q.data.decidedAt).toLocaleDateString(locale)}
              </span>
            ) : null}
            {q.data.overridden ? (
              <span className="w-full text-foreground-subtle">{t('tbOverridden')}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
