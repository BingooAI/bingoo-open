'use client'

import { useState } from 'react'
import { cn } from './lib/cn'
import { tile, tileState } from './lib/interactive'

export interface ProofreadTextProps {
  /** The text, split into tokens (words/punctuation). */
  tokens: string[]
  /** Controlled: token index (as a string) → the learner's correction. */
  fixes: Record<string, string>
  onChange: (fixes: Record<string, string>) => void
  reveal?: {
    marks: Record<string, { ok: boolean; expected?: string }>
    errors: Record<string, string>
  }
  disabled?: boolean
  /** A11y/UI copy: the inline editor's placeholder. */
  placeholder?: string
  className?: string
}

/**
 * Proofreading — tap a word you think is wrong and type the correction ("I like
 * play outdoors" → "playing"). Also covers punctuation edits. `@bingoo/core`
 * grades it and PENALISES editing a word that was never wrong. i18n-free.
 */
export function ProofreadText({
  tokens,
  fixes,
  onChange,
  reveal,
  disabled,
  placeholder,
  className,
}: ProofreadTextProps) {
  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const locked = !!reveal || disabled

  const open = (i: number) => {
    if (locked) return
    setEditing(i)
    setDraft(fixes[String(i)] ?? tokens[i] ?? '')
  }
  const commit = () => {
    if (editing === null) return
    const key = String(editing)
    const next = { ...fixes }
    const v = draft.trim()
    // Typing the original back (or nothing) clears the edit.
    if (v === '' || v === tokens[editing]) delete next[key]
    else next[key] = v
    onChange(next)
    setEditing(null)
  }

  return (
    <div
      className={cn(
        tile({ state: 'quiet', size: 'none' }),
        'flex flex-wrap items-center gap-x-1.5 gap-y-2 p-4 text-lg leading-loose',
        className,
      )}
    >
      {tokens.map((tok, i) => {
        const key = String(i)
        const fixed = fixes[key]
        const mark = reveal?.marks[key]
        const missed = reveal && reveal.errors[key] !== undefined && !fixed

        if (editing === i) {
          return (
            <input
              key={i}
              autoFocus
              value={draft}
              placeholder={placeholder}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit()
                if (e.key === 'Escape') setEditing(null)
              }}
              size={Math.max(4, draft.length)}
              className="rounded-md border-2 border-primary bg-surface px-1.5 py-0.5 text-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          )
        }

        return (
          <button
            key={i}
            type="button"
            disabled={locked}
            onClick={() => open(i)}
            className={cn(
              tile({
                state: tileState({
                  selected: !!fixed,
                  revealed: !!reveal,
                  correct: mark?.ok === true,
                  missed: !!missed,
                }),
                size: 'none',
              }),
              'px-1 py-0.5',
              (fixed || mark) && 'font-semibold',
              // The error the learner walked straight past still gets its wavy underline.
              missed && 'underline decoration-wavy',
            )}
          >
            {fixed ? (
              <>
                <span className="mr-1 text-foreground-subtle line-through">{tok}</span>
                {fixed}
              </>
            ) : (
              tok
            )}
            {/* When revealed, show what it should have been. */}
            {reveal && mark?.expected && mark.ok === false ? (
              <span className="ml-1 text-sm font-bold text-success">→ {mark.expected}</span>
            ) : null}
            {missed ? (
              <span className="ml-1 text-sm font-bold text-success">→ {reveal!.errors[key]}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
