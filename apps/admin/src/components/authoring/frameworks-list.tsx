// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useTranslations } from 'next-intl'
import {
  Badge,
  Card,
  CardContent,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { useFrameworks } from '@/lib/authoring-queries'

/** Danh sách khung năng lực — vào chi tiết để quản lý bản phát hành + xem đồ thị. */
export function FrameworksList() {
  const t = useTranslations('admin.authoring')
  const { data, isLoading, isError } = useFrameworks()

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (isError) return <EmptyState title={t('failed')} />
  if (!data?.length) return <EmptyState title={t('empty')} />

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>{t('frameworks')}</TH>
              <TH>{t('versionsTitle')}</TH>
              <TH>{t('objectivesTitle')}</TH>
              <TH />
            </TR>
          </THead>
          <TBody>
            {data.map((f) => (
              <TR key={f.slug}>
                <TD>
                  <div className="font-medium text-foreground">{f.name.vi ?? f.name.en ?? f.slug}</div>
                  <div className="text-xs text-foreground-muted">
                    {f.slug} · {f.kind} · {f.locale}
                  </div>
                </TD>
                <TD>
                  <Badge tone="soft">{f.versions}</Badge>
                </TD>
                <TD>
                  <Badge tone="soft">{f.objectives}</Badge>
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/authoring/frameworks/${f.slug}`}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {t('view')}
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  )
}
