// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle2, LayoutGrid, List, Sparkles } from 'lucide-react'
import { Badge, Card, CardContent, CardHeader, CardTitle, Progress, Spinner } from '@bingoo.ai/ui-web'
import { cn } from '@/lib/cn'

/**
 * CHUYỂN CHƯƠNG TRÌNH — trải nghiệm NGƯỜI HỌC: "học xong chương trình này, sang chương trình kia
 * mình cần gì thêm". Đọc crosswalk qua KC nền dùng chung (không dịch hồ sơ). Giọng khích lệ: nhấn
 * "bạn đã sẵn sàng bao nhiêu %" và "đã có gì" trước, rồi mới tới "cần học thêm" như một danh sách nhẹ.
 *
 * Demo cố định chiều MOET Lớp 1 → Cambridge Stage 2 (câu chuyện rõ nhất). Nếu học viên có mastery
 * thật thì đọc `/knowledge/framework/:slug/report` theo chính họ — cùng một hàm lõi ở backend.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const FROM = 'moet-primary-math-g1'
const TO = 'cambridge-primary-math-s2'

type Status = 'achieved' | 'partial' | 'none'
interface ObjGap {
  slug: string
  code?: string
  title: string
  missing: string[]
  status: Status
}
interface Kc {
  slug: string
  title: string
  side: 'a' | 'b' | 'both'
}
interface Crosswalk {
  a: { name: string }
  b: { name: string }
  kcs: Kc[]
  sharedKcs: string[]
  aToB: {
    objectives: ObjGap[]
    summary: { achieved: number; none: number; partial: number; total: number; percent: number }
  }
}

// Venn thu gọn cho học sinh: hai vòng tròn thật (viewBox 350×250 khớp aspect-[7/5]), chữ trong vòng.
function VennMini({ data }: { data: Crosswalk }) {
  const t = useTranslations('switchFramework')
  const zones = [
    {
      header: t('vennOld'),
      items: data.kcs.filter((k) => k.side === 'a'),
      tone: 'text-primary',
      chip: 'border-primary/30',
    },
    {
      header: t('vennHave'),
      items: data.kcs.filter((k) => k.side === 'both'),
      tone: 'text-accent-teal',
      chip: 'border-accent-teal/35',
    },
    {
      header: t('vennNeed'),
      items: data.kcs.filter((k) => k.side === 'b'),
      tone: 'text-accent-coral',
      chip: 'border-accent-coral/30',
    },
  ]
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="mb-2 flex items-baseline justify-between gap-3 text-[12px] font-semibold">
          <span className="min-w-0 truncate text-primary">◖ {data.a.name}</span>
          <span className="min-w-0 truncate text-right text-accent-coral">{data.b.name} ◗</span>
        </div>
        <div className="relative mx-auto aspect-[7/5] w-full max-w-2xl">
          <svg
            aria-hidden
            viewBox="0 0 350 250"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
          >
            <circle
              cx="120"
              cy="125"
              r="115"
              fill="var(--color-primary)"
              fillOpacity="0.06"
              stroke="var(--color-primary)"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
            <circle
              cx="230"
              cy="125"
              r="115"
              fill="var(--color-accent-coral)"
              fillOpacity="0.06"
              stroke="var(--color-accent-coral)"
              strokeOpacity="0.35"
              strokeWidth="1.2"
            />
          </svg>
          <div className="absolute inset-0 grid grid-cols-3 items-center gap-1 px-2 py-4">
            {zones.map((z) => (
              <div key={z.header} className="flex flex-col items-center gap-2 text-center">
                <span className={cn('text-[11px] font-semibold uppercase tracking-wide', z.tone)}>
                  {z.header} · {z.items.length}
                </span>
                {z.items.map((k) => (
                  <span
                    key={k.slug}
                    className={cn(
                      'max-w-[11rem] rounded-full border bg-surface/90 px-2.5 py-1 text-[11px] leading-tight text-foreground shadow-sm backdrop-blur-sm',
                      z.chip,
                    )}
                  >
                    {k.title}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SwitchFrameworkPage() {
  const t = useTranslations('switchFramework')
  const [data, setData] = useState<Crosswalk | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')
  const [view, setView] = useState<'venn' | 'list'>('venn')

  useEffect(() => {
    let alive = true
    // Hono app mount ở `/` (không phải `/api`; chỉ better-auth ở /api/auth). Route: /knowledge/...
    fetch(`${API}/knowledge/crosswalk/${FROM}/${TO}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { data: Crosswalk }) => {
        if (alive) {
          setData(j.data)
          setState('ready')
        }
      })
      .catch(() => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    )
  }
  if (state === 'error' || !data) {
    return <p className="py-16 text-center text-foreground-muted">{t('failed')}</p>
  }

  const { aToB } = data
  const kcTitle = new Map(data.kcs.map((k) => [k.slug, k.title]))
  const missing = aToB.objectives.filter((o) => o.status !== 'achieved')
  const have = aToB.objectives.filter((o) => o.status === 'achieved')

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-foreground-muted">{t('subtitle')}</p>
      </div>

      {/* Kịch bản: học chương trình này → sang chương trình kia */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge color="teal" tone="soft">
          {t('studied')}: {data.a.name}
        </Badge>
        <ArrowRight className="size-4 text-foreground-subtle" />
        <Badge color="primary" tone="soft">
          {t('movingTo')}: {data.b.name}
        </Badge>
      </div>

      {/* Thước sẵn sàng — khích lệ trước */}
      <Card className="border-primary/30">
        <CardContent className="space-y-3 pt-6">
          <div className="flex items-end justify-between">
            <span className="text-lg font-semibold text-foreground">
              {t('ready', { percent: aToB.summary.percent })}
            </span>
            <span className="text-sm text-foreground-muted">
              {t('metOfTotal', { met: aToB.summary.achieved, total: aToB.summary.total })}
            </span>
          </div>
          <Progress value={aToB.summary.percent} />
        </CardContent>
      </Card>

      {/* Chọn cách xem: Biểu đồ Venn (trực quan) hay Danh sách (đọc kỹ từng mục) */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 text-[13px] sm:w-fit">
        {(['venn', 'list'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 transition-colors sm:flex-none',
              view === v
                ? 'bg-primary-soft font-medium text-primary-soft-foreground'
                : 'text-foreground-muted hover:bg-surface-muted',
            )}
          >
            {v === 'venn' ? <LayoutGrid className="size-3.5" /> : <List className="size-3.5" />}
            {t(v === 'venn' ? 'viewVenn' : 'viewList')}
          </button>
        ))}
      </div>

      {view === 'venn' ? (
        <VennMini data={data} />
      ) : (
        <>
          {/* Bạn đã có */}
          {have.length > 0 ? (
            <Card className="border-success/25">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-foreground">
                  <CheckCircle2 className="size-4 text-success" />
                  {t('have')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {have.map((o) => (
                    <li key={o.slug} className="flex items-baseline gap-2 text-[14px]">
                      <span className="mt-[6px] size-1.5 shrink-0 rounded-full bg-success" />
                      <span className="text-foreground">{o.title}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {/* Cần học thêm — mỗi mục nói rõ khái niệm còn thiếu */}
          <Card className={cn(missing.length ? 'border-warning/30' : 'border-success/30')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-foreground">
                <Sparkles className="size-4 text-warning" />
                {missing.length ? t('needN', { n: missing.length }) : t('needNone')}
              </CardTitle>
            </CardHeader>
            {missing.length > 0 ? (
              <CardContent>
                <ul className="space-y-2.5">
                  {missing.map((o) => (
                    <li key={o.slug} className="rounded-lg border border-border bg-surface px-3 py-2">
                      <div className="text-[14px] font-medium text-foreground">{o.title}</div>
                      {o.missing.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {o.missing.map((k) => (
                            <Badge key={k} color="warning" tone="soft" size="sm">
                              {kcTitle.get(k) ?? k}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        </>
      )}
    </div>
  )
}
