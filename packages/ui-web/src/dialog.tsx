'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { buttonVariants, type ButtonProps } from './button'

export interface DialogProps {
  /** Content of the trigger button. */
  trigger: ReactNode
  triggerVariant?: ButtonProps['variant']
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  /** Footer render — receives `close` to dismiss the dialog. */
  footer?: (close: () => void) => ReactNode
  /** Accessible label for the close (X) button — pass a localized string. */
  closeAriaLabel?: string
  /** `alertdialog` = requires an explicit decision (no dismiss on click-outside). */
  role?: 'dialog' | 'alertdialog'
  /** Allow dismiss via click-outside / ESC. Forced off for alertdialog. */
  dismissable?: boolean
}

/**
 * Accessible modal dialog (focus-trap, ESC, click-outside, scroll-lock, ARIA)
 * from React Aria Components, skinned with Bingoo tokens. Text is caller-owned
 * so the package stays i18n-free.
 */
export function Dialog({
  trigger,
  triggerVariant = 'primary',
  title,
  description,
  children,
  footer,
  closeAriaLabel = 'Close',
  role = 'dialog',
  dismissable = true,
}: DialogProps) {
  const canDismiss = role === 'alertdialog' ? false : dismissable
  return (
    <DialogTrigger>
      <AriaButton className={buttonVariants({ variant: triggerVariant })}>{trigger}</AriaButton>
      <ModalOverlay
        isDismissable={canDismiss}
        className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-overlay p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_.2s] data-[exiting]:animate-[fade-out_.15s]"
      >
        <Modal className="w-full max-w-md rounded-[var(--radius-card,2rem)] border border-border bg-surface shadow-xl outline-none data-[entering]:animate-[pop-in_.3s_var(--ease-spring)]">
          <AriaDialog role={role} className="relative p-6 outline-none">
            {({ close }) => (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={close}
                  aria-label={closeAriaLabel}
                  className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" />
                </button>
                <div className="flex flex-col gap-1 pr-8">
                  <Heading slot="title" className="font-display text-lg font-bold text-foreground">
                    {title}
                  </Heading>
                  {description ? <p className="text-sm text-foreground-muted">{description}</p> : null}
                </div>
                {children}
                {footer ? <div className="flex justify-end gap-2">{footer(close)}</div> : null}
              </div>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}

/** Confirmation dialog — requires an explicit choice (no click-outside dismiss). */
export function AlertDialog(props: Omit<DialogProps, 'role'>) {
  return <Dialog {...props} role="alertdialog" />
}
