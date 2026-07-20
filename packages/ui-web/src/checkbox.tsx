// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { Check } from 'lucide-react'
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { className, label, description, id, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2.5',
        props.disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <span className="relative mt-0.5 inline-grid shrink-0 place-items-center">
        <input ref={ref} id={id} type="checkbox" className="peer sr-only" {...props} />
        <span
          aria-hidden
          className="grid size-5 place-items-center rounded-[7px] border-2 border-border-strong bg-surface text-white transition-all peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background"
        >
          <Check
            className="size-3.5 scale-0 transition-transform duration-150 peer-checked:scale-100"
            strokeWidth={3.5}
          />
        </span>
      </span>
      {(label || description) && (
        <span className="flex flex-col gap-0.5">
          {label && <span className="text-sm leading-snug text-foreground">{label}</span>}
          {description && <span className="text-xs text-foreground-muted">{description}</span>}
        </span>
      )}
    </label>
  )
})
