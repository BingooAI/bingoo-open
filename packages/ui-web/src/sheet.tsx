'use client';

import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog as AriaDialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components';
import { buttonVariants, type ButtonProps } from './button';
import { cn } from './lib/cn';

export interface SheetProps {
  trigger: ReactNode;
  triggerVariant?: ButtonProps['variant'];
  side?: 'right' | 'left';
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: (close: () => void) => ReactNode;
  closeAriaLabel?: string;
}

// Static per-side classes so Tailwind can see the animation utilities.
const SIDE = {
  right:
    'right-0 rounded-l-2xl border-l data-[entering]:animate-[slide-in-right_.28s_var(--ease-out-soft)] data-[exiting]:animate-[slide-out-right_.24s_ease-in]',
  left: 'left-0 rounded-r-2xl border-r data-[entering]:animate-[slide-in-left_.28s_var(--ease-out-soft)] data-[exiting]:animate-[slide-out-left_.24s_ease-in]',
} as const;

/** Side drawer / sheet — a modal that slides in from an edge (React Aria). */
export function Sheet({
  trigger,
  triggerVariant = 'secondary',
  side = 'right',
  title,
  description,
  children,
  footer,
  closeAriaLabel = 'Close',
}: SheetProps) {
  return (
    <DialogTrigger>
      <AriaButton className={buttonVariants({ variant: triggerVariant })}>{trigger}</AriaButton>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-[var(--z-modal)] bg-overlay backdrop-blur-sm data-[entering]:animate-[fade-in_.2s] data-[exiting]:animate-[fade-out_.15s]"
      >
        <Modal
          className={cn(
            'fixed inset-y-0 h-full w-80 max-w-[85vw] border-border bg-surface shadow-xl outline-none',
            SIDE[side],
          )}
        >
          <AriaDialog className="relative flex h-full flex-col gap-4 p-6 outline-none">
            {({ close }) => (
              <>
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
                  {description ? (
                    <p className="text-sm text-foreground-muted">{description}</p>
                  ) : null}
                </div>
                <div className="flex-1 overflow-y-auto">{children}</div>
                {footer ? <div className="flex justify-end gap-2">{footer(close)}</div> : null}
              </>
            )}
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  );
}
