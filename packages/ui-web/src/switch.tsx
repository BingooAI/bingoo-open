// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { className, label, id, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-3',
        props.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="relative inline-flex">
        <input ref={ref} id={id} type="checkbox" role="switch" className="peer sr-only" {...props} />
        <span
          aria-hidden
          className="h-6 w-11 rounded-full bg-border-strong transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring peer-checked:translate-x-5"
        />
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </label>
  )
})
