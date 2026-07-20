'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Progress,
  Select,
  Spinner,
  useToast,
} from '@bingoo.ai/ui-web'
import { AlertTriangle, Check, ClipboardCheck, RefreshCw } from 'lucide-react'
import {
  useApproveItems,
  useApprovePlan,
  useCancelPlanJob,
  useCourse,
  useCoursePlans,
  useGenerateContent,
  useGenLessonPlanInCourse,
  usePlanJob,
  type CoursePlanDto,
  type LessonContentDto,
  type LessonPlanDto,
  type LessonPlanResultDto,
} from '@/lib/authoring-queries'
import { PlanHierarchyPanel } from './plan-hierarchy-panel'
import { PlanJobProgress } from './plan-job-progress'
import { CompetencyBreakdown } from './competency-breakdown'
import { ContentStepsPanel } from './content-steps-panel'
import { GenerateSection } from './generate-section'
import { cn } from '@/lib/cn'

type Lesson = CoursePlanDto['units'][number]['lessons'][number]

/** Chặng của một bài trong dây chuyền soạn — trạng thái này lái cả điều hướng lẫn tiến độ. */
type Stage = 'unmapped' | 'todo' | 'plan' | 'content' | 'approved'

const STAGE: Record<
  Stage,
  { label: string; badge: 'neutral' | 'warning' | 'teal' | 'primary' | 'success'; dot: string }
> = {
  unmapped: { label: 'Chưa map KC', badge: 'warning', dot: 'bg-warning' },
  todo: { label: 'Chưa soạn', badge: 'neutral', dot: 'bg-border-strong' },
  plan: { label: 'Có giáo án', badge: 'teal', dot: 'bg-accent-teal' },
  content: { label: 'Có nội dung', badge: 'primary', dot: 'bg-primary' },
  approved: { label: 'Đã duyệt', badge: 'success', dot: 'bg-success' },
}

const localized = (t: Record<string, string>, fallback: string): string => t.vi ?? t.en ?? fallback

// Màu cho delivery kind (không phải i18n) — nhãn chữ lấy từ catalog `delivery.*`.
const DELIVERY_COLOR: Record<string, 'primary' | 'teal' | 'sunbeam' | 'coral' | 'neutral'> = {
  explainer: 'primary',
  content: 'teal',
  practice: 'sunbeam',
  assessment: 'coral',
  reflection: 'neutral',
}

/** Bảng soạn khoá — điều hướng bài (trái) + khu biên tập bài đang chọn (phải). */
export function CourseWorkbench({ slug }: { slug: string }) {
  const t = useTranslations('admin.authoring')
  const { toast } = useToast()
  const { data, isLoading, isError } = useCourse(slug)

  // Kết quả sinh giữ theo TỪNG bài (đổi bài không mất việc đang làm trong phiên).
  const [bundles, setBundles] = useState<Record<string, LessonContentDto>>({})
  const [levels, setLevels] = useState<Record<string, string>>({})
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const genPlan = useGenLessonPlanInCourse(slug)
  const genContent = useGenerateContent()
  const approve = useApproveItems()
  const approvePlan = useApprovePlan(slug)
  const coursePlans = useCoursePlans(slug)

  // Kế hoạch BÀI = SỰ THẬT SERVER (cây kế hoạch). Sinh giờ CHẠY NỀN (job) nên plan về qua danh sách
  // kế hoạch, không qua response mutation → đọc từ đây cho nhất quán + reload-safe. `doc` chính là
  // plan; `quality` trùng shape {issues,score,approvable}.
  const lessonPlans = useMemo<Record<string, LessonPlanResultDto>>(() => {
    const out: Record<string, LessonPlanResultDto> = {}
    for (const p of coursePlans.data ?? []) {
      if (p.level !== 'lesson' || !p.doc) continue
      // quality LUÔN là object hợp lệ để UI không bao giờ đọc trúng undefined (plan cũ/khuyết vẫn hiện).
      out[p.refSlug] = {
        plan: p.doc as unknown as LessonPlanDto,
        quality: p.quality ?? { issues: [], score: 0, approvable: false },
      }
    }
    return out
  }, [coursePlans.data])

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    })

  /** Kế hoạch BÀI đã DUYỆT chưa (từ cây kế hoạch server) — cổng để sinh nội dung. */
  const planApproved = (lessonSlug: string): boolean =>
    (coursePlans.data ?? []).some(
      (p) => p.level === 'lesson' && p.refSlug === lessonSlug && p.status === 'APPROVED',
    )

  const allLessons = useMemo(() => data?.plan.units.flatMap((u) => u.lessons) ?? [], [data])

  const stageOf = (l: Lesson): Stage => {
    if (l.teaches.length === 0) return 'unmapped'
    if (approved.has(l.slug)) return 'approved'
    if (bundles[l.slug]) return 'content'
    if (lessonPlans[l.slug]) return 'plan'
    return 'todo'
  }

  // Bài đầu tiên map được KC làm mặc định chọn.
  const active = selected ?? allLessons.find((l) => l.teaches.length > 0)?.slug ?? allLessons[0]?.slug ?? null
  const activeLesson = allLessons.find((l) => l.slug === active) ?? null

  if (isLoading)
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  if (isError || !data) return <EmptyState title={t('failed')} />

  const mapped = allLessons.filter((l) => l.teaches.length > 0)
  const doneCount = allLessons.filter((l) => approved.has(l.slug)).length
  const counts = allLessons.reduce<Record<Stage, number>>(
    (acc, l) => {
      acc[stageOf(l)]++
      return acc
    },
    { unmapped: 0, todo: 0, plan: 0, content: 0, approved: 0 },
  )

  // ── hành động của bài đang chọn ────────────────────────────────────────────
  // Sinh kế hoạch bài qua đường IN-COURSE: gate unit đã duyệt + grounding context khoá+unit + LƯU.
  const doPlan = (l: Lesson) =>
    // Trả job ngay (202); plan về qua cây kế hoạch khi job xong (poll trong LessonEditor).
    genPlan.mutate({ lessonSlug: l.slug, level: levels[l.slug] ?? 'L2' }, { onError: onErr })

  const doApprovePlan = (l: Lesson) =>
    approvePlan.mutate(
      { level: 'lesson', refSlug: l.slug },
      {
        onError: onErr,
        onSuccess: () => toast({ variant: 'success', title: 'Đã duyệt kế hoạch bài' }),
      },
    )

  const doContent = (l: Lesson) => {
    const plan = lessonPlans[l.slug]
    if (!plan) return // nội dung phải bám giáo án (chặn ở nút)
    genContent.mutate(
      {
        lesson: { teaches: plan.plan.teaches, knowledgePoints: plan.plan.knowledgePoints },
        level: levels[l.slug] ?? 'L2',
      },
      { onSuccess: (r) => setBundles((b) => ({ ...b, [l.slug]: r })), onError: onErr },
    )
  }

  const doApprove = (l: Lesson) => {
    const bundle = bundles[l.slug]
    if (!bundle) return
    const keys = [...bundle.teaching, ...bundle.review, ...bundle.assessment.items].map((i) => i.itemKey)
    if (!keys.length) return
    approve.mutate(keys, {
      onSuccess: (r) => {
        setApproved((s) => new Set(s).add(l.slug))
        toast({ variant: 'success', title: t('approvedN', { n: r.approved }) })
      },
      onError: onErr,
    })
  }

  return (
    <div className="space-y-4">
      {/* ── Đầu trang: tiêu đề + tiến độ ───────────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                {localized(data.plan.title, data.slug)}
              </h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge color={data.status === 'PUBLISHED' ? 'success' : 'warning'}>{data.status}</Badge>
                <span className="text-sm text-foreground-muted">
                  {data.plan.units.length} {t('units')} · {allLessons.length} {t('lessons')} ·{' '}
                  {data.plan.objectives.length} {t('objectives')}
                </span>
              </div>
            </div>
            <div className="min-w-[200px] flex-1 sm:max-w-xs">
              <div className="mb-1 flex justify-between text-xs text-foreground-muted">
                <span>Đã duyệt</span>
                <span className="font-semibold text-foreground">
                  {doneCount}/{mapped.length}
                </span>
              </div>
              <Progress
                value={doneCount}
                max={Math.max(mapped.length, 1)}
                color="success"
                label="Tiến độ duyệt"
              />
            </div>
          </div>

          {/* dải trạng thái */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(STAGE) as Stage[])
              .filter((s) => counts[s] > 0)
              .map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs text-foreground-muted"
                >
                  <span className={cn('size-2 rounded-full', STAGE[s].dot)} />
                  {STAGE[s].label}: <b className="text-foreground">{counts[s]}</b>
                </span>
              ))}
          </div>

          <p className="text-sm text-foreground-muted">
            Chọn một bài bên trái để soạn: <b>giáo án</b> → <b>nội dung</b> → <b>duyệt</b>. Làm dần từng bài.
          </p>
        </CardContent>
      </Card>

      {/* ── KẾ HOẠCH PHÂN CẤP — duyệt Khoá → Unit trước khi soạn bài (chống LLM bịa) ── */}
      <GenerateSection
        title="Kế hoạch khoá & unit"
        hint="Duyệt kế hoạch khoá → unit để bài có context tổng thể. Chưa duyệt thì bài chưa sinh được kế hoạch."
        defaultOpen
      >
        <PlanHierarchyPanel
          courseSlug={slug}
          units={data.plan.units.map((u) => ({ slug: u.slug, title: u.title }))}
        />
      </GenerateSection>

      {data.plan.units.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
          {/* ── ĐIỀU HƯỚNG bài ──────────────────────────────────────────── */}
          <Card className="lg:sticky lg:top-4 lg:self-start">
            <CardContent className="max-h-[75vh] space-y-4 overflow-y-auto p-3">
              {data.plan.units.map((u) => (
                <div key={u.slug}>
                  <div className="px-1.5 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                    {localized(u.title, u.slug)}
                  </div>
                  <ul className="space-y-0.5">
                    {u.lessons.map((l) => {
                      const st = stageOf(l)
                      const on = l.slug === active
                      return (
                        <li key={l.slug}>
                          <button
                            type="button"
                            onClick={() => setSelected(l.slug)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                              on
                                ? 'bg-primary-soft text-foreground'
                                : 'text-foreground-muted hover:bg-surface-muted',
                            )}
                          >
                            <span className={cn('size-2 shrink-0 rounded-full', STAGE[st].dot)} />
                            <span className={cn('flex-1 truncate', on && 'font-semibold')}>
                              {localized(l.title, l.slug)}
                            </span>
                            {st === 'approved' ? <Check className="size-3.5 shrink-0 text-success" /> : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* ── KHU BIÊN TẬP bài đang chọn ──────────────────────────────── */}
          <div className="min-w-0">
            {activeLesson ? (
              <LessonEditor
                lesson={activeLesson}
                stage={stageOf(activeLesson)}
                plan={lessonPlans[activeLesson.slug] ?? null}
                bundle={bundles[activeLesson.slug] ?? null}
                level={levels[activeLesson.slug] ?? 'L2'}
                courseSlug={slug}
                onLevel={(v) => setLevels((m) => ({ ...m, [activeLesson.slug]: v }))}
                planning={genPlan.isPending && genPlan.variables?.lessonSlug === activeLesson.slug}
                generating={genContent.isPending}
                approving={approve.isPending}
                planApproved={planApproved(activeLesson.slug)}
                approvingPlan={approvePlan.isPending}
                onPlan={() => doPlan(activeLesson)}
                onApprovePlan={() => doApprovePlan(activeLesson)}
                onContent={() => doContent(activeLesson)}
                onApprove={() => doApprove(activeLesson)}
              />
            ) : (
              <EmptyState title="Chọn một bài để bắt đầu" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function StepCard({
  n,
  title,
  active,
  done,
  children,
}: {
  n: number
  title: string
  active: boolean
  done: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-4',
        done
          ? 'border-success/40 bg-success-soft/10'
          : active
            ? 'border-border bg-surface'
            : 'border-border/60 bg-surface-muted/30',
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            'grid size-6 place-items-center rounded-full text-xs font-bold',
            done
              ? 'bg-success text-white'
              : active
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-muted text-foreground-subtle',
          )}
        >
          {done ? <Check className="size-3.5" /> : n}
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className={cn(!active && !done && 'opacity-55')}>{children}</div>
    </div>
  )
}

function Chip({
  children,
  color = 'neutral',
}: {
  children: React.ReactNode
  color?: 'neutral' | 'primary' | 'teal' | 'coral'
}) {
  return (
    <Badge color={color} tone="soft">
      {children}
    </Badge>
  )
}

function LessonEditor({
  lesson,
  stage,
  plan,
  bundle,
  level,
  courseSlug,
  onLevel,
  planning,
  generating,
  approving,
  planApproved,
  approvingPlan,
  onPlan,
  onApprovePlan,
  onContent,
  onApprove,
}: {
  lesson: Lesson
  stage: Stage
  plan: LessonPlanResultDto | null
  bundle: LessonContentDto | null
  level: string
  courseSlug: string
  onLevel: (v: string) => void
  planning: boolean
  generating: boolean
  approving: boolean
  planApproved: boolean
  approvingPlan: boolean
  onPlan: () => void
  onApprovePlan: () => void
  onContent: () => void
  onApprove: () => void
}) {
  const t = useTranslations('admin.authoring')
  // Enum → nhãn qua catalog; value lạ chưa có key thì hiện raw (không nổ).
  const enumLabel = (key: string, raw: string): string => (t.has(key) ? t(key) : raw)
  const unmapped = lesson.teaches.length === 0

  // Job SINH GIÁO ÁN chạy nền: poll on-mount (bắt job đang chạy sau reload), cho HỦY.
  const planJob = usePlanJob(courseSlug, 'lesson', lesson.slug).data
  const cancelPlan = useCancelPlanJob(courseSlug)
  const planRunning = planJob?.state === 'running'

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        {/* tiêu đề bài + KC */}
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{localized(lesson.title, lesson.slug)}</h2>
            <Badge color={STAGE[stage].badge} tone="soft">
              {STAGE[stage].label}
            </Badge>
          </div>
          <code className="text-xs text-foreground-subtle">{lesson.slug}</code>
          {unmapped ? null : (
            <div className="mt-2 flex flex-wrap gap-1">
              {lesson.teaches.map((k) => (
                <Chip key={k} color="teal">
                  {k}
                </Chip>
              ))}
            </div>
          )}
        </div>

        {/* BẢN ĐỒ NĂNG LỰC bài — KC theo loại + mục tiêu + tiên quyết (từ graph, không author). */}
        {unmapped ? null : (
          <div className="rounded-xl border border-border bg-surface-muted/20 p-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
              {t('bdMapTitle')}
            </div>
            <CompetencyBreakdown courseSlug={courseSlug} level="lesson" refSlug={lesson.slug} />
          </div>
        )}

        {unmapped ? (
          <div className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft/15 p-4">
            <AlertTriangle className="size-5 shrink-0 text-warning" />
            <div className="text-sm">
              <div className="font-semibold text-foreground">Bài này chưa neo vào KC nào</div>
              <p className="mt-1 text-foreground-muted">
                Giữ đúng vị trí trong sách (thường là ôn tập/kiểm tra, hoặc kiến thức ngoài stage). Muốn soạn
                được giáo án, hãy <b>đối chiếu bổ sung KC</b> hoặc <b>chọn lại stage</b> khi sinh vỏ khoá.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* B1 — GIÁO ÁN */}
            <StepCard n={1} title="Giáo án + cấu trúc bài" active={!plan} done={!!plan}>
              <div className="flex flex-wrap items-center gap-2">
                {/* TRÌNH ĐỘ — chọn TRƯỚC khi sinh; giáo án bám mức này (mặc định L2). */}
                <label className="flex items-center gap-1.5 text-xs text-foreground-muted">
                  {t('level')}
                  <Select
                    className="h-9 w-24 rounded-xl pl-3 pr-9 text-xs"
                    value={level}
                    onChange={(e) => onLevel(e.target.value)}
                    disabled={planning || planRunning}
                  >
                    <option value="L1">L1</option>
                    <option value="L2">L2</option>
                    <option value="L3">L3</option>
                  </Select>
                </label>
                <Button size="sm" onClick={onPlan} loading={planning} disabled={planRunning}>
                  {plan ? <RefreshCw className="size-3.5" /> : null}
                  {plan ? t('regen') : t('genPlan')}
                </Button>
                {plan ? (
                  <>
                    <Badge color={plan.quality.approvable ? 'success' : 'warning'} tone="soft">
                      {t('planScore')}: {plan.quality.score}
                    </Badge>
                    <Chip>
                      {plan.plan.knowledgePoints.length} {t('kps')}
                    </Chip>
                    {/* DUYỆT kế hoạch bài — chưa duyệt thì không sinh được nội dung (cổng). */}
                    {planApproved ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <Check className="size-3.5" /> Kế hoạch đã duyệt
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={onApprovePlan}
                        loading={approvingPlan}
                        disabled={!plan.quality.approvable}
                        title={!plan.quality.approvable ? 'Chất lượng chưa đạt — sửa/sinh lại' : undefined}
                      >
                        Duyệt kế hoạch
                      </Button>
                    )}
                  </>
                ) : null}
              </div>

              <PlanJobProgress
                job={planJob}
                onCancel={() => cancelPlan.mutate({ level: 'lesson', refSlug: lesson.slug })}
                canceling={cancelPlan.isPending}
              />

              {/* CẤU TRÚC BÀI — MỖI KC MỘT CHUỖI riêng (không gộp). Đây là thứ biến "đống item" thành bài học. */}
              {plan && plan.plan.kcArcs?.length ? (
                <div className="mt-3 space-y-3">
                  <div className="text-xs font-semibold text-foreground-subtle">
                    Cấu trúc bài · {plan.plan.kcArcs.length} KC ·{' '}
                    {plan.plan.kcArcs.reduce((n, a) => n + a.steps.reduce((m, s) => m + s.durationMin, 0), 0)}{' '}
                    phút
                  </div>
                  {plan.plan.kcArcs.map((arc, ai) => (
                    <div key={arc.kc} className="rounded-lg border border-border bg-surface p-2.5">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="grid size-5 shrink-0 place-items-center rounded-full bg-accent-teal-soft text-[10px] font-bold text-accent-teal">
                          {ai + 1}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {arc.title?.vi ?? arc.title?.en ?? arc.kc}
                        </span>
                        <code className="text-[10px] text-foreground-subtle">{arc.kc}</code>
                        <span className="ml-auto text-[11px] text-foreground-muted">
                          {arc.steps.reduce((m, s) => m + s.durationMin, 0)}′
                        </span>
                      </div>
                      <ol className="space-y-1.5 pl-1">
                        {arc.steps.map((s, i) => (
                          <li key={s.slug} className="text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-4 shrink-0 text-right text-[10px] text-foreground-subtle">
                                {i + 1}.
                              </span>
                              <span className="font-medium text-foreground">
                                {s.title.vi ?? s.title.en ?? s.role}
                              </span>
                              <Badge color={DELIVERY_COLOR[s.deliveryKind]} tone="soft">
                                {enumLabel(`delivery.${s.deliveryKind}`, s.deliveryKind)}
                              </Badge>
                              <span className="text-[11px] text-foreground-subtle">{s.role}</span>
                              <span className="ml-auto text-[11px] text-foreground-muted">
                                {s.durationMin}′
                              </span>
                            </div>
                            {/* Nhánh theo trạng thái người học (đa nhánh → nền adaptive). */}
                            {s.forStates && s.forStates.length ? (
                              <div className="ml-6 mt-0.5 flex flex-wrap gap-1">
                                {s.forStates.map((st) => (
                                  <span
                                    key={st}
                                    className="rounded bg-accent-teal-soft px-1.5 py-0.5 text-[10px] text-accent-teal"
                                  >
                                    {enumLabel(`learnerState.${st}`, st)}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                            {/* BRIEF nội dung cụ thể — thứ chống sinh chung chung. */}
                            {s.brief && (s.brief.vi ?? s.brief.en) ? (
                              <p className="ml-6 mt-0.5 text-[11px] italic text-foreground-muted">
                                {s.brief.vi ?? s.brief.en}
                              </p>
                            ) : (
                              <p className="ml-6 mt-0.5 text-[11px] text-warning">
                                ⚠ thiếu brief — nội dung sẽ chung chung
                              </p>
                            )}
                            {/* mustCover — điểm/nhiệm vụ CỤ THỂ nội dung phải có (để soát). */}
                            {s.mustCover && s.mustCover.length ? (
                              <ul className="ml-6 mt-0.5 list-disc pl-3 text-[10px] text-foreground-subtle">
                                {s.mustCover.slice(0, 4).map((m, mi) => (
                                  <li key={mi}>{m.vi ?? m.en}</li>
                                ))}
                              </ul>
                            ) : null}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : null}

              {plan && plan.plan.knowledgePoints.length ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-foreground-muted">
                    {plan.plan.knowledgePoints.length} điểm kiến thức
                  </summary>
                  <ul className="mt-1.5 space-y-2">
                    {plan.plan.knowledgePoints.map((kp) => (
                      <li key={kp.slug} className="text-xs">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-foreground">{kp.slug}</span>
                          {kp.targets.map((tg) => (
                            <span
                              key={tg}
                              className="rounded bg-surface-muted px-1.5 py-0.5 text-foreground-muted"
                            >
                              {tg}
                            </span>
                          ))}
                        </div>
                        {/* HIỂU-SAI — mồi distractor + thứ để soát pedagogy. Thiếu là distractor sẽ bừa. */}
                        {kp.misconceptions && kp.misconceptions.length ? (
                          <ul className="ml-3 mt-0.5 list-disc pl-3 text-[11px] text-danger">
                            {kp.misconceptions.map((m) => (
                              <li key={m.id}>
                                <span className="text-foreground-subtle">
                                  [{enumLabel(`bdMiscType.${m.type}`, m.type)}]
                                </span>{' '}
                                {m.wrong.vi ?? m.wrong.en}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ml-3 mt-0.5 text-[11px] text-warning">
                            ⚠ chưa có hiểu-sai — distractor sẽ bừa
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
              {plan && plan.quality.issues.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-warning">
                  {plan.quality.issues.slice(0, 4).map((i, k) => (
                    <li key={`${i.code}-${k}`}>{i.message}</li>
                  ))}
                </ul>
              ) : null}
            </StepCard>

            {/* B2 — NỘI DUNG */}
            <StepCard n={2} title={t('csContentTitle')} active={!!plan} done={false}>
              {!plan ? (
                <span className="text-xs text-foreground-subtle">{t('planFirst')}</span>
              ) : !planApproved ? (
                <span className="text-xs text-warning">{t('csApprovePlanFirst')}</span>
              ) : (
                <>
                  {/* SINH CẢ BÀI — đổ `bundle` để B3 duyệt hàng loạt; panel dưới sinh/duyệt TỪNG item. */}
                  <div className="mb-3">
                    <Button size="sm" onClick={onContent} loading={generating}>
                      {bundle ? <RefreshCw className="size-3.5" /> : null}
                      {bundle ? t('regen') : t('genContent')}
                    </Button>
                  </div>
                  <ContentStepsPanel courseSlug={courseSlug} lessonSlug={lesson.slug} plan={plan} />
                </>
              )}
            </StepCard>

            {/* B3 — DUYỆT */}
            <StepCard
              n={3}
              title="Duyệt vào ngân hàng"
              active={!!bundle && stage !== 'approved'}
              done={stage === 'approved'}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={onApprove}
                  loading={approving}
                  disabled={!bundle || !bundle.assessment.approvable || stage === 'approved'}
                  title={!bundle ? 'Sinh nội dung trước' : undefined}
                >
                  <ClipboardCheck className="size-3.5" />
                  {stage === 'approved'
                    ? t('approved')
                    : bundle && !bundle.assessment.approvable
                      ? t('notApprovable')
                      : t('approve')}
                </Button>
                {stage === 'approved' ? (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check className="size-3.5" /> Item đã vào ngân hàng — engine kéo được
                  </span>
                ) : null}
              </div>
              {bundle && !bundle.assessment.approvable && bundle.assessment.issues.length ? (
                <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-danger">
                  {bundle.assessment.issues.slice(0, 5).map((i, k) => (
                    <li key={`${i.code}-${k}`}>{i.message}</li>
                  ))}
                </ul>
              ) : null}
            </StepCard>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
