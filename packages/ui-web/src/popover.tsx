'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Popover as AriaPopover,
} from 'react-aria-components';
import { buttonVariants, type ButtonProps } from './button';

export interface PopoverProps {
  trigger: ReactNode;
  triggerVariant?: ButtonProps['variant'];
  children: ReactNode;
}

/** Accessible popover (positioning, focus, dismiss) from React Aria, skinned. */
export function Popover({ trigger, triggerVariant = 'secondary', children }: PopoverProps) {
  return (
    <DialogTrigger>
      <AriaButton className={buttonVariants({ variant: triggerVariant })}>{trigger}</AriaButton>
      <AriaPopover className="z-[var(--z-popover)] max-w-xs rounded-xl border border-border bg-surface p-4 shadow-lg outline-none data-[entering]:animate-[pop-in_.2s_var(--ease-out-soft)]">
        <Dialog className="text-sm text-foreground outline-none">{children}</Dialog>
      </AriaPopover>
    </DialogTrigger>
  );
}
