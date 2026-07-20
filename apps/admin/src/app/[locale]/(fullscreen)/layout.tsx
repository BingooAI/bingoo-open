import { setRequestLocale } from 'next-intl/server'
import { requireStaff } from '@/lib/session'

/**
 * Full-screen staff routes — the Studio.
 *
 * The editor has its own chrome (title, back, tool rails, timeline) and needs the
 * whole viewport. Under the admin shell it drew a SECOND header on top of the
 * first: two title bars, two back affordances, and the shell's controls buried
 * underneath. An editor is not a page inside a dashboard.
 *
 * Same staff gate as the admin area — only the shell is gone, not the guard.
 */
export default async function FullscreenLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  setRequestLocale(locale)
  await requireStaff(locale)
  return <>{children}</>
}
