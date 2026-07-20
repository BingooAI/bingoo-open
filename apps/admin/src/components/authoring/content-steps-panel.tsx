'use client'

import { Component, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Button, QuizShell, useToast } from '@bingoo/ui-web'
import type { QuizQuestion } from '@bingoo/core'
import { InteractiveManipulative, VI_QUIZ_LABELS, checkAnswer, defaultTheme } from '@bingoo/explainer-web'
import { Check, ChevronDown, Plus, Sparkles, Wand2, X } from 'lucide-react'
import {
  useAllPrimitives,
  useApproveItemsFor,
  useContentItems,
  useDeleteItem,
  useGenOneItem,
  usePrimitiveInfos,
  useRecommendPrimitives,
  useContentDensity,
  type ContentItemDto,
  type PrimitiveRecoDto,
  type LessonPlanResultDto,
  type LessonStepDto,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'
import { MediaAttach } from './media-attach'

/**
 * KHU SOẠN NỘI DUNG theo CONTENT STEP (từ kế hoạch kcArcs). KHÔNG batch:
 *  · danh sách step + trạng thái (chưa sinh / nháp / đã duyệt)
 *  · click step → PLAN CHI TIẾT của step trước khi sinh
 *  · sinh TỪNG item (đa ngôn ngữ, default áp chung mọi step) → LIVE PREVIEW tương tác → duyệt/từ chối/sinh lại
 */

const OFFERED_LOCALES = ['vi', 'en', 'fr', 'es', 'zh', 'ja', 'ko', 'th']
const bare = (k: string): string => k.replace(/^manip:/, '')
const isKit = (k: string): boolean => k.startsWith('manip:')
const loc = (t?: Record<string, string>): string => (t ? (t.vi ?? t.en ?? '') : '')

/**
 * Params khởi tạo cho LIVE PREVIEW kit. Kit ảnh-vật (count/tenframe/subitize…) thường bắt đầu RỖNG —
 * `params.count=0` là ĐÚNG thiết kế build-task (học sinh chạm để thêm) — nên ảnh đã gắn không hiện ở
 * trạng thái đầu, tác giả không soát được. Khi kit ĐÃ có ảnh gắn (`params.assets`), preview seed sang
 * trạng thái GIẢI (gộp `target` vào params) để hiện đủ vật kèm ẢNH. normalize của kit tự bỏ khoá lạ nên
 * gộp an toàn cho mọi kit; kit đã đầy sẵn (comparegroups/addstory) không đổi gì đáng kể.
 */
function kitPreviewParams(payload: Record<string, unknown>): unknown {
  const params = payload.params
  if (!params || typeof params !== 'object') return params
  const assets = (params as { assets?: unknown }).assets
  const hasImage = assets && typeof assets === 'object' && Object.keys(assets).length > 0
  const target = payload.target
  if (hasImage && target && typeof target === 'object')
    return { ...(params as object), ...(target as object) }
  return params
}

/** Gộp brief step (role + brief + mustCover) làm GROUNDING cho sinh content — bám đúng ý đồ step. */
function composeBrief(step: LessonStepDto, kc: string): string {
  const parts = [`ROLE: ${step.role}`, `KC: ${kc}`]
  const b = loc(step.brief) || (step.brief?.en ?? '')
  if (b) parts.push(`BRIEF: ${b}`)
  const mc = (step.mustCover ?? []).map((m) => loc(m)).filter(Boolean)
  if (mc.length) parts.push(`MUST COVER: ${mc.join('; ')}`)
  return parts.join('\n')
}

/** Chặn preview payload lỗi làm sập cả trang. */
class PreviewBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { err: boolean }> {
  override state = { err: false }
  override componentDidCatch() {
    this.setState({ err: true })
  }
  override render() {
    return this.state.err ? this.props.fallback : this.props.children
  }
}

export function ContentStepsPanel({
  courseSlug,
  lessonSlug,
  plan,
}: {
  courseSlug: string
  lessonSlug: string
  plan: LessonPlanResultDto
}) {
  const t = useTranslations('admin.authoring')
  const arcs = plan.plan.kcArcs ?? []
  const [langs, setLangs] = useState<string[]>(['vi'])
  const [open, setOpen] = useState<string | null>(null)
  const itemsQ = useContentItems(undefined, lessonSlug)
  const all = itemsQ.data ?? []

  const toggleLang = (l: string) =>
    setLangs((xs) => (xs.includes(l) ? xs.filter((x) => x !== l) : [...xs, l]))

  if (!arcs.length) return <p className="text-xs text-foreground-subtle">{t('csNoArcs')}</p>

  return (
    <div className="space-y-3">
      {/* NGÔN NGỮ — multi-select, default áp chung mọi step */}
      <div className="rounded-lg border border-border bg-surface-muted/30 p-2.5">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
          {t('csLanguages')}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {OFFERED_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => toggleLang(l)}
              className={cn(
                'rounded-md border px-2 py-0.5 text-xs',
                langs.includes(l)
                  ? 'border-primary bg-primary-soft/20 text-primary'
                  : 'border-border text-foreground-muted hover:border-foreground-subtle',
              )}
            >
              {langs.includes(l) ? '✓ ' : ''}
              {l}
            </button>
          ))}
          <span className="ml-1 self-center text-[11px] text-foreground-subtle">{t('csEnCanonical')}</span>
        </div>
      </div>

      {arcs.map((arc, ai) =>
        arc.steps.map((step, si) => {
          const key = `${arc.kc}::${step.slug}`
          const kinds = (step.primitiveKinds ?? []).length ? step.primitiveKinds! : []
          // Item thuộc ĐÚNG BƯỚC này: itemKey = `kc::stepSlug::kind::seq` → khớp bằng prefix. KHÔNG lọc
          // lỏng theo (kc+kind) nữa — đó là nguyên nhân 1 item leak ra mọi bước cùng KC (bug trùng).
          const stepPrefix = `${key}::`
          const stepItems = all.filter((it) => it.itemKey.startsWith(stepPrefix))
          const approved = stepItems.filter((i) => i.status === 'APPROVED').length
          const drafts = stepItems.filter((i) => i.status !== 'APPROVED').length

          return (
            <div key={key} className="rounded-xl border border-border bg-surface">
              {/* HÀNG STEP */}
              <button
                type="button"
                onClick={() => setOpen(open === key ? null : key)}
                className="flex w-full items-center gap-2 p-3 text-left"
              >
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-muted text-[11px] font-bold text-foreground-subtle">
                  {ai + 1}.{si + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground">{loc(step.title) || step.role}</span>{' '}
                  <span className="text-xs text-foreground-subtle">· {step.role}</span>
                </span>
                <StatusBadge approved={approved} drafts={drafts} t={t} />
                <ChevronDown
                  className={cn(
                    'size-4 text-foreground-muted transition-transform',
                    open === key && 'rotate-180',
                  )}
                />
              </button>

              {/* CHI TIẾT + SINH + ITEM */}
              {open === key ? (
                <div className="space-y-3 border-t border-border p-3">
                  <StepDetail step={step} kc={arc.kc} t={t} />
                  <GenerateControls
                    kc={arc.kc}
                    courseSlug={courseSlug}
                    lessonSlug={lessonSlug}
                    stepSlug={step.slug}
                    kinds={kinds}
                    langs={langs}
                    band={step.band}
                    brief={composeBrief(step, arc.kc)}
                    existing={stepItems}
                    t={t}
                  />
                  {stepItems.map((it) => (
                    <ItemCard key={it.itemKey} item={it} lessonSlug={lessonSlug} t={t} />
                  ))}
                </div>
              ) : null}
            </div>
          )
        }),
      )}
    </div>
  )
}

function StatusBadge({
  approved,
  drafts,
  t,
}: {
  approved: number
  drafts: number
  t: ReturnType<typeof useTranslations>
}) {
  if (approved > 0)
    return (
      <Badge color="success" tone="soft">
        {t('csApprovedN', { n: approved })}
        {drafts > 0 ? ` +${drafts}` : ''}
      </Badge>
    )
  if (drafts > 0)
    return (
      <Badge color="warning" tone="soft">
        {t('csDraftN', { n: drafts })}
      </Badge>
    )
  return (
    <Badge color="neutral" tone="soft">
      {t('csNotGenerated')}
    </Badge>
  )
}

function StepDetail({
  step,
  kc,
  t,
}: {
  step: LessonStepDto
  kc: string
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <div className="space-y-2 rounded-lg bg-surface-muted/30 p-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="soft">{t(`delivery.${step.deliveryKind}`)}</Badge>
        {step.band ? (
          <Badge tone="soft">{t.has(`band.${step.band}`) ? t(`band.${step.band}`) : step.band}</Badge>
        ) : null}
        {typeof step.durationMin === 'number' && step.durationMin > 0 ? (
          <span className="text-foreground-subtle">⏱ {t('csMinutes', { n: step.durationMin })}</span>
        ) : null}
        {typeof step.itemCount === 'number' && step.itemCount > 0 ? (
          <span className="text-foreground-subtle">{t('csItemCount', { n: step.itemCount })}</span>
        ) : null}
      </div>

      {(step.forStates ?? []).length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase text-foreground-subtle">{t('csForStates')}</span>
          {step.forStates!.map((s) => (
            <span key={s} className="rounded bg-accent-teal-soft px-1.5 py-0.5 text-[10px] text-accent-teal">
              {t.has(`learnerState.${s}`) ? t(`learnerState.${s}`) : s}
            </span>
          ))}
        </div>
      ) : null}

      {loc(step.brief) ? (
        <p className="leading-relaxed text-foreground-muted">
          <b className="text-foreground-subtle">{t('csBrief')}:</b> {loc(step.brief)}
        </p>
      ) : (
        <p className="text-warning">⚠ {t('csNoBrief')}</p>
      )}
      {(step.mustCover ?? []).length ? (
        <div>
          <span className="text-[10px] uppercase text-foreground-subtle">{t('csMustCover')}</span>
          <ul className="list-disc pl-4 text-foreground-subtle">
            {step.mustCover!.map((m, i) => (
              <li key={i}>{loc(m)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-border/50 pt-1.5 text-[10px] text-foreground-subtle">
        {t('csTrains')}: <code className="text-foreground-subtle">{kc}</code>
      </div>
    </div>
  )
}

/** Độ dày ngân hàng của KC: có X / đích Y + còn thiếu N (rich-bank policy). Ẩn nếu chưa có dữ liệu. */
function DensityBadge({
  kc,
  courseSlug,
  lessonSlug,
}: {
  kc: string
  courseSlug: string
  lessonSlug: string
}) {
  const q = useContentDensity(kc, courseSlug, lessonSlug)
  const d = q.data
  if (!d) return null
  return (
    <div className="rounded-md bg-surface-muted/40 px-2 py-1 text-[11px] text-foreground-subtle">
      Ngân hàng KC: <b className="text-foreground">{d.have}</b>/{d.targetTotal} đích ·{' '}
      <span className={d.gapTotal === 0 ? 'font-medium text-success' : 'text-foreground-muted'}>
        {d.gapTotal === 0 ? 'đủ dày' : `còn thiếu ${d.gapTotal}`}
      </span>
      {d.representations.length ? ` · biểu diễn: ${d.representations.join('/')}` : ''}
    </div>
  )
}

function GenerateControls({
  kc,
  courseSlug,
  lessonSlug,
  stepSlug,
  kinds,
  langs,
  band,
  brief,
  existing,
  t,
}: {
  kc: string
  courseSlug: string
  lessonSlug: string
  stepSlug: string
  kinds: string[]
  langs: string[]
  band?: string
  brief: string
  existing: ContentItemDto[]
  t: ReturnType<typeof useTranslations>
}) {
  const { toast } = useToast()
  const gen = useGenOneItem({ lesson: lessonSlug })
  const [picked, setPicked] = useState<string>(kinds[0] ?? '')
  const [showPreview, setShowPreview] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [recos, setRecos] = useState<PrimitiveRecoDto[]>([])
  const reco = useRecommendPrimitives()
  const kind: string = (kinds.length ? picked || kinds[0] : picked) ?? ''
  const infoKinds = kinds.length ? [...new Set([...kinds, kind])].filter(Boolean) : kind ? [kind] : []
  const infos = usePrimitiveInfos(infoKinds)
  const palette = useAllPrimitives(showPalette)
  const cur = infos.data?.find((x) => x.kind === kind) ?? palette.data?.find((x) => x.kind === kind)
  const labelFor = (k: string): string =>
    infos.data?.find((x) => x.kind === k)?.label.vi ?? palette.data?.find((x) => x.kind === k)?.label.vi ?? k
  const pick = (k: string) => {
    setPicked(k)
    setShowPreview(false)
    setShowPalette(false)
  }

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    })

  const run = (newItem: boolean) => {
    if (!kind) {
      toast({ variant: 'danger', title: t('csPickKind') })
      return
    }
    const seq = newItem ? existing.filter((i) => bare(i.primitiveKind) === bare(kind)).length : 0
    gen.mutate(
      {
        kc,
        primitiveKind: kind,
        courseSlug,
        lessonSlug,
        stepSlug,
        seq,
        brief,
        languages: langs.length ? langs : ['vi'],
        ...(band ? { band } : {}),
      },
      { onError: onErr },
    )
  }

  return (
    <div className="space-y-2">
      <DensityBadge kc={kc} courseSlug={courseSlug} lessonSlug={lessonSlug} />
      <div className="flex flex-wrap items-center gap-2">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            title={k}
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs',
              kind === k
                ? 'border-primary bg-primary-soft/20 text-primary'
                : 'border-border text-foreground-muted',
            )}
          >
            {labelFor(k)}
          </button>
        ))}
        {/* Loại đã chọn nhưng KHÔNG nằm trong gợi ý → vẫn hiện như một nút đang chọn */}
        {kind && !kinds.includes(kind) ? (
          <span className="rounded-md border border-primary bg-primary-soft/20 px-2 py-0.5 text-xs text-primary">
            {labelFor(kind)}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setShowPalette((s) => !s)}
          className="rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-foreground-subtle hover:border-foreground-subtle"
        >
          {showPalette ? t('csClosePalette') : t('csOtherKind')}
        </button>
        <Button
          size="sm"
          variant="ghost"
          loading={reco.isPending}
          onClick={() =>
            reco.mutate(
              { kc, brief, ...(band ? { band } : {}) },
              {
                onSuccess: (r) => {
                  setRecos(r)
                  if (r[0]) pick(r[0].kind)
                },
                onError: onErr,
              },
            )
          }
        >
          <Wand2 className="size-3.5" /> {t('csRecommend')}
        </Button>
        <Button size="sm" onClick={() => run(false)} loading={gen.isPending}>
          <Sparkles className="size-3.5" /> {existing.length ? t('csRegen') : t('csGenerate')}
        </Button>
        {existing.length ? (
          <Button size="sm" variant="secondary" onClick={() => run(true)} loading={gen.isPending}>
            <Plus className="size-3.5" /> {t('csGenerateNew')}
          </Button>
        ) : null}
      </div>

      {/* GỢI Ý của hệ — loại phù hợp nhất cho step này (LLM đọc brief), kèm lý do */}
      {recos.length ? (
        <div className="space-y-1.5 rounded-md border border-primary/30 bg-primary-soft/5 p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-primary">
            {t('csRecommended')}
          </div>
          {recos.map((r) => (
            <button
              key={r.kind}
              type="button"
              onClick={() => pick(r.kind)}
              className={cn(
                'block w-full rounded border px-2 py-1 text-left text-[11px]',
                kind === r.kind
                  ? 'border-primary bg-primary-soft/20'
                  : 'border-border hover:border-primary/50',
              )}
            >
              <span className="font-medium text-foreground">{r.info.label.vi}</span>{' '}
              <span className="text-[10px] text-foreground-subtle">· {t(`primFamily.${r.info.family}`)}</span>
              {r.reason ? <div className="text-foreground-muted">{r.reason}</div> : null}
            </button>
          ))}
        </div>
      ) : null}

      {/* PALETTE đầy đủ — 2 họ, nhãn VI + mô tả, để chọn loại HỢP */}
      {showPalette ? (
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-border bg-surface p-2">
          {palette.isLoading ? <p className="text-[11px] text-foreground-subtle">…</p> : null}
          {(['kit', 'quiz'] as const).map((fam) => {
            const items = (palette.data ?? []).filter((p) => p.family === fam)
            if (!items.length) return null
            return (
              <div key={fam}>
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-foreground-subtle">
                  {t(`primFamily.${fam}`)}
                </div>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {items.map((p) => (
                    <button
                      key={p.kind}
                      type="button"
                      disabled={!p.answerReady}
                      onClick={() => pick(p.kind)}
                      title={
                        p.answerReady
                          ? `${p.kind}${p.desc ? ' — ' + p.desc.vi : ''}`
                          : `${p.kind} — ${t('csNotReady')}`
                      }
                      className={cn(
                        'rounded border px-1.5 py-1 text-left text-[11px]',
                        !p.answerReady
                          ? 'cursor-not-allowed border-dashed border-border/60 text-foreground-subtle/50'
                          : kind === p.kind
                            ? 'border-primary bg-primary-soft/20 text-primary'
                            : 'border-border text-foreground-muted hover:border-foreground-subtle',
                      )}
                    >
                      {p.label.vi}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {/* HỌ + MÔ TẢ (VI) loại đang chọn — hiểu TRƯỚC khi sinh; PREVIEW nếu là vật thao tác */}
      {kind ? (
        <div className="rounded-md bg-surface-muted/40 p-2 text-[11px] leading-relaxed text-foreground-muted">
          {cur ? (
            <span className="mr-1.5 inline-block rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-foreground-subtle">
              {t(`primFamily.${cur.family}`)}
            </span>
          ) : null}
          <b className="text-foreground-subtle">{cur?.label.vi ?? kind}</b>
          {cur?.desc ? (
            <> — {cur.desc.vi || cur.desc.en}</>
          ) : (
            <span className="text-foreground-subtle"> · {t('csKindUnknown')}</span>
          )}
          {cur?.canPreview ? (
            <button
              type="button"
              onClick={() => setShowPreview((s) => !s)}
              className="ml-2 text-primary hover:underline"
            >
              {showPreview ? t('csHidePreview') : t('csPreviewKind')}
            </button>
          ) : null}
        </div>
      ) : null}
      {cur?.canPreview && showPreview ? (
        <div className="overflow-hidden rounded-md border border-border">
          <InteractiveManipulative kind={bare(kind)} theme={defaultTheme} variant="sandbox" />
        </div>
      ) : null}
    </div>
  )
}

function ItemCard({
  item,
  lessonSlug,
  t,
}: {
  item: ContentItemDto
  lessonSlug: string
  t: ReturnType<typeof useTranslations>
}) {
  const { toast } = useToast()
  const approve = useApproveItemsFor({ lesson: lessonSlug })
  const del = useDeleteItem({ lesson: lessonSlug })
  const [showSupport, setShowSupport] = useState(false)
  const payload = (item.payload ?? {}) as Record<string, unknown>
  const prompt = payload.prompt as Record<string, string> | undefined
  const support = payload.support as Record<string, Record<string, string>> | undefined
  const approved = item.status === 'APPROVED'

  return (
    <div
      className={cn(
        'rounded-lg border p-2.5',
        approved ? 'border-success/40 bg-success-soft/10' : 'border-border bg-surface',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Badge tone="soft">{item.primitiveKind}</Badge>
        <Badge color={approved ? 'success' : 'warning'} tone="soft">
          {approved ? t('csApproved') : t('csDraft')}
        </Badge>
        <div className="ml-auto flex items-center gap-1.5">
          {!approved ? (
            <Button size="sm" onClick={() => approve.mutate([item.itemKey])} loading={approve.isPending}>
              <Check className="size-3.5" /> {t('csApprove')}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              del.mutate(item.itemKey, {
                onError: (e) => toast({ variant: 'danger', title: t('failed'), description: String(e) }),
              })
            }
            loading={del.isPending}
          >
            <X className="size-3.5" /> {t('csReject')}
          </Button>
        </div>
      </div>

      {loc(prompt) ? <p className="mb-2 text-sm text-foreground">{loc(prompt)}</p> : null}

      {/* LIVE PREVIEW tương tác */}
      <div className="overflow-hidden rounded-md border border-border">
        <PreviewBoundary fallback={<p className="p-3 text-xs text-danger">{t('csPreviewError')}</p>}>
          <ItemPreview item={item} />
        </PreviewBoundary>
      </div>

      {/* THANG HỖ TRỢ 4 LEVEL */}
      {support ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowSupport((s) => !s)}
            className="text-[11px] text-foreground-subtle hover:text-foreground"
          >
            {showSupport ? '▾' : '▸'} {t('csSupport')}
          </button>
          {showSupport ? (
            <ul className="mt-1 space-y-1 text-[11px]">
              {(['hint', 'guide', 'instruction', 'teach'] as const).map((lv) =>
                loc(support[lv]) ? (
                  <li key={lv} className="text-foreground-muted">
                    <b className="text-foreground-subtle">{t(`cs_${lv}`)}:</b> {loc(support[lv])}
                  </li>
                ) : null,
              )}
            </ul>
          ) : null}
        </div>
      ) : null}

      {/* MEDIA: ảnh (chọn thư viện / sinh mới) + audio (sinh sau khi ưng text) */}
      <MediaAttach
        itemKey={item.itemKey}
        promptText={loc(prompt)}
        approved={approved}
        inv={{ lesson: lessonSlug }}
      />
    </div>
  )
}

/** Preview: kit → InteractiveManipulative (kèm nút Kiểm tra); quiz → QuizShell. */
function ItemPreview({ item }: { item: ContentItemDto }) {
  const t = useTranslations('admin.authoring')
  const [params, setParams] = useState<unknown>(null)
  const [verdict, setVerdict] = useState<boolean | null>(null)
  const payload = (item.payload ?? {}) as Record<string, unknown>

  if (isKit(item.primitiveKind)) {
    const kind = bare(item.primitiveKind)
    const target = payload.target as Record<string, unknown> | undefined
    return (
      <div className="p-2">
        <InteractiveManipulative
          kind={kind}
          theme={defaultTheme}
          variant="sandbox"
          initialParams={kitPreviewParams(payload)}
          onParams={(p) => {
            setParams(p)
            setVerdict(null)
          }}
          extra={
            <button
              type="button"
              onClick={() => setVerdict(checkAnswer(kind, params, target ?? {}))}
              className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
            >
              {t('csCheck')}
            </button>
          }
        />
        {verdict !== null ? (
          <p className={cn('mt-1 text-center text-xs font-medium', verdict ? 'text-success' : 'text-danger')}>
            {verdict ? t('csCorrect') : t('csIncorrect')}
          </p>
        ) : null}
      </div>
    )
  }

  // quiz — QuizShell nhận đúng payload là QuizQuestion
  return <QuizShell questions={[payload as unknown as QuizQuestion]} labels={VI_QUIZ_LABELS} />
}
