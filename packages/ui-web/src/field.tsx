import { AlertCircle } from 'lucide-react'
import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { Label } from './label'

export interface FieldProps {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  className?: string
  /** A single form control (Input, PasswordInput, Textarea, Select…). */
  children: ReactNode
}

/**
 * Accessible form field: renders a label, a control, and a hint OR error, and
 * auto-wires them with a shared id + aria attributes (`aria-invalid`,
 * `aria-describedby`, `htmlFor`). No prop drilling required at the call site:
 *
 *   <Field label={t('email')} error={errors.email}><Input name="email" /></Field>
 */
export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const base = useId()
  const controlId = `${base}-control`
  const hintId = `${base}-hint`
  const errorId = `${base}-error`
  const invalid = Boolean(error)

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, {
        id: (children.props as { id?: string }).id ?? controlId,
        invalid: invalid || (children.props as { invalid?: boolean }).invalid,
        'aria-describedby': describedBy,
      })
    : children

  const forId = isValidElement(children) ? ((children.props as { id?: string }).id ?? controlId) : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={forId} required={required}>
          {label}
        </Label>
      )}
      {control}
      {hint && !error && (
        <p id={hintId} className="text-xs text-foreground-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
