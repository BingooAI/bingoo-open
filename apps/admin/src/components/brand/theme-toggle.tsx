'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

const OPTIONS = [
  { value: 'light', Icon: Sun, key: 'light' },
  { value: 'dark', Icon: Moon, key: 'dark' },
  { value: 'system', Icon: Monitor, key: 'system' },
] as const

/** Accessible theme switcher (light / dark / system) as a compact segmented control. */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme')
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div
      role="radiogroup"
      aria-label={t('label')}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full border border-border bg-surface-muted p-0.5',
        className,
      )}
    >
      {OPTIONS.map(({ value, Icon, key }) => {
        const active = mounted && theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(key)}
            title={t(key)}
            onClick={() => setTheme(value)}
            className={cn(
              'grid size-8 place-items-center rounded-full transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-surface text-primary shadow-sm' : 'text-foreground-muted hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
