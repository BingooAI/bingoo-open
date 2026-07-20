// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Renders error styling; wire real messaging via <Field>. */
  invalid?: boolean
  inputSize?: 'md' | 'lg'
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leftIcon, rightIcon, invalid, inputSize = 'md', disabled, ...props },
  ref,
) {
  const height = inputSize === 'lg' ? 'h-13 text-base' : 'h-11 text-sm'

  return (
    <div
      className={cn(
        // overflow-hidden keeps the field's own paint (autofill / selection) inside the radius.
        'group relative flex items-center overflow-hidden rounded-2xl border bg-surface transition-colors',
        'border-border focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/45',
        invalid && 'border-danger focus-within:border-danger focus-within:ring-danger/35',
        disabled && 'opacity-60',
      )}
    >
      {leftIcon && (
        <span className="pointer-events-none grid place-items-center pl-3.5 text-foreground-subtle [&_svg]:size-5">
          {leftIcon}
        </span>
      )}
      <input
        ref={ref}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(
          'peer w-full min-w-0 bg-transparent px-4 font-sans text-foreground outline-none',
          'placeholder:text-foreground-subtle',
          height,
          leftIcon && 'pl-2.5',
          rightIcon && 'pr-2.5',
          className,
        )}
        {...props}
      />
      {rightIcon && (
        <span className="grid place-items-center pr-3.5 text-foreground-subtle [&_svg]:size-5">
          {rightIcon}
        </span>
      )}
    </div>
  )
})
