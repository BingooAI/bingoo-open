// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import {
  Presentation,
  BookOpen,
  GitCompareArrows,
  LayoutDashboard,
  GraduationCap,
  Images,
  LogOut,
  Menu,
  Network,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { Avatar } from '@bingoo.ai/ui-web'
import { Logo } from '@/components/brand/logo'
import { LocaleSwitcher } from '@/components/brand/locale-switcher'
import { ThemeToggle } from '@/components/brand/theme-toggle'
import { Link, usePathname, useRouter } from '@/i18n/navigation'
import { signOut } from '@/lib/auth-client'
import { cn } from '@/lib/cn'
import type { StaffCapabilities } from '@/lib/roles'

export interface ShellUser {
  name: string
  email: string | null
  role: string | null
  image: string | null
}

type NavItem = {
  key: string
  Icon: LucideIcon
  href: string
  /** Gate visibility by capability; default = any staff. */
  show?: (caps: StaffCapabilities) => boolean
  /** Active only on the exact path — for a section whose href prefixes its siblings. */
  exact?: boolean
}

const NAV: NavItem[] = [
  { key: 'library', Icon: Images, href: '/media' },
  {
    key: 'authoring',
    Icon: GraduationCap,
    href: '/authoring',
    show: (c) => c.canManageContent,
    exact: true,
  },
  {
    key: 'frameworks',
    Icon: Network,
    href: '/authoring/frameworks',
    show: (c) => c.canManageContent,
  },
  { key: 'courses', Icon: BookOpen, href: '/authoring/courses', show: (c) => c.canManageContent },
  {
    key: 'align',
    Icon: GitCompareArrows,
    href: '/authoring/align',
    show: (c) => c.canManageContent,
  },
  {
    key: 'coverage',
    Icon: LayoutDashboard,
    href: '/authoring/coverage',
    show: (c) => c.canManageContent,
  },
  { key: 'explainer', Icon: Presentation, href: '/explainer', show: (c) => c.canManageContent },
]

export function AdminShell({
  children,
  user,
  caps,
}: {
  children: ReactNode
  user: ShellUser
  caps: StaffCapabilities
}) {
  const [drawer, setDrawer] = useState(false)
  const items = NAV.filter((item) => !item.show || item.show(caps))

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface lg:flex">
        <SidebarContent items={items} user={user} />
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
              items={items}
              user={user}
              onClose={() => setDrawer(false)}
              onNavigate={() => setDrawer(false)}
            />
          </aside>
        </div>
      )}

      {/* main column */}
      <div className="flex min-w-0 flex-col">
        <Topbar onMenu={() => setDrawer(true)} user={user} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {/* Khu công cụ staff — nhiều bảng, đồ thị, đối chiếu — nên tận dụng bề rộng màn lớn.
              Cap ở 96rem (1536px) thay vì 7xl (1280px): rộng hơn nhưng vẫn giữ độ dài dòng đọc được. */}
          <div className="mx-auto w-full max-w-[96rem]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function SidebarContent({
  items,
  user,
  onClose,
  onNavigate,
}: {
  items: NavItem[]
  user: ShellUser
  onClose?: () => void
  onNavigate?: () => void
}) {
  const t = useTranslations('admin')
  const tc = useTranslations('common')
  const pathname = usePathname()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  async function logout() {
    setLoggingOut(true)
    await signOut().catch(() => {})
    router.push('/login')
  }

  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <Logo variant="mark" height={26} />
          <span className="font-display text-sm font-bold text-foreground-muted">{t('brand')}</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={tc('actions.close')}
            className="grid size-9 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label={t('nav.label')}>
        {items.map((item) => {
          // A section is active for its exact path or any nested path under it —
          // unless `exact`, for a section whose href prefixes a sibling's.
          const isActive = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`))
          return (
            <Link
              key={item.key}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'bg-primary-soft text-primary-soft-foreground'
                  : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <item.Icon className="size-5 shrink-0" />
              {t(`nav.${item.key}`)}
            </Link>
          )
        })}
      </nav>

      {/* user */}
      <div className="flex items-center gap-3 border-t border-border p-4">
        <Avatar name={user.name} src={user.image} size="md" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-foreground">{user.name}</div>
          <div className="truncate text-xs text-foreground-muted">{user.email ?? ''}</div>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          aria-label={t('actions.logout')}
          title={t('actions.logout')}
          className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
        >
          <LogOut className="size-5" />
        </button>
      </div>
    </>
  )
}

function Topbar({ onMenu, user }: { onMenu: () => void; user: ShellUser }) {
  const t = useTranslations('admin')
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onMenu}
        aria-label={t('nav.open')}
        className="grid size-10 place-items-center rounded-full text-foreground hover:bg-surface-muted lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <Link href="/media" className="flex items-center gap-2 lg:hidden" aria-label={t('brand')}>
        <Logo variant="mark" height={24} />
      </Link>

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:block">
          <LocaleSwitcher />
        </div>
        <ThemeToggle />
        <Avatar name={user.name} src={user.image} size="sm" className="ml-1" />
      </div>
    </header>
  )
}
