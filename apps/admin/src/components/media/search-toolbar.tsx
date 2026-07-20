'use client'

import { Search, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Input, Select } from '@bingoo.ai/ui-web'
import type { MediaKind, ModerationStatus } from '@bingoo.ai/core'
import { cn } from '@/lib/cn'
import { KindIcon } from './kind-icon'

const KINDS: MediaKind[] = ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'ANIMATION', 'FONT', 'ARCHIVE', 'OTHER']

const MODERATIONS: ModerationStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']

export interface SearchState {
  text: string
  kind: MediaKind[]
  locale: string // '' = any
  /** Review state; '' = any. Staff-only facet — the server ignores it otherwise. */
  moderation: ModerationStatus | ''
  /** Natural-language mode: the LLM parses `text` into a structured query. */
  nl: boolean
}

export const EMPTY_SEARCH: SearchState = {
  text: '',
  kind: [],
  locale: '',
  moderation: '',
  nl: false,
}

/** Active only in structured mode (NL mode is driven by explicit submit). */
export function isSearchActive(s: SearchState): boolean {
  return s.text.trim().length > 0 || s.kind.length > 0 || s.locale !== '' || s.moderation !== ''
}

export function SearchToolbar({
  value,
  onChange,
  onSubmit,
  locales,
}: {
  value: SearchState
  onChange: (next: SearchState) => void
  /** Called on Enter in NL mode to run the (LLM-backed) search. */
  onSubmit: () => void
  locales: string[]
}) {
  const t = useTranslations('admin.library')
  const tk = useTranslations('admin.kind')
  const tm = useTranslations('admin.moderation.state')

  const toggleKind = (k: MediaKind) => {
    const has = value.kind.includes(k)
    onChange({ ...value, kind: has ? value.kind.filter((x) => x !== k) : [...value.kind, k] })
  }

  const active = isSearchActive(value)

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            type="search"
            value={value.text}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            onKeyDown={(e) => {
              if (value.nl && e.key === 'Enter') {
                e.preventDefault()
                onSubmit()
              }
            }}
            placeholder={value.nl ? t('nlPlaceholder') : t('searchPlaceholder')}
            leftIcon={value.nl ? <Sparkles /> : <Search />}
            aria-label={value.nl ? t('nlPlaceholder') : t('searchPlaceholder')}
          />
        </div>

        {/* Natural-language toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={value.nl}
          onClick={() => onChange({ ...value, nl: !value.nl })}
          title={t('nlToggle')}
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border px-3 text-sm font-semibold transition-colors',
            value.nl
              ? 'border-primary bg-primary-soft text-primary-soft-foreground'
              : 'border-border text-foreground-muted hover:bg-surface-muted hover:text-foreground',
          )}
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">{t('nlToggle')}</span>
        </button>

        {!value.nl && (
          <Select
            aria-label={t('localeFilter')}
            value={value.locale}
            onChange={(e) => onChange({ ...value, locale: e.target.value })}
            className="sm:w-40"
          >
            <option value="">{t('localeAll')}</option>
            {locales.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </Select>
        )}

        {!value.nl && (
          <Select
            aria-label={t('moderationFilter')}
            value={value.moderation}
            onChange={(e) => onChange({ ...value, moderation: e.target.value as ModerationStatus | '' })}
            className="sm:w-44"
          >
            <option value="">{t('moderationAll')}</option>
            {MODERATIONS.map((m) => (
              <option key={m} value={m}>
                {tm(m)}
              </option>
            ))}
          </Select>
        )}

        {!value.nl && active && (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_SEARCH })}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-border px-3 text-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            <X className="size-4" />
            {t('clearFilters')}
          </button>
        )}
      </div>

      {value.nl ? (
        <p className="text-xs text-foreground-subtle">{t('nlHint')}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('kindFilter')}>
          {KINDS.map((k) => {
            const on = value.kind.includes(k)
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                  on
                    ? 'border-primary bg-primary-soft text-primary-soft-foreground'
                    : 'border-border text-foreground-muted hover:bg-surface-muted hover:text-foreground',
                )}
              >
                <KindIcon kind={k} className="size-3.5" />
                {tk(k)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
