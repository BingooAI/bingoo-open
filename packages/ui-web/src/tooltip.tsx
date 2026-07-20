'use client';

import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  Tooltip as AriaTooltip,
  TooltipTrigger,
} from 'react-aria-components';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Open delay in ms. */
  delay?: number;
}

/**
 * Accessible tooltip (hover + keyboard focus, ARIA) from React Aria Components,
 * skinned with Bingoo tokens. The child becomes the (button) trigger.
 */
export function Tooltip({ content, children, delay = 400 }: TooltipProps) {
  return (
    <TooltipTrigger delay={delay}>
      <AriaButton className="cursor-default rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {children}
      </AriaButton>
      <AriaTooltip className="z-[var(--z-tooltip)] rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md data-[entering]:animate-[fade-up_.15s]">
        {content}
      </AriaTooltip>
    </TooltipTrigger>
  );
}
