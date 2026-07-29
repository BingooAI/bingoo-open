// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { useAdminUsers } from '@/lib/user-queries'

/** Danh sách người dùng — vào chi tiết để đọc hồ sơ học tập theo khung chương trình. */
export function UsersList() {
  const t = useTranslations('admin.users')
  const format = useFormatter()
  const [term, setTerm] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading, isError } = useAdminUsers(q, page)

  const search = (): void => {
    setQ(term.trim())
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') search()
          }}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="max-w-sm"
        />
        <Button onClick={search}>{t('search')}</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState title={t('failed')} />
      ) : !data?.data.length ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>{t('colName')}</TH>
                    <TH>{t('colType')}</TH>
                    <TH>{t('colStatus')}</TH>
                    <TH>{t('colJoined')}</TH>
                    <TH />
                  </TR>
                </THead>
                <TBody>
                  {data.data.map((u) => (
                    <TR key={u.id}>
                      <TD>
                        <div className="font-medium text-foreground">{u.name}</div>
                        {/* publicId, không phải email: định danh này an toàn để hiện, kể cả với
                            tài khoản trẻ mà email chỉ là địa chỉ nội bộ suy ra từ chính nó. */}
                        <div className="text-xs text-foreground-muted">{u.publicId}</div>
                      </TD>
                      <TD>
                        <Badge tone="soft">{u.accountType}</Badge>
                      </TD>
                      <TD>
                        <Badge tone="soft" color={u.banned ? 'danger' : undefined}>
                          {u.banned ? t('banned') : u.status}
                        </Badge>
                      </TD>
                      <TD className="text-sm text-foreground-muted">
                        {format.dateTime(new Date(u.createdAt), { dateStyle: 'medium' })}
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/users/${u.id}`}
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

          {data.meta.totalPages > 1 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-foreground-muted">
                {t('pageOf', { page: data.meta.page, total: data.meta.totalPages })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {t('prev')}
                </Button>
                <Button
                  variant="secondary"
                  disabled={page >= data.meta.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t('next')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
