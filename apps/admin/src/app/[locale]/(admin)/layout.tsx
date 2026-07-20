// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { setRequestLocale } from 'next-intl/server'
import { AdminShell } from '@/components/shell/admin-shell'
import { resolveCapabilities } from '@/lib/roles'
import { requireStaff } from '@/lib/session'

/**
 * Staff gate for the whole admin area. Unauthenticated → /login; authenticated
 * non-staff → /login?denied=1. The API independently re-enforces per-resource
 * RBAC on every data call (R1/R6) — this gate is defence-in-depth + UX, not the
 * boundary. Capabilities are resolved once here and threaded into the shell so
 * nav/actions the caller can't use are hidden (still server-enforced).
 */
export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  const { user } = await requireStaff(locale)
  const caps = resolveCapabilities(user.role)

  return (
    <AdminShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role ?? null,
        image: user.image ?? null,
      }}
      caps={caps}
    >
      {children}
    </AdminShell>
  )
}
