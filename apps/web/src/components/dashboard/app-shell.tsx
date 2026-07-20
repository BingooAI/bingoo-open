'use client'

import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  HelpCircle,
  Home,
  LogOut,
  Menu,
  MessageCircle,
  MonitorSmartphone,
  Search,
  Settings,
  Sparkles,
  Target,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { Logo } from '@/components/brand/logo'
import { LocaleSwitcher } from '@/components/brand/locale-switcher'
import { ThemeToggle } from '@/components/brand/theme-toggle'
import { Avatar } from '@bingoo/ui-web'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/cn'

export interface SessionUser {
  name: string
  email: string | null
  role: string | null
  image: string | null
}

type NavItem = { key: string; Icon: LucideIcon; href?: string }

const NAV: Record<'student' | 'parent', NavItem[]> = {
  student: [
    { key: 'home', Icon: Home, href: '/student' },
    { key: 'learn', Icon: BookOpen },
    { key: 'practice', Icon: Target },
    { key: 'achievements', Icon: Trophy },
    { key: 'schedule', Icon: CalendarDays },
  ],
  parent: [
    { key: 'home', Icon: Home, href: '/parent' },
    { key: 'reports', Icon: BarChart3 },
    { key: 'children', Icon: Users },
    { key: 'schedule', Icon: CalendarDays },
    { key: 'messages', Icon: MessageCircle },
  ],
}

const FOOTER_NAV: NavItem[] = [
  { key: 'devices', Icon: MonitorSmartphone, href: '/devices' },
  { key: 'settings', Icon: Settings },
  { key: 'help', Icon: HelpCircle },
]

export function AppShell({ children, user }: { children: ReactNode; user: SessionUser }) {
  const pathname = usePathname()
  const router = useRouter()
  const navRole: 'student' | 'parent' = pathname.startsWith('/parent') ? 'parent' : 'student'
  const tr = useTranslations('auth.register')
  const display = {
    name: user.name,
    role: navRole === 'parent' ? tr('roleParent') : tr('roleStudent'),
    image: user.image,
  }
  const [drawer, setDrawer] = useState(false)
  const [active, setActive] = useState('home')
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    await signOut().catch(() => {})
    router.push('/login')
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <SidebarContent
          role={navRole}
          active={active}
          setActive={setActive}
          user={display}
          onLogout={logout}
          loggingOut={loggingOut}
        />
      </aside>

      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-72 animate-fade-up flex-col border-r border-border bg-surface">
            <SidebarContent
              role={navRole}
              active={active}
              setActive={(k) => {
                setActive(k)
                setDrawer(false)
              }}
              user={display}
              onLogout={logout}
              loggingOut={loggingOut}
              onClose={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-col">
        <Topbar onMenu={() => setDrawer(true)} user={display} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  role,
  active,
  setActive,
  user,
  onLogout,
  loggingOut,
  onClose,
}: {
  role: 'student' | 'parent'
  active: string
  setActive: (k: string) => void
  user: { name: string; role: string; image: string | null }
  onLogout: () => void
  loggingOut: boolean
  onClose?: () => void
}) {
  const t = useTranslations()
  const pathname = usePathname()

  const renderItem = (item: NavItem) => {
    const isActive = item.href ? pathname === item.href : active === item.key
    const className = cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
      isActive
        ? 'bg-primary-soft text-primary-soft-foreground'
        : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
    )
    const inner = (
      <>
        <item.Icon className="size-5 shrink-0" />
        {t(`app.nav.${item.key}`)}
      </>
    )
    return item.href ? (
      <Link key={item.key} href={item.href} onClick={() => setActive(item.key)} className={className}>
        {inner}
      </Link>
    ) : (
      <button key={item.key} type="button" onClick={() => setActive(item.key)} className={className}>
        {inner}
      </button>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Bingoo">
          <Logo height={28} />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.actions.close')}
            className="grid size-9 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Dashboard">
        {NAV[role].map(renderItem)}
        <div className="my-3 h-px bg-border" />
        {FOOTER_NAV.map(renderItem)}
      </nav>

      {/* upgrade card */}
      <div className="p-3">
        <div className="rounded-2xl bg-gradient-brand p-4 text-white shadow-pop">
          <Sparkles className="size-5" />
          <p className="mt-2 font-display text-sm font-bold">{t('app.upgrade.title')}</p>
          <p className="mt-1 text-xs text-white/80">{t('app.upgrade.subtitle')}</p>
          <button className="mt-3 w-full rounded-full bg-white/95 py-2 text-xs font-bold text-primary transition-colors hover:bg-white">
            {t('app.upgrade.cta')}
          </button>
        </div>
      </div>

      {/* user */}
      <div className="flex items-center gap-3 border-t border-border p-4">
        <Avatar name={user.name} src={user.image} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
          <div className="truncate text-xs text-foreground-muted">{user.role}</div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          disabled={loggingOut}
          aria-label={t('app.actions.logout')}
          className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </>
  )
}

function Topbar({ onMenu, user }: { onMenu: () => void; user: { name: string; image: string | null } }) {
  const t = useTranslations('app')
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label="Menu"
        className="grid size-10 place-items-center rounded-full text-foreground hover:bg-surface-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <label className="relative hidden max-w-sm flex-1 items-center sm:flex">
        <Search className="pointer-events-none absolute left-3.5 size-4 text-foreground-subtle" />
        <input
          type="search"
          placeholder={t('searchPlaceholder')}
          className="h-10 w-full rounded-full border border-border bg-surface-muted pl-10 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-foreground-subtle focus:border-primary focus:bg-surface focus:ring-2 focus:ring-ring/40"
        />
      </label>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={t('notifications')}
          className="relative grid size-10 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted hover:text-foreground"
        >
          <Bell className="size-5" />
          <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-accent-coral ring-2 ring-background" />
        </button>
        <div className="hidden sm:block">
          <LocaleSwitcher />
        </div>
        <ThemeToggle />
        <Avatar name={user.name} src={user.image} size="sm" className="ml-1" />
      </div>
    </header>
  )
}
