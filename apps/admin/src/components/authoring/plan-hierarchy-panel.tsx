// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Button, useToast } from '@bingoo.ai/ui-web'
import { Check, ChevronDown, Lock, RefreshCw } from 'lucide-react'
import {
  useApprovePlan,
  useCancelPlanJob,
  useCoursePlans,
  useGenCoursePlan,
  useGenUnitPlan,
  usePlanJob,
  type HierQualityDto,
  type PlanLevel,
  type StoredPlanDto,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'
import { PlanJobProgress } from './plan-job-progress'
import { CompetencyBreakdown } from './competency-breakdown'

/**
 * CỔNG DUYỆT PHÂN CẤP — Khoá → Unit. Chưa duyệt cấp trên thì cấp dưới KHÔNG sinh được (nút khoá).
 * Đây là thứ chống LLM bịa: kế hoạch cấp trên (đã duyệt) chảy xuống làm context cho cấp dưới.
 *
 * (Kế hoạch BÀI được sinh/duyệt trong khu biên tập từng bài — gate theo unit ở đó.)
 */
export function PlanHierarchyPanel({
  courseSlug,
  units,
}: {
  courseSlug: string
  units: { slug: string; title: Record<string, string> }[]
}) {
  const { toast } = useToast()
  const t = useTranslations('admin.authoring')
  const plans = useCoursePlans(courseSlug)
  const genCourse = useGenCoursePlan(courseSlug)
  const genUnit = useGenUnitPlan(courseSlug)
  const approve = useApprovePlan(courseSlug)

  const byKey = useMemo(() => {
    const m = new Map<string, StoredPlanDto>()
    for (const p of plans.data ?? []) m.set(`${p.level}:${p.refSlug}`, p)
    return m
  }, [plans.data])

  const course = byKey.get(`course:${courseSlug}`)
  const courseApproved = course?.status === 'APPROVED'

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: 'Thất bại',
      description: e instanceof Error ? e.message : String(e),
    })

  const doApprove = (level: PlanLevel, refSlug: string) =>
    approve.mutate(
      { level, refSlug },
      { onError: onErr, onSuccess: () => toast({ variant: 'success', title: 'Đã duyệt' }) },
    )

  return (
    <div className="space-y-3">
      {/* ── Kế hoạch KHOÁ ─────────────────────────────────────────────── */}
      <PlanRow
        title={t('planCourseTitle')}
        subtitle={t('planCourseSubtitle')}
        plan={course}
        courseSlug={courseSlug}
        level="course"
        refSlug={courseSlug}
        onGen={() => genCourse.mutate(undefined, { onError: onErr })}
        genPending={genCourse.isPending}
        onApprove={() => doApprove('course', courseSlug)}
        approvePending={approve.isPending}
        renderDoc={(d) => <CourseDoc doc={d} />}
      />

      {/* ── Kế hoạch UNIT (khoá gate) ─────────────────────────────────── */}
      <div className="space-y-2 pl-3">
        {!courseApproved ? (
          <p className="flex items-center gap-1.5 text-xs text-foreground-subtle">
            <Lock className="size-3.5" /> {t('planGateCourse')}
          </p>
        ) : null}
        {units.map((u) => {
          const p = byKey.get(`unit:${u.slug}`)
          return (
            <PlanRow
              key={u.slug}
              title={`${t('planUnitPrefix')} · ${u.title.vi ?? u.title.en ?? u.slug}`}
              subtitle={t('planUnitSubtitle')}
              plan={p}
              courseSlug={courseSlug}
              level="unit"
              refSlug={u.slug}
              locked={!courseApproved}
              onGen={() => genUnit.mutate(u.slug, { onError: onErr })}
              genPending={genUnit.isPending && genUnit.variables === u.slug}
              onApprove={() => doApprove('unit', u.slug)}
              approvePending={approve.isPending}
              renderDoc={(d) => <UnitDoc doc={d} />}
            />
          )
        })}
      </div>
    </div>
  )
}

function qualityTone(q: HierQualityDto | null | undefined): 'success' | 'warning' | 'danger' {
  if (!q) return 'danger'
  if (q.approvable) return 'success'
  return q.issues.some((i) => i.severity === 'error') ? 'danger' : 'warning'
}

function PlanRow({
  title,
  subtitle,
  plan,
  courseSlug,
  level,
  refSlug,
  locked,
  onGen,
  genPending,
  onApprove,
  approvePending,
  renderDoc,
}: {
  title: string
  subtitle: string
  plan: StoredPlanDto | undefined
  courseSlug: string
  level: PlanLevel
  refSlug: string
  locked?: boolean
  onGen: () => void
  genPending: boolean
  onApprove: () => void
  approvePending: boolean
  renderDoc: (doc: Record<string, unknown>) => React.ReactNode
}) {
  const t = useTranslations('admin.authoring')
  const [open, setOpen] = useState(false)
  const approved = plan?.status === 'APPROVED'
  const q = plan?.quality

  // Job sinh nền: poll on-mount (bắt được job đang chạy sau khi reload), cho HỦY.
  const job = usePlanJob(courseSlug, level, refSlug).data
  const cancel = useCancelPlanJob(courseSlug)
  const running = job?.state === 'running'

  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        approved ? 'border-success/40 bg-success-soft/10' : 'border-border bg-surface',
        locked && !plan && 'opacity-60',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center rounded-full text-xs',
            approved ? 'bg-success text-white' : 'bg-surface-muted text-foreground-subtle',
          )}
        >
          {approved ? <Check className="size-3.5" /> : locked ? <Lock className="size-3" /> : '•'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="truncate text-xs text-foreground-muted">{subtitle}</div>
        </div>

        {plan ? (
          <Badge color={approved ? 'success' : 'warning'} tone="soft">
            {approved ? t('planApprovedBadge') : t('planDraft')}
          </Badge>
        ) : null}
        {q ? (
          <Badge color={qualityTone(q)} tone="soft">
            {q.score}
          </Badge>
        ) : null}

        <Button
          size="sm"
          variant={plan ? 'secondary' : 'primary'}
          onClick={onGen}
          loading={genPending}
          disabled={locked || running}
        >
          {plan ? <RefreshCw className="size-3.5" /> : null}
          {plan ? t('planRegen') : t('planGen')}
        </Button>
        {plan && !approved ? (
          <Button
            size="sm"
            onClick={onApprove}
            loading={approvePending}
            disabled={!q?.approvable}
            title={!q?.approvable ? t('notApprovable') : undefined}
          >
            {t('planApproveBtn')}
          </Button>
        ) : null}
        {plan ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="text-foreground-muted hover:text-foreground"
          >
            <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
          </button>
        ) : null}
      </div>

      {q && q.issues.length && !approved ? (
        <ul className="mt-2 list-disc space-y-0.5 pl-8 text-xs">
          {q.issues.slice(0, 5).map((i, k) => (
            <li key={`${i.code}-${k}`} className={i.severity === 'error' ? 'text-danger' : 'text-warning'}>
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}

      <PlanJobProgress
        job={job}
        onCancel={() => cancel.mutate({ level, refSlug })}
        canceling={cancel.isPending}
      />

      {open && plan ? (
        <div className="mt-3 space-y-4 border-t border-border pt-3">
          {renderDoc(plan.doc)}
          <div className="border-t border-border/60 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
              {t('planCompetencyMap')}
            </div>
            <CompetencyBreakdown courseSlug={courseSlug} level={level} refSlug={refSlug} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ── Hiển thị nội dung kế hoạch (đọc lỏng, doc là JSON tự do) ───────────────────
const line = (v: unknown): string => {
  const o = (v ?? {}) as Record<string, string>
  return o.vi ?? o.en ?? ''
}
const lines = (v: unknown): string[] => (Array.isArray(v) ? v : []).map(line).filter(Boolean)

/** Một mục kế hoạch: nhãn nhỏ TRÊN, nội dung DƯỚI — có phân cấp, dễ quét. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
        {label}
      </h4>
      {children}
    </div>
  )
}

/** Danh sách gạch đầu dòng — MỖI Ý MỘT DÒNG (thay vì nối "·" thành một khối rối). */
function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="space-y-1">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground-muted">
          <span className="mt-[7px] size-1 shrink-0 rounded-full bg-primary/50" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/** Đoạn văn dài (mạch học / lý do / đánh giá) — giãn dòng cho dễ đọc. */
function Para({ text }: { text: string }) {
  if (!text) return null
  return <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground-muted">{text}</p>
}

function CourseDoc({ doc }: { doc: Record<string, unknown> }) {
  const t = useTranslations('admin.authoring')
  return (
    <div className="space-y-4">
      {line(doc.bigIdea) ? (
        <div className="rounded-lg border border-primary/25 bg-primary-soft/5 p-2.5">
          <Section label={t('planBigIdeaCourse')}>
            <Para text={line(doc.bigIdea)} />
          </Section>
        </div>
      ) : null}
      <Section label={t('planGoals')}>
        <BulletList items={lines(doc.goals)} />
      </Section>
      <Section label={t('planOutcomes')}>
        <BulletList items={lines(doc.outcomes)} />
      </Section>
      <Section label={t('planTransferGoal')}>
        <Para text={line(doc.transferGoal)} />
      </Section>
      <Section label={t('planApproach')}>
        <Para text={line(doc.approach)} />
      </Section>
      <Section label={t('planSequenceRationale')}>
        <Para text={line(doc.sequenceRationale)} />
      </Section>
      <Section label={t('planAssessmentStrategy')}>
        <Para text={line(doc.assessmentStrategy)} />
      </Section>
    </div>
  )
}

function UnitDoc({ doc }: { doc: Record<string, unknown> }) {
  const t = useTranslations('admin.authoring')
  const lessons = (Array.isArray(doc.lessons) ? doc.lessons : []) as Record<string, unknown>[]
  return (
    <div className="space-y-4">
      {line(doc.bigIdea) ? (
        <div className="rounded-lg border border-primary/25 bg-primary-soft/5 p-2.5">
          <Section label={t('planBigIdeaUnit')}>
            <Para text={line(doc.bigIdea)} />
          </Section>
        </div>
      ) : null}
      {line(doc.essentialQuestion) ? (
        <Section label={t('planEssentialQuestion')}>
          <p className="text-[13px] italic leading-relaxed text-foreground-muted">
            “{line(doc.essentialQuestion)}”
          </p>
        </Section>
      ) : null}
      <Section label={t('planArc')}>
        <Para text={line(doc.arc)} />
      </Section>
      <Section label={t('planObjectivesUnit')}>
        <BulletList items={lines(doc.objectives)} />
      </Section>
      <Section label={t('planTransferGoal')}>
        <Para text={line(doc.transferGoal)} />
      </Section>
      <Section label={t('planSuccessCriteria')}>
        <BulletList items={lines(doc.successCriteria)} />
      </Section>
      <Section label={t('planAssessmentStrategy')}>
        <Para text={line(doc.assessmentStrategy)} />
      </Section>
      {lessons.length ? (
        <Section label={`${t('planLessonSequence')} (${lessons.length})`}>
          <ol className="space-y-1.5">
            {lessons.map((l, i) => (
              <li key={i} className="flex items-baseline gap-2 text-[13px]">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-surface-muted text-[10px] font-bold text-foreground-subtle">
                  {i + 1}
                </span>
                <span>
                  <b className="text-foreground">{line(l.title)}</b>
                  {line(l.role) ? <span className="text-foreground-muted"> — {line(l.role)}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  )
}
