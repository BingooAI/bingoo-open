'use client'

import { Delete } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export type MathLevel = 'preschool' | 'primary' | 'secondary' | 'advanced'

export interface MathFieldProps {
  /** Controlled linear maths string ("3/4", "x^2", "pi*r^2"). */
  value: string
  onChange: (value: string) => void
  level?: MathLevel
  /** Override the keyboard keys (display labels). */
  keys?: string[]
  placeholder?: string
  reveal?: { correct: boolean; answer: string }
  disabled?: boolean
  className?: string
}

/** Display label → string inserted into the value. */
const INSERT: Record<string, string> = {
  '−': '-',
  '×': '*',
  '÷': '/',
  '√': 'sqrt(',
  π: 'pi',
  xⁿ: '^',
  sin: 'sin(',
  cos: 'cos(',
  tan: 'tan(',
  log: 'log(',
  ln: 'ln(',
}

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
const PRESETS: Record<MathLevel, string[]> = {
  preschool: [...DIGITS, '+', '−', '⌫', 'C'],
  primary: [...DIGITS, '+', '−', '×', '÷', '.', '(', ')', '⌫', 'C'],
  secondary: [...DIGITS, '+', '−', '×', '÷', '.', '(', ')', 'xⁿ', '√', 'π', 'x', '⌫', 'C'],
  advanced: [
    ...DIGITS,
    '+',
    '−',
    '×',
    '÷',
    '.',
    '(',
    ')',
    'xⁿ',
    '√',
    'π',
    'x',
    'y',
    'sin',
    'cos',
    'tan',
    'log',
    'ln',
    'e',
    '⌫',
    'C',
  ],
}

/** Prettify a linear maths string for display: superscripts, √, ×, π. */
function pretty(s: string, keyBase = ''): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let n = 0
  const push = (node: ReactNode) => out.push(<Fragment key={`${keyBase}-${n++}`}>{node}</Fragment>)
  while (i < s.length) {
    if (s.startsWith('pi', i) && !/[a-z]/i.test(s[i + 2] ?? '')) {
      push('π')
      i += 2
      continue
    }
    if (s.startsWith('sqrt', i)) {
      push('√')
      i += 4
      continue
    }
    const c = s[i]!
    if (c === '*') {
      push('×')
      i++
      continue
    }
    if (c === '^') {
      const j = i + 1
      if (s[j] === '(') {
        let depth = 1
        let k = j + 1
        while (k < s.length && depth > 0) {
          if (s[k] === '(') depth++
          if (s[k] === ')') depth--
          k++
        }
        push(<sup>{pretty(s.slice(j + 1, k - 1), `${keyBase}s${i}`)}</sup>)
        i = k
      } else {
        let k = j
        while (k < s.length && /[0-9a-zA-Z.]/.test(s[k]!)) k++
        push(<sup>{pretty(s.slice(j, k), `${keyBase}s${i}`)}</sup>)
        i = k
      }
      continue
    }
    push(c)
    i++
  }
  return out
}

/**
 * Enter a maths expression with an on-screen keyboard. The value is a linear maths
 * string (canonical); `@bingoo/core` grades it (numeric or exact) and can export
 * LaTeX for advanced rendering later. The keyboard adapts to the audience level.
 * i18n-free.
 */
export function MathField({
  value,
  onChange,
  level = 'primary',
  keys,
  placeholder,
  reveal,
  disabled,
  className,
}: MathFieldProps) {
  const locked = !!reveal || disabled
  const layout = keys ?? PRESETS[level]

  const tap = (label: string) => {
    if (locked) return
    if (label === '⌫') return onChange(value.slice(0, -1))
    if (label === 'C') return onChange('')
    onChange(value + (INSERT[label] ?? label))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Display */}
      <div
        className={cn(
          tile({
            state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'quiet',
            size: 'none',
          }),
          'flex min-h-14 items-center overflow-x-auto px-4 text-2xl font-semibold',
          reveal == null && 'bg-surface text-foreground',
        )}
      >
        {value ? (
          <span className="whitespace-nowrap">{pretty(value)}</span>
        ) : (
          <span className="text-foreground-subtle">{placeholder ?? ' '}</span>
        )}
      </div>
      {reveal && !reveal.correct ? (
        <span className="text-sm font-semibold text-success">→ {pretty(reveal.answer, 'ans')}</span>
      ) : null}

      {/* Keyboard */}
      {!locked ? (
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6">
          {layout.map((k, i) => {
            const isDel = k === '⌫'
            const isClear = k === 'C'
            return (
              <button
                key={k}
                type="button"
                aria-label={isDel ? 'backspace' : k}
                onClick={() => tap(k)}
                style={stagger(i)}
                className={cn(
                  tile({ state: 'idle', size: 'none' }),
                  'grid h-11 place-items-center text-lg font-semibold motion-safe:animate-fade-up',
                  isDel && 'bg-surface-muted hover:border-danger',
                  isClear && 'border-danger/40 bg-danger-soft text-danger hover:border-danger',
                )}
              >
                {isDel ? <Delete className="size-5" /> : k}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
