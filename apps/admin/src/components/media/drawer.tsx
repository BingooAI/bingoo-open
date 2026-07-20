// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components'
import { cn } from '@/lib/cn'

/**
 * Controlled right-side drawer (React Aria Modal) — focus-trap, ESC, scroll-lock,
 * ARIA out of the box. Unlike ui-web's trigger-based Sheet, this is driven by
 * `isOpen`/`onClose` state so it can open for a selected item (asset detail).
 * Not dismissable on click-outside by default — an admin editing metadata
 * shouldn't lose the panel by a stray click; the X / ESC close it.
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  closeAriaLabel = 'Close',
  isDismissable = false,
  width = 'max-w-md',
}: {
  isOpen: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  closeAriaLabel?: string
  isDismissable?: boolean
  width?: string
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      isDismissable={isDismissable}
      isKeyboardDismissDisabled={false}
      className="fixed inset-0 z-50 flex justify-end bg-overlay backdrop-blur-sm data-[entering]:animate-fade-in data-[exiting]:animate-fade-out"
    >
      <Modal
        className={cn(
          'flex h-full w-full flex-col border-l border-border bg-surface shadow-xl',
          'data-[entering]:animate-[slide-in-right_.28s_var(--ease-out-soft)]',
          'data-[exiting]:animate-[slide-out-right_.24s_ease-in]',
          width,
        )}
      >
        <Dialog className="flex h-full flex-col outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <Heading slot="title" className="truncate font-display text-lg font-bold text-foreground">
                {title}
              </Heading>
              {description ? (
                <p className="mt-0.5 truncate text-sm text-foreground-muted">{description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeAriaLabel}
              className="grid size-9 shrink-0 place-items-center rounded-full text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

          {footer ? <div className="border-t border-border px-5 py-4">{footer}</div> : null}
        </Dialog>
      </Modal>
    </ModalOverlay>
  )
}
