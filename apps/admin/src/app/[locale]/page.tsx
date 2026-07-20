import { setRequestLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

// The admin app has no landing page — send everyone to the media library, which
// is itself behind the staff gate (redirects to /login when needed).
export default async function AdminIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  redirect({ href: '/media', locale })
}
