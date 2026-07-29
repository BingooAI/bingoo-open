// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { BookOpen, HelpCircle, Layers, Target } from 'lucide-react'
import { Spinner } from '@bingoo.ai/ui-web'
import { usePlanGrounding } from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'
import { DecisionTrace } from './decision-trace'

/**
 * VÌ SAO BÀI NÀY Ở ĐÂY — nối ngược từ bài về mục tiêu và về sách.
 *
 * Không đúc thêm loại thẻ nào: ba mảnh đã có vết riêng, chỗ này chỉ đi lại con đường giữa chúng. Bài
 * dạy kiến thức nào → kiến thức ấy chứng nhận mục tiêu nào → bài đến từ đâu trong sách.
 *
 * Chỗ nào chưa có căn cứ thì NÓI RA. Một mục tiêu chưa có thẻ nào không được phép trông giống một
 * mục tiêu đã kiểm — đó đúng là thứ mà cả phần này tồn tại để phân biệt.
 */
export function PlanGrounding({ courseSlug, lessonSlug }: { courseSlug: string; lessonSlug: string }) {
  const t = useTranslations('admin.authoring')
  const q = usePlanGrounding(courseSlug, lessonSlug)
  const [open, setOpen] = useState<{ artifact: 'CONCEPT_EXISTS' | 'OBJECTIVE_EXISTS'; slug: string } | null>(
    null,
  )

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-[13px] text-foreground-muted">
        <Spinner /> {t('tbLoading')}
      </div>
    )
  }
  if (q.isError || !q.data) return null
  const g = q.data

  const row = (key: string, label: string, sub: string | null, hasTrace: boolean, onWhy: () => void) => (
    <li key={key} className="flex items-start gap-2 rounded-md bg-surface-muted px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-foreground">{label}</div>
        {sub ? <div className="text-[11px] text-foreground-subtle">{sub}</div> : null}
      </div>
      {hasTrace ? (
        <button
          type="button"
          onClick={onWhy}
          aria-label={t('tbWhy')}
          className="focus-ring shrink-0 rounded p-0.5 text-foreground-subtle hover:text-primary"
        >
          <HelpCircle className="size-3.5" />
        </button>
      ) : (
        <span className="shrink-0 text-[11px] text-foreground-subtle">{t('pgNoTrace')}</span>
      )}
    </li>
  )

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <h4 className="text-sm font-semibold text-foreground">{t('pgTitle')}</h4>

      {/* Cổng ngữ cảnh — kế hoạch bài được sinh dựa trên kế hoạch khoá và chương ĐÃ DUYỆT. */}
      <p
        className={cn(
          'text-[12px]',
          g.courseePlanApproved && g.unitPlanApproved ? 'text-foreground-muted' : 'text-warning',
        )}
      >
        {g.courseePlanApproved && g.unitPlanApproved ? t('pgContextOk') : t('pgContextMissing')}
      </p>

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          <Layers className="size-3" />
          {t('pgTeaches')}
        </div>
        {g.concepts.length ? (
          <ul className="space-y-1">
            {g.concepts.map((c) =>
              row(c.slug, (c.title?.vi ?? c.title?.en ?? c.slug) as string, null, c.hasTrace, () =>
                setOpen({ artifact: 'CONCEPT_EXISTS', slug: c.slug }),
              ),
            )}
          </ul>
        ) : (
          <p className="text-[12px] text-warning">{t('pgNoConcepts')}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          <Target className="size-3" />
          {t('pgServes')}
        </div>
        {g.objectives.length ? (
          <ul className="space-y-1">
            {g.objectives.map((o) =>
              row(
                o.slug,
                `${o.code ? `${o.code} · ` : ''}${(o.title?.vi ?? o.title?.en ?? o.slug) as string}`,
                o.frameworkSlug,
                o.hasTrace,
                () => setOpen({ artifact: 'OBJECTIVE_EXISTS', slug: o.slug }),
              ),
            )}
          </ul>
        ) : (
          // Một bài không truy ngược tới mục tiêu nào là chuyện có thật, và người duyệt phải biết.
          <p className="text-[12px] text-warning">{t('pgNoObjectives')}</p>
        )}
      </div>

      {g.fromBook.length > 0 ? (
        <div className="flex items-center gap-1.5 text-[12px] text-foreground-muted">
          <BookOpen className="size-3.5 shrink-0 text-foreground-subtle" />
          {t('pgFromBook', { n: g.fromBook.length })}
        </div>
      ) : null}

      {open ? (
        <DecisionTrace artifact={open.artifact} subject={open.slug} onClose={() => setOpen(null)} />
      ) : null}
    </div>
  )
}
