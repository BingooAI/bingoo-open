// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { cn } from './lib/cn'

export type StudentStatus = 'active' | 'idle' | 'struggling' | 'done'

export interface RosterStudent {
  id: string
  name: string
  avatarSrc?: string | null
  /** Localized status text shown as a chip. */
  statusLabel?: ReactNode
  status?: StudentStatus
  /** Right-aligned metric (score, minutes…), pre-formatted. */
  metric?: ReactNode
}

export interface StudentRosterProps {
  students: RosterStudent[]
  onSelect?: (id: string) => void
  className?: string
}

const STATUS_CHIP: Record<StudentStatus, string> = {
  active: 'bg-success-soft text-success',
  idle: 'bg-surface-muted text-foreground-muted',
  struggling: 'bg-danger-soft text-danger',
  done: 'bg-primary-soft text-primary',
}

/** A teacher's student list: avatar, name, status chip, metric. Rows are
 * buttons when `onSelect` is given. i18n-free (labels via props). */
export function StudentRoster({ students, onSelect, className }: StudentRosterProps) {
  return (
    <ul
      className={cn(
        'flex w-full flex-col divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface',
        className,
      )}
    >
      {students.map((s) => {
        const Row = onSelect ? 'button' : 'div'
        return (
          <li key={s.id}>
            <Row
              type={onSelect ? 'button' : undefined}
              onClick={onSelect ? () => onSelect(s.id) : undefined}
              className={cn(
                'flex w-full items-center gap-3 p-3 text-left',
                onSelect &&
                  'transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
              )}
            >
              <Avatar name={s.name} src={s.avatarSrc} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{s.name}</span>
              {s.statusLabel ? (
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold',
                    STATUS_CHIP[s.status ?? 'idle'],
                  )}
                >
                  {s.statusLabel}
                </span>
              ) : null}
              {s.metric ? (
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{s.metric}</span>
              ) : null}
            </Row>
          </li>
        )
      })}
    </ul>
  )
}
