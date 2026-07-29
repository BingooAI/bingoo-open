// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState, Spinner } from '@bingoo.ai/ui-web'
import { useAdminUser } from '@/lib/user-queries'
import { GapReport } from './gap-report'

/** Chi tiết một người dùng + hồ sơ học tập đọc theo khung chương trình. */
export function UserDetail({ userId }: { userId: string }) {
  const t = useTranslations('admin.users')
  const format = useFormatter()
  const { data, isLoading, isError } = useAdminUser(userId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (isError || !data) return <EmptyState title={t('notFound')} />

  const facts: Array<{ key: string; value: string }> = [
    { key: 'publicId', value: data.publicId },
    { key: 'accountType', value: data.accountType },
    { key: 'status', value: data.banned ? t('banned') : data.status },
    { key: 'role', value: data.role },
    { key: 'locale', value: data.locale ?? '—' },
    { key: 'joined', value: format.dateTime(new Date(data.createdAt), { dateStyle: 'medium' }) },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{data.name}</CardTitle>
            {data.managedByGuardian && <Badge tone="soft">{t('managedByGuardian')}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.key}>
              <div className="text-xs uppercase tracking-wide text-foreground-muted">
                {t(`field.${f.key}`)}
              </div>
              <div className="text-sm text-foreground">{f.value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t('gap.title')}</h2>
          <p className="text-sm text-foreground-muted">
            {data.trackedSkills > 0 ? t('gap.subtitle', { count: data.trackedSkills }) : t('gap.noData')}
          </p>
        </div>
        <GapReport userId={userId} />
      </section>
    </div>
  )
}
