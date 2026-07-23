// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
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
interface Crosswalk {
  a: { name: string }
  b: { name: string }
  kcs: { slug: string; title: string }[]
  sharedKcs: string[]
  aToB: {
    objectives: ObjGap[]
    summary: { achieved: number; none: number; partial: number; total: number; percent: number }
  }
}

export default function SwitchFrameworkPage() {
  const t = useTranslations('switchFramework')
  const [data, setData] = useState<Crosswalk | null>(null)
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading')

  useEffect(() => {
    let alive = true
    fetch(`${API}/api/knowledge/crosswalk/${FROM}/${TO}`, { credentials: 'include' })
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

      {/* Đã có — trấn an */}
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

      {/* Cần học thêm — danh sách nhẹ, mỗi mục nói rõ khái niệm còn thiếu */}
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
    </div>
  )
}
