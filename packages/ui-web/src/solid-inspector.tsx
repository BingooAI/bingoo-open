'use client'

import { solidPartIds, makeSolid, type Solid3DName, type SolidPartKind } from '@bingoo/core'
import { useMemo } from 'react'
import { GeoShape, type GeoShapePart } from './geo-shape'
import { cn } from './lib/cn'
import { POP, SHAKE } from './lib/interactive'

export interface SolidInspectorProps {
  shape: Solid3DName
  task: SolidPartKind
  /** Controlled: ids of the parts tapped so far. */
  selected: string[]
  onChange: (selected: string[]) => void
  /** Localized: "Found {n} of {total}" is built by the caller from these. */
  labels?: { found: string; hint?: string }
  reveal?: { correct: boolean; expected: string[]; count: number }
  disabled?: boolean
  className?: string
}

/**
 * Tap every face / curved surface / edge / vertex of a solid — you must TURN it
 * to reach the hidden ones. Counting + grading live in `@bingoo/core`
 * (`solidPartIds`), so the answer is derived from the geometry, never authored.
 * i18n-free.
 */
export function SolidInspector({
  shape,
  task,
  selected,
  onChange,
  labels,
  reveal,
  disabled,
  className,
}: SolidInspectorProps) {
  const locked = !!reveal || disabled
  const total = useMemo(() => solidPartIds(makeSolid(shape), task).length, [shape, task])
  const found = selected.length

  const pick = (p: GeoShapePart) => {
    if (locked || p.kind !== task) return
    onChange(selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id])
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <GeoShape
        kind="3d"
        name={shape}
        size={220}
        pick={task}
        selected={reveal ? reveal.expected : selected}
        onPick={pick}
      />
      <span
        className={cn(
          'text-lg font-bold tabular-nums',
          reveal ? (reveal.correct ? 'text-success' : 'text-danger') : 'text-foreground',
          reveal && (reveal.correct ? POP : SHAKE),
        )}
      >
        {labels?.found ?? 'Found'}: {reveal ? reveal.count : found} / {total}
      </span>
      {labels?.hint && !locked ? (
        <span className="text-center text-xs text-foreground-muted">{labels.hint}</span>
      ) : null}
    </div>
  )
}
