'use client'

import { Check, Globe } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { cn } from '@/lib/cn'
import { usePathname, useRouter } from '@/i18n/navigation'
import { localeMeta, routing, type Locale } from '@/i18n/routing'

/** Locale dropdown that preserves the current path (scales to N locales). */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations('locale')
  const locale = useLocale() as Locale
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const select = (next: Locale) => {
    setOpen(false)
    if (next === locale) return
    startTransition(() => router.replace(pathname, { locale: next }))
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('switch')}
        disabled={isPending}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Globe className="size-4 text-foreground-muted" />
        {locale.toUpperCase()}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('label')}
          className="absolute right-0 z-50 mt-2 min-w-44 animate-pop-in overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-lg"
        >
          {routing.locales.map((code) => {
            const active = code === locale
            return (
              <li key={code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => select(code)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary-soft font-semibold text-primary-soft-foreground'
                      : 'hover:bg-surface-muted',
                  )}
                >
                  {localeMeta[code].native}
                  {active && <Check className="size-4" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
