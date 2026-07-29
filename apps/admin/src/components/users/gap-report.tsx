// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useMemo, useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Progress,
  RadarChart,
  RangeDots,
  Select,
  Spinner,
  StackedBar,
  type ChartColor,
  type RadarPoint,
} from '@bingoo.ai/ui-web'
import {
  useFrameworkStages,
  useLearnerGap,
  useReportableFrameworks,
  type ConceptGapDto,
  type GapReportDto,
  type ObjectiveGapDto,
} from '@/lib/user-queries'

/**
 * Lỗ hổng của một người học so với một khung chương trình.
 *
 * ## Xếp theo VIỆC PHẢI LÀM, không theo trạng thái
 *
 * Bản đầu đổ ra một danh sách phẳng: đạt và chưa đạt xen kẽ, mỗi mục một thẻ giống hệt nhau,
 * mười hai thẻ như nhau thì không thẻ nào nổi. Giáo viên mở màn này ra không phải để biết tình
 * trạng — họ để biết SÁNG MAI LÀM GÌ. Nên ba nhóm ở đây là ba việc khác nhau:
 *
 *   CẦN DẠY  — đã đo, chưa tới. Có bằng chứng, và bằng chứng nói chưa được.
 *   CẦN ĐO   — chưa ai nhìn tới. Dạy lại ở đây là dạy mò.
 *   ĐÃ ĐẠT   — thu gọn sẵn. Không có việc gì phải làm thì không nên chiếm chỗ.
 *
 * ## Vì sao có nút "Vì sao?"
 *
 * Một con số không giải thích được thì hoặc bị tin mù, hoặc bị bỏ qua — cả hai đều tệ khi nó
 * nói về một đứa trẻ. Bảng giải thích chỉ phơi ra thứ engine vốn đã dùng để tính: luật nào,
 * mắt xích nào ràng buộc, bao nhiêu lần quan sát, ngưỡng đạt là bao nhiêu. Không suy luận mới,
 * nên không có gì để mà sai lệch so với con số nó giải thích.
 *
 * ## Hai luật của ADR 0007 nằm ở dữ liệu, không ở đây
 *
 * Mục tiêu `evidence-only` về tới đây đã có `mastery: null` — màn hình không có gì để in dù có
 * muốn. Tương tự khi chưa một quan sát nào: từng in ra "Mức nắm 0%", và số 0 ấy vô hiệu hoá
 * luôn câu "chưa ai đo" bên cạnh nó, vì người đọc tin con số hơn tin câu chữ.
 */
export function GapReport({ userId }: { userId: string }) {
  const t = useTranslations('admin.users.gap')
  const [framework, setFramework] = useState<string | null>(null)
  const [stage, setStage] = useState<string | null>(null)

  const frameworks = useReportableFrameworks(userId)
  const stages = useFrameworkStages(framework)
  const gap = useLearnerGap(userId, framework, stage)

  if (frameworks.isLoading) return <Loading />
  if (frameworks.isError) return <EmptyState title={t('failed')} />
  if (!frameworks.data?.length) {
    return <EmptyState title={t('noFrameworks')} description={t('noFrameworksHint')} />
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label={t('frameworkLabel')}
          value={framework ?? ''}
          onChange={(e) => {
            setFramework(e.target.value || null)
            setStage(null)
          }}
          className="w-full sm:w-80"
        >
          <option value="">{t('choose')}</option>
          {frameworks.data.map((f) => (
            <option key={f.slug} value={f.slug}>
              {f.name?.vi ?? f.name?.en ?? f.slug}
            </option>
          ))}
        </Select>

        {/* Bậc là nhãn riêng của từng khung — lấy từ dữ liệu. Khung không khai bậc thì ô này
            không xuất hiện, thay vì hiện một ô rỗng khó hiểu. */}
        {!!stages.data?.length && (
          <Select
            aria-label={t('stageLabel')}
            value={stage ?? ''}
            onChange={(e) => setStage(e.target.value || null)}
            className="w-full sm:w-56"
          >
            <option value="">{t('allStages')}</option>
            {stages.data.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        )}
      </div>

      {!framework ? (
        <EmptyState title={t('pickFramework')} />
      ) : gap.isLoading ? (
        <Loading />
      ) : gap.isError ? (
        <EmptyState title={t('failed')} />
      ) : !gap.data?.objectives.length ? (
        <EmptyState title={t('noObjectives')} />
      ) : (
        <Report report={gap.data} />
      )}
    </div>
  )
}

function Loading() {
  return (
    <div className="flex justify-center py-12">
      <Spinner />
    </div>
  )
}

function Report({ report }: { report: GapReportDto }) {
  const t = useTranslations('admin.users.gap')

  const groups = useMemo(() => {
    const teach: ObjectiveGapDto[] = []
    const measure: ObjectiveGapDto[] = []
    const done: ObjectiveGapDto[] = []
    for (const o of report.objectives) {
      if (o.status === 'achieved') done.push(o)
      else if (o.reason === 'no-evidence') measure.push(o)
      else teach.push(o)
    }
    // Trong nhóm cần dạy, xa ngưỡng nhất lên trước — đó là chỗ cần nhiều buổi nhất.
    teach.sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0))
    return { teach, measure, done }
  }, [report.objectives])

  const total = report.summary.total
  const achieved = report.summary.achieved

  return (
    <div className="space-y-5">
      {/* Một thanh phần-trên-tổng + ba con số CỘNG LẠI BẰNG TỔNG. Bản đầu để "chưa có 6" cạnh
          "chờ được đo 6" — cùng sáu mục ấy, đọc ra thành mười hai. */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-foreground">{t('progressLabel')}</span>
            <span className="text-sm text-foreground-muted">{t('progressCount', { achieved, total })}</span>
          </div>
          <StackedBar
            ariaLabel={t('progressLabel')}
            segments={[
              { label: t('group.teach'), value: groups.teach.length, color: 'chart-teach' },
              { label: t('group.measure'), value: groups.measure.length, color: 'chart-measure' },
              { label: t('group.done'), value: groups.done.length, color: 'chart-done' },
            ]}
          />
          {/* Chú giải LUÔN có mặt khi ≥2 chuỗi — nhận dạng không bao giờ chỉ dựa vào màu. */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-sm">
            <Tally count={groups.teach.length} label={t('group.teach')} series="chart-teach" />
            <Tally count={groups.measure.length} label={t('group.measure')} series="chart-measure" />
            <Tally count={groups.done.length} label={t('group.done')} series="chart-done" />
          </div>
        </CardContent>
      </Card>

      <Charts report={report} />

      <Group title={t('group.teach')} hint={t('group.teachHint')} objectives={groups.teach} color="warning" />
      <Group
        title={t('group.measure')}
        hint={t('group.measureHint')}
        objectives={groups.measure}
        color="info"
      />
      <Group
        title={t('group.done')}
        hint={t('group.doneHint')}
        objectives={groups.done}
        color="success"
        collapsed
      />
    </div>
  )
}

function Tally({ count, label, series }: { count: number; label: string; series: ChartColor }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block size-2 rounded-full"
        style={{ background: `var(--color-${series})` }}
        aria-hidden
      />
      {/* Chữ mặc áo chữ, không mặc màu chuỗi — chấm màu bên cạnh mới là thứ chở nhận dạng. */}
      <span className="font-semibold text-foreground">{count}</span>
      <span className="text-foreground-muted">{label}</span>
    </span>
  )
}

/**
 * Hai hình, hai việc khác nhau — và thứ tự này là có lý do.
 *
 * RADAR trả lời "hình dáng năng lực thế nào" trong một cái liếc. Nó KHÔNG chở nổi độ bất định,
 * và bán kính thì phóng đại chênh lệch (diện tích tăng theo bình phương). Nên nó là hình để
 * NHÌN, không phải hình để ĐỌC SỐ.
 *
 * CHẤM-KÈM-KHOẢNG mới là chỗ đọc số: vị trí là kênh chính xác nhất, và nó là hình duy nhất ở
 * đây hiện được khoảng tin cậy — thứ mà ADR 0007 bắt buộc phải đi kèm mọi điểm số.
 *
 * Trục radar chọn theo dữ liệu thật: mạch nội dung nếu khung có khai (≥3 mạch), không thì loại
 * năng lực. Dưới 3 trục thì radar là một tam giác suy biến, nên không vẽ — nói thẳng lý do còn
 * hơn vẽ một hình vô nghĩa.
 */
function Charts({ report }: { report: GapReportDto }) {
  const t = useTranslations('admin.users.gap.charts')
  const format = useFormatter()
  const pct = (v: number): string => format.number(v, { style: 'percent', maximumFractionDigits: 0 })

  const tKind = useTranslations('admin.users.gap.kind')
  const { axes, dimension } = useMemo(() => buildRadarAxes(report), [report])
  // Trục do LOẠI NĂNG LỰC thì nhãn là mã enum — dịch trước khi vẽ. Đúng lỗi đã sửa cho khái
  // niệm rồi lặp lại ở đây: mã máy không bao giờ được đi thẳng ra mặt người dùng.
  const labelledAxes = useMemo<RadarPoint[]>(
    () =>
      axes.map((a) => ({
        ...a,
        label: dimension === 'kind' ? tKind(a.label as never) : a.label,
      })),
    [axes, dimension, tKind],
  )

  const rows = useMemo(
    () =>
      report.objectives
        .filter((o) => o.mastery !== null && o.interval !== null)
        .map((o) => ({
          label: o.title.vi ?? o.title.en ?? o.slug,
          value: o.mastery as number,
          lo: o.interval?.lo ?? 0,
          hi: o.interval?.hi ?? 1,
          color: (o.status === 'achieved' ? 'chart-done' : 'chart-teach') as ChartColor,
        }))
        .sort((a, b) => a.value - b.value),
    [report.objectives],
  )

  const cut = report.objectives[0]?.explanation.cut
  const unmeasured = axes.filter((a) => a.value === null).length

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('radarTitle')}</h3>
            <p className="text-xs text-foreground-muted">
              {dimension === null ? t('radarUnavailable') : t(`radarBy.${dimension}`)}
            </p>
          </div>
          {axes.length >= 3 ? (
            <>
              <div className="flex justify-center pt-1">
                <RadarChart
                  data={labelledAxes}
                  max={1}
                  size={240}
                  color="chart-measure"
                  ariaLabel={t('radarTitle')}
                  unmeasuredLabel={t('unmeasured')}
                  formatValue={pct}
                />
              </div>
              {/* Hình méo là có chủ ý — nói ra để không ai tưởng là lỗi vẽ. */}
              {unmeasured > 0 && (
                <p className="text-xs text-foreground-muted">{t('radarGaps', { count: unmeasured })}</p>
              )}
            </>
          ) : (
            <p className="py-6 text-center text-sm text-foreground-muted">{t('radarTooFewAxes')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">{t('rangeTitle')}</h3>
            <p className="text-xs text-foreground-muted">{t('rangeHint')}</p>
          </div>
          {rows.length > 0 ? (
            <RangeDots
              rows={rows}
              {...(cut === undefined
                ? {}
                : { reference: cut, referenceLabel: t('passMark', { cut: pct(cut) }) })}
              max={1}
              formatValue={pct}
            />
          ) : (
            <p className="py-6 text-center text-sm text-foreground-muted">{t('rangeEmpty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Trục radar lấy từ dữ liệu thật, không dựng cứng.
 *
 * Ưu tiên MẠCH NỘI DUNG vì đó là thứ người soạn chương trình nghĩ tới khi nói "hình dáng năng
 * lực". Khung không khai mạch thì rơi về LOẠI NĂNG LỰC — thứ khung nào cũng ánh xạ vào được,
 * nên hình vẫn vẽ được mà không phải hiểu riêng khung nào.
 *
 * Nhóm nào không có lấy một quan sát thì `value` là `null`, KHÔNG phải 0 — xem `RadarPoint`.
 */
function buildRadarAxes(report: GapReportDto): {
  axes: RadarPoint[]
  dimension: 'strand' | 'kind' | null
} {
  const byStrand = groupAxes(report, (o) => o.strand)
  if (byStrand.length >= 3) return { axes: byStrand, dimension: 'strand' }

  const byKind = new Map<string, { sum: number; n: number; obs: number }>()
  for (const o of report.objectives) {
    for (const c of o.concepts) {
      const cur = byKind.get(c.kind) ?? { sum: 0, n: 0, obs: 0 }
      byKind.set(c.kind, { sum: cur.sum + c.mastery, n: cur.n + 1, obs: cur.obs + c.observations })
    }
  }
  const kindAxes: RadarPoint[] = [...byKind.entries()].map(([kind, v]) => ({
    label: kind,
    value: v.obs > 0 ? v.sum / v.n : null,
  }))
  if (kindAxes.length >= 3) return { axes: kindAxes, dimension: 'kind' }

  return { axes: byStrand.length > kindAxes.length ? byStrand : kindAxes, dimension: null }
}

function groupAxes(report: GapReportDto, key: (o: ObjectiveGapDto) => string | null): RadarPoint[] {
  const groups = new Map<string, { sum: number; n: number; obs: number }>()
  for (const o of report.objectives) {
    const k = key(o)
    if (k === null) continue
    const cur = groups.get(k) ?? { sum: 0, n: 0, obs: 0 }
    const obs = o.concepts.reduce((s, c) => s + c.observations, 0)
    groups.set(k, { sum: cur.sum + (o.mastery ?? 0), n: cur.n + 1, obs: cur.obs + obs })
  }
  return [...groups.entries()].map(([label, v]) => ({
    label,
    value: v.obs > 0 ? v.sum / v.n : null,
  }))
}

function Group({
  title,
  hint,
  objectives,
  color,
  collapsed = false,
}: {
  title: string
  hint: string
  objectives: readonly ObjectiveGapDto[]
  color: 'warning' | 'info' | 'success'
  collapsed?: boolean
}) {
  const t = useTranslations('admin.users.gap')
  const [open, setOpen] = useState(!collapsed)
  if (objectives.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            {title}
            <Badge tone="soft" color={color}>
              {objectives.length}
            </Badge>
          </h3>
          <p className="text-sm text-foreground-muted">{hint}</p>
        </div>
        {collapsed && (
          <Button variant="ghost" size="sm" onClick={() => setOpen((v) => !v)}>
            {open ? t('collapse') : t('expand')}
          </Button>
        )}
      </div>
      {open && (
        <div className="space-y-2">
          {objectives.map((o) => (
            <ObjectiveCard key={o.slug} objective={o} accent={color} />
          ))}
        </div>
      )}
    </section>
  )
}

function ObjectiveCard({
  objective,
  accent,
}: {
  objective: ObjectiveGapDto
  accent: 'warning' | 'info' | 'success'
}) {
  const t = useTranslations('admin.users.gap')
  const format = useFormatter()
  const [why, setWhy] = useState(false)

  const title = objective.title.vi ?? objective.title.en ?? objective.slug
  const observations = objective.concepts.reduce((sum, c) => sum + c.observations, 0)
  const border = { warning: 'border-l-warning', info: 'border-l-info', success: 'border-l-success' }[accent]

  return (
    <Card className={`border-l-4 ${border}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="font-medium text-foreground">{title}</p>
            <div className="flex flex-wrap gap-1.5">
              {objective.stage && (
                <Badge tone="soft" color="neutral">
                  {objective.stage}
                </Badge>
              )}
              {objective.strand && (
                <Badge tone="soft" color="neutral">
                  {objective.strand}
                </Badge>
              )}
            </div>
          </div>

          <div className="shrink-0 text-right">
            {objective.mastery !== null ? (
              <>
                <div className="text-xl font-semibold tabular-nums text-foreground">
                  {format.number(objective.mastery, { style: 'percent', maximumFractionDigits: 0 })}
                </div>
                {/* Điểm không bao giờ đứng một mình: khoảng là chỗ dữ liệu mỏng tự khai ra. */}
                <div className="text-xs tabular-nums text-foreground-muted">
                  {t('intervalShort', {
                    lo: format.number(objective.interval?.lo ?? 0, {
                      style: 'percent',
                      maximumFractionDigits: 0,
                    }),
                    hi: format.number(objective.interval?.hi ?? 1, {
                      style: 'percent',
                      maximumFractionDigits: 0,
                    }),
                  })}
                </div>
              </>
            ) : (
              <div className="text-xs text-foreground-muted">
                {objective.reportMode === 'evidence-only' ? t('notScoredShort') : t('noEvidenceShort')}
              </div>
            )}
          </div>
        </div>

        {objective.reportMode === 'evidence-only' && (
          <p className="text-sm text-foreground">{t('observationsOnly', { count: observations })}</p>
        )}

        {objective.reason && (
          <p className="text-sm text-foreground-muted">{t(`reason.${camel(objective.reason)}`)}</p>
        )}

        {objective.notYet.length > 0 && (
          <ConceptLine
            label={t('needsTeaching')}
            concepts={objective.concepts.filter((c) => objective.notYet.includes(c.slug))}
          />
        )}
        {objective.unevidenced.length > 0 && (
          <ConceptLine
            label={t('needsObserving')}
            concepts={objective.concepts.filter((c) => objective.unevidenced.includes(c.slug))}
          />
        )}

        <div>
          <Button variant="ghost" size="sm" onClick={() => setWhy((v) => !v)} aria-expanded={why}>
            {why ? t('why.hide') : t('why.show')}
          </Button>
        </div>
        {why && <WhyPanel objective={objective} />}
      </CardContent>
    </Card>
  )
}

function ConceptLine({ label, concepts }: { label: string; concepts: readonly ConceptGapDto[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">{label}</span>
      {concepts.map((c) => (
        <Badge key={c.slug} tone="soft" color="neutral">
          {c.title?.vi ?? c.title?.en ?? c.slug}
        </Badge>
      ))}
    </div>
  )
}

/**
 * Vì sao con số là con số đó.
 *
 * Không phải một đoạn văn về thuật toán — một giáo viên hỏi "vì sao 28%" cần biết MẮT XÍCH NÀO
 * kéo xuống, chứ không cần định nghĩa của phép min. Nên bảng dưới đây là chính các mảnh engine
 * đã dùng, và mắt xích ràng buộc được đánh dấu.
 */
function WhyPanel({ objective }: { objective: ObjectiveGapDto }) {
  const t = useTranslations('admin.users.gap.why')
  const format = useFormatter()
  const { explanation: ex } = objective
  const pct = (v: number): string => format.number(v, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <div className="space-y-3 rounded-lg bg-surface-muted p-3 text-sm">
      <p className="text-foreground">{t(`rule.${camel(ex.rule)}`, { count: ex.requiredCount })}</p>

      <ul className="space-y-2">
        {objective.concepts.map((c) => {
          const isBinding = c.slug === ex.binding
          return (
            <li
              key={c.slug}
              className={`rounded-md p-2 ${isBinding ? 'bg-surface ring-1 ring-warning' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-foreground">{c.title?.vi ?? c.title?.en ?? c.slug}</span>
                <div className="flex items-center gap-2">
                  {isBinding && (
                    <Badge tone="soft" color="warning">
                      {t('binding')}
                    </Badge>
                  )}
                  {c.required && (
                    <Badge tone="soft" color="neutral">
                      {t('required')}
                    </Badge>
                  )}
                  <span className="tabular-nums text-foreground-muted">
                    {c.observations > 0 ? pct(c.mastery) : t('noObs')}
                  </span>
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Progress
                  value={c.mastery * 100}
                  size="sm"
                  color={c.met ? 'success' : 'coral'}
                  label={c.title?.vi ?? c.slug}
                  className="flex-1"
                />
                <span className="shrink-0 text-xs tabular-nums text-foreground-muted">
                  {t('observations', { count: c.observations })}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <p className="text-xs text-foreground-muted">
        {t('footer', { cut: pct(ex.cut), observations: ex.observations })}
      </p>
    </div>
  )
}

/** `no-evidence` → `noEvidence`, để khoá i18n không mang dấu gạch. */
function camel(value: string): string {
  return value.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase())
}
