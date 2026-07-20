'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Menu as AriaMenu,
  MenuItem,
  MenuTrigger,
  Popover,
} from 'react-aria-components';
import { buttonVariants, type ButtonProps } from './button';

export interface MenuOption {
  id: string;
  label: ReactNode;
  onAction?: () => void;
  isDisabled?: boolean;
}

export interface MenuProps {
  trigger: ReactNode;
  triggerVariant?: ButtonProps['variant'];
  items: MenuOption[];
}

/** Accessible dropdown menu (keyboard nav, typeahead, ARIA) from React Aria. */
export function Menu({ trigger, triggerVariant = 'secondary', items }: MenuProps) {
  return (
    <MenuTrigger>
      <AriaButton className={buttonVariants({ variant: triggerVariant })}>{trigger}</AriaButton>
      <Popover className="z-[var(--z-dropdown)] min-w-44 rounded-xl border border-border bg-surface p-1 shadow-lg outline-none data-[entering]:animate-[pop-in_.18s_var(--ease-out-soft)]">
        <AriaMenu className="outline-none">
          {items.map((it) => (
            <MenuItem
              key={it.id}
              id={it.id}
              onAction={it.onAction}
              isDisabled={it.isDisabled}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none transition-colors data-[focused]:bg-surface-muted data-[disabled]:cursor-default data-[disabled]:opacity-50"
            >
              {it.label}
            </MenuItem>
          ))}
        </AriaMenu>
      </Popover>
    </MenuTrigger>
  );
}
