'use client'

import type { TableFillQuestion } from '@bingoo/core'
import { cn } from './lib/cn'

export interface TableFillProps {
  columns: TableFillQuestion['columns']
  rows: TableFillQuestion['rows']
  /** Controlled fills: blankId → value. */
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  /** After checking: blankId → correct. */
  reveal?: Record<string, boolean>
  disabled?: boolean
  label?: string
  className?: string
}

/** Complete a data table by filling the blank cells (Cambridge tables:
 * prediction/result, size/colour…). Controlled + i18n-free; grading in core. */
export function TableFill({
  columns,
  rows,
  values,
  onChange,
  reveal,
  disabled,
  label,
  className,
}: TableFillProps) {
  const locked = !!reveal || disabled
  const hasRowHeaders = rows.some((r) => r.header != null)

  return (
    <div className={cn('max-w-full overflow-x-auto', className)}>
      <table className="w-full border-collapse text-sm" aria-label={label}>
        <thead>
          <tr>
            {hasRowHeaders ? <th className="border border-border bg-surface-muted p-2" /> : null}
            {columns.map((c, i) => (
              <th
                key={i}
                className="border border-border bg-surface-muted p-2 font-display font-bold text-foreground"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {hasRowHeaders ? (
                <th className="border border-border bg-surface-muted p-2 text-left font-semibold text-foreground">
                  {row.header}
                </th>
              ) : null}
              {row.cells.map((cell, ci) => {
                if (cell.blankId) {
                  const ok = reveal?.[cell.blankId]
                  return (
                    <td key={ci} className="border border-border p-1">
                      <input
                        value={values[cell.blankId] ?? ''}
                        disabled={locked}
                        onChange={(e) => onChange({ ...values, [cell.blankId!]: e.target.value })}
                        aria-label={columns[ci]}
                        className={cn(
                          'w-full min-w-16 rounded-md border-2 bg-surface px-2 py-1 text-center font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          reveal == null && 'border-border focus-visible:border-primary',
                          ok === true && 'border-success bg-success-soft text-success',
                          ok === false && 'border-danger bg-danger-soft text-danger',
                        )}
                      />
                    </td>
                  )
                }
                return (
                  <td key={ci} className="border border-border p-2 text-center text-foreground">
                    {cell.text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
