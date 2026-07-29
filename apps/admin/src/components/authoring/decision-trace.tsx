// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Cpu,
  FileSearch,
  FileText,
  ShieldCheck,
  ShieldX,
  Sparkles,
  TriangleAlert,
  X,
} from 'lucide-react'
import { Spinner } from '@bingoo.ai/ui-web'
import {
  useDecisionTraces,
  type DecisionTraceDto,
  type RectDto,
  type TraceArtifactDto,
  type TraceSourceLaneDto,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

// pdf.js chỉ chạy client (DOMMatrix/canvas) + lazy để không vào bundle chính.
const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })

/**
 * TẤM THẺ CĂN CỨ — một cái, dùng cho cả bốn câu hỏi.
 *
 * Trước file này chỉ mục tiêu mới có thẻ. Ba loại còn lại vẫn được ghi đủ mỗi lần duyệt rồi nằm im
 * trong cơ sở dữ liệu: vì sao kiến thức này có mặt, vì sao học cái này trước cái kia, vì sao mục
 * tiêu cần đúng những mảnh đó. Ghi mà không đọc thì bằng không ghi, chỉ tốn thêm chỗ.
 *
 * Vẫn đúng BA trạng thái thật, mạnh nhất trước, KHÔNG có thang phần trăm:
 *   🟢 tìm thấy nguyên văn trong tài liệu bạn tải lên — bạn tự soi được bằng mắt
 *   🔵 hệ thống tự đối chiếu ra, không phải AI đoán
 *   🟡/⚪ AI suy luận, cần xác nhận — hoặc không lấy từ tài liệu nào
 *
 * "Tìm thấy chuỗi" KHÔNG phải "chứng minh". Kiểm-lại-hôm-nay khác lúc duyệt thì báo cần duyệt lại,
 * không âm thầm thay số cũ bằng số mới.
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

interface ViewerTarget {
  documentId: string
  page: number
  rects: RectDto[]
}

type TFn = (key: string, values?: Record<string, string | number>) => string

/** Nhan đề theo loại — cùng một tấm thẻ, khác câu hỏi nó trả lời. */
const TITLE_KEY: Record<TraceArtifactDto, string> = {
  OBJECTIVE_EXISTS: 'tbTitle',
  CONCEPT_EXISTS: 'tbTitleConcept',
  PREREQ_EDGE: 'tbTitlePrereq',
  OBJECTIVE_COVERAGE: 'tbTitleCoverage',
  CONCEPT_IDENTITY: 'tbTitleIdentity',
  LESSON_MAPPING: 'tbTitleLesson',
  KC_PROPOSED: 'tbTitleProposed',
}

/**
 * Lời cho từng mã tự kiểm.
 *
 * Bản cũ chỉ nhận ra MỘT mã và lặng lẽ bỏ qua năm mã còn lại. Bỏ qua thì người duyệt không biết
 * mình đang không được xem gì — nên mã lạ vẫn hiện, kèm câu nói thẳng là chưa có lời giải thích.
 */
const CHECK_KEY: Record<string, { pass: string; fail: string; failTone: Tone }> = {
  'coverage:nonempty': {
    pass: 'tbStructCoveragePass',
    fail: 'tbStructCoverageFail',
    failTone: 'danger',
  },
  'facets:discriminating': {
    pass: 'tbStructIdentityPass',
    fail: 'tbStructIdentityFail',
    failTone: 'danger',
  },
  // "Máy không chứng được thứ tự" KHÔNG phải một lỗi — phần lớn thứ tự trong dạy học là phán đoán
  // sư phạm và sẽ mãi là phán đoán. Tô đỏ chỗ này là biến việc bình thường thành báo động, rồi
  // người duyệt quen mắt với màu đỏ và bỏ qua cả những chỗ đỏ thật.
  'scope:subset': { pass: 'tbStructOrderProven', fail: 'tbStructOrderJudgment', failTone: 'warning' },
  'order:judgment': { pass: 'tbStructOrderProven', fail: 'tbStructOrderJudgment', failTone: 'warning' },
  // Ngược chiều thì khác hẳn: cấu trúc NÓI NGƯỢC lại điều đang khai, và đó là đỏ thật.
  'scope:superset': { pass: 'tbStructOrderProven', fail: 'tbStructOrderReversed', failTone: 'danger' },
  'coverage:required-all': {
    pass: 'tbStructRequiredAll',
    fail: 'tbStructRequiredMissing',
    failTone: 'danger',
  },
  // Tài liệu xếp ngược hẳn với thứ tự đang khai — yếu, nhưng đáng nhìn lại, nên vàng chứ không đỏ.
  'order:reading': { pass: 'tbStructReadingPass', fail: 'tbStructReadingFail', failTone: 'warning' },
}

const VERDICT_KEY: Record<string, string> = {
  PENDING: 'tbVerdictPending',
  CONFIRMED: 'tbVerdictConfirmed',
  REJECTED: 'tbVerdictRejected',
  EDITED: 'tbVerdictEdited',
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

function SourceLane({
  d,
  t,
  onOpenViewer,
}: {
  d: DecisionTraceDto
  t: TFn
  onOpenViewer: (v: ViewerTarget) => void
}) {
  const src = d.source
  if (src && src.verifiedNow) {
    const loc = src.locator
    const docId = src.documentId
    return (
      <Lane tone="success" icon={FileText} title={t('tbSourceFoundTitle')}>
        {t('tbSourceFoundBody')}
        <ExcerptView lane={src} />
        {/* Nguồn dạng chữ thì không có nút: vệt tô ở trên đã chỉ đúng chỗ rồi, không có trang nào để mở. */}
        {loc?.kind === 'pdf' && docId ? (
          <button
            type="button"
            onClick={() => onOpenViewer({ documentId: docId, page: loc.page, rects: loc.rects })}
            className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 text-[12px] font-medium text-success hover:bg-success/20"
          >
            <BookOpen className="size-3.5" />
            {t('tbOpenDoc', { page: loc.page })}
          </button>
        ) : null}
      </Lane>
    )
  }
  if (src && !src.verifiedNow) {
    return (
      <Lane tone="warning" icon={FileSearch} title={t('tbSourceUnverifiedTitle')}>
        {t('tbSourceUnverifiedBody')}
        <ExcerptView lane={src} />
      </Lane>
    )
  }
  /**
   * Không có câu trích, nhưng kết luận do MÁY TỰ ĐỐI CHIẾU ra.
   *
   * Thiếu nhánh này thì một cạnh máy tự chứng được rơi vào ô xám "không lấy từ tài liệu nào" và đọc
   * lên như một sự thiếu sót, trong khi nó là loại căn cứ mạnh thứ hai. Trường `basis` vốn đã được
   * lấy về và không ai đọc.
   */
  if (d.basis === 'STRUCTURAL') {
    return (
      <Lane tone="info" icon={Cpu} title={t('tbSourceMachineTitle')}>
        {t('tbSourceMachineBody')}
      </Lane>
    )
  }
  return (
    <Lane tone="muted" icon={FileSearch} title={t('tbSourceNoneTitle')}>
      {t('tbSourceNoneBody')}
    </Lane>
  )
}

function StructuralLane({ s, t }: { s: DecisionTraceDto['structural'][number]; t: TFn }) {
  const copy = CHECK_KEY[s.checkCode]
  const passed = s.passedNow
  const body = copy
    ? t(passed ? copy.pass : copy.fail)
    : // Mã lạ: vẫn hiện, và nói thẳng là chưa có lời giải thích — im lặng thì người duyệt tưởng
      // hệ thống không kiểm gì ở đây cả.
      t('tbStructUnknown')
  const tone: Tone = passed ? 'info' : (copy?.failTone ?? 'warning')
  return (
    <Lane
      tone={tone}
      icon={passed ? ShieldCheck : ShieldX}
      title={t(passed ? 'tbStructPassTitle' : 'tbStructFailTitle')}
    >
      {body}
      {!s.liveChecked ? <p className="mt-1 text-foreground-subtle">{t('tbStructNotRechecked')}</p> : null}
    </Lane>
  )
}

/** Tấm thẻ THUẦN — nhận dữ liệu qua tham số, không tự đi lấy. Nhờ vậy chỗ nào đã có sẵn dữ liệu thì
 *  dựng thẳng, khỏi thêm một vòng gọi máy chủ. */
export function DecisionTraceCard({ trace, onClose }: { trace: DecisionTraceDto; onClose?: () => void }) {
  const t = useTranslations('admin.authoring')
  const locale = useLocale()
  const format = useFormatter()
  const [viewer, setViewer] = useState<ViewerTarget | null>(null)

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      {viewer ? <PdfViewer {...viewer} onClose={() => setViewer(null)} /> : null}
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">{t(TITLE_KEY[trace.artifact])}</h4>
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

      <p className="text-[13px] font-medium leading-relaxed text-foreground">
        {trace.claim[locale] ?? trace.claim.vi ?? trace.claim.en ?? trace.subjectSlug}
      </p>

      {trace.drift ? (
        <div className="flex items-start gap-1.5 rounded-md bg-warning-soft p-2.5 text-[12px] text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" />
          <span className="leading-relaxed">{t('tbDriftWarn')}</span>
        </div>
      ) : null}

      {/*
        LỜI MÁY TỰ LÝ GIẢI — luôn là phán đoán, không bao giờ là bằng chứng.
        Với thẻ "hai thứ này là một" thì đây là TẤT CẢ những gì có: trigram không sinh ra câu trích
        lẫn phép tự kiểm nào. Không vẽ nó thì tấm thẻ mở ra trống trơn, và một quyết định gộp — thứ
        nặng nhất máy được phép tự làm — trông như chưa từng xảy ra.
      */}
      {trace.reason ? (
        <Lane tone="warning" icon={Sparkles} title={t('tbReasonTitle')}>
          {trace.reason[locale] ?? trace.reason.vi ?? trace.reason.en}
        </Lane>
      ) : null}

      {/* Thẻ gộp không có làn nguồn — vẽ một ô "không lấy từ tài liệu nào" ở đó là nói thừa. */}
      {trace.artifact === 'CONCEPT_IDENTITY' ? null : <SourceLane d={trace} t={t} onOpenViewer={setViewer} />}
      {trace.structural.map((s) => (
        <StructuralLane key={s.checkCode} s={s} t={t} />
      ))}

      {/* Người duyệt — quyền cao nhất (R5). KHÔNG có thang tin cậy nào ở đây. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-2 text-[12px]">
        {trace.verdict === 'CONFIRMED' ? (
          <CheckCircle2 className="size-3.5 shrink-0 text-success" />
        ) : trace.verdict === 'REJECTED' ? (
          <ShieldX className="size-3.5 shrink-0 text-danger" />
        ) : (
          <Clock className="size-3.5 shrink-0 text-foreground-subtle" />
        )}
        <span className="text-foreground-muted">{t(VERDICT_KEY[trace.verdict] ?? 'tbVerdictPending')}</span>
        {trace.decidedAt ? (
          <span className="text-foreground-subtle">
            · {format.dateTime(new Date(trace.decidedAt), { dateStyle: 'medium' })}
          </span>
        ) : null}
        {trace.overridden ? <span className="w-full text-foreground-subtle">{t('tbOverridden')}</span> : null}
        {trace.supersededCount > 0 ? (
          <span className="w-full text-foreground-subtle">
            {t('tbNewerGeneration', { n: trace.supersededCount })}
          </span>
        ) : null}
      </div>
    </div>
  )
}

/** Phần đi lấy dữ liệu. Một chỗ có thể có nhiều thẻ (mỗi mảnh kiến thức một thẻ) nên vẽ cả danh sách. */
export function DecisionTrace({
  artifact,
  subject,
  object,
  onClose,
}: {
  artifact: TraceArtifactDto
  subject: string
  object?: string
  onClose?: () => void
}) {
  const t = useTranslations('admin.authoring')
  const q = useDecisionTraces({ artifact, subject, ...(object ? { object } : {}) })

  if (q.isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface p-4 text-[13px] text-foreground-muted">
        <Spinner /> {t('tbLoading')}
      </div>
    )
  }
  if (q.isError || !q.data || q.data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] text-foreground-subtle">{t('tbEmptyAny')}</p>
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
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {q.data.map((trace, i) => (
        <DecisionTraceCard key={trace.id} trace={trace} {...(i === 0 && onClose ? { onClose } : {})} />
      ))}
    </div>
  )
}
