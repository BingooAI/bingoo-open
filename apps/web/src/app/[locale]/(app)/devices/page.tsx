'use client'

import { Laptop, Smartphone } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@bingoo.ai/ui-web'
import { listSessions, revokeOtherSessions, revokeSession, useSession } from '@/lib/auth-client'

interface DeviceSession {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
  updatedAt: string
}

function isMobile(ua?: string | null) {
  return /iphone|ipad|android|mobile/i.test(ua ?? '')
}

function deviceLabel(ua?: string | null): string {
  const s = (ua ?? '').toLowerCase()
  const os =
    s.includes('iphone') || s.includes('ipad')
      ? 'iOS'
      : s.includes('android')
        ? 'Android'
        : s.includes('windows')
          ? 'Windows'
          : s.includes('mac')
            ? 'macOS'
            : s.includes('linux')
              ? 'Linux'
              : ''
  const browser = s.includes('edg')
    ? 'Edge'
    : s.includes('chrome')
      ? 'Chrome'
      : s.includes('firefox')
        ? 'Firefox'
        : s.includes('safari')
          ? 'Safari'
          : ''
  return [browser, os].filter(Boolean).join(' · ')
}

export default function DevicesPage() {
  const t = useTranslations('app.devices')
  const format = useFormatter()
  const { data: current } = useSession()
  const [sessions, setSessions] = useState<DeviceSession[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await listSessions().catch(() => null)
    setSessions((res?.data as DeviceSession[] | undefined) ?? [])
    setLoading(false)
  }, [])
  useEffect(() => {
    void load()
  }, [load])

  const currentToken = current?.session.token

  async function revoke(token: string) {
    setBusy(token)
    await revokeSession({ token }).catch(() => {})
    await load()
    setBusy(null)
  }
  async function revokeOthers() {
    setBusy('others')
    await revokeOtherSessions().catch(() => {})
    await load()
    setBusy(null)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{t('title')}</h1>
      <p className="mt-1 text-sm text-foreground-muted">{t('subtitle')}</p>

      {loading ? (
        <p className="mt-8 text-sm text-foreground-muted">{t('loading')}</p>
      ) : sessions.length === 0 ? (
        <p className="mt-8 text-sm text-foreground-muted">{t('empty')}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {sessions.map((s) => {
            const isCurrent = s.token === currentToken
            const Icon = isMobile(s.userAgent) ? Smartphone : Laptop
            return (
              <li
                key={s.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-muted text-foreground-muted">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">
                      {deviceLabel(s.userAgent) || t('unknownDevice')}
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
                        {t('thisDevice')}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-foreground-muted">
                    {(s.ipAddress ?? '—') +
                      ' · ' +
                      t('lastActive', {
                        time: format.dateTime(new Date(s.updatedAt), {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }),
                      })}
                  </div>
                </div>
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => revoke(s.token)}
                    disabled={busy === s.token}
                    className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
                  >
                    {t('revoke')}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {sessions.length > 1 && (
        <Button
          variant="secondary"
          size="md"
          className="mt-6"
          loading={busy === 'others'}
          onClick={revokeOthers}
        >
          {t('revokeOthers')}
        </Button>
      )}
    </div>
  )
}
