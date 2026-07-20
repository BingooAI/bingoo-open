'use client'

import { Eye, EyeOff, Lock } from 'lucide-react'
import { forwardRef, useState, type ReactNode } from 'react'
import { Input, type InputProps } from './input'

interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  showLabel?: string
  hideLabel?: string
  /** Override the default lock left icon. */
  leftIcon?: ReactNode
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { showLabel = 'Show password', hideLabel = 'Hide password', leftIcon = <Lock />, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false)

  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      leftIcon={leftIcon}
      rightIcon={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="pointer-events-auto grid size-8 place-items-center rounded-full text-foreground-subtle transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
      {...props}
    />
  )
})
