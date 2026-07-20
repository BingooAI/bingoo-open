'use client';

import type { ReactNode } from 'react';
import { Button } from './button';
import { CelebrationOverlay } from './celebration';
import { IconChip, type IconChipColor } from './icon-chip';

export interface BadgeUnlockModalProps {
  open: boolean;
  onClose: () => void;
  icon: ReactNode;
  badgeTitle: ReactNode;
  color?: IconChipColor;
  /** Headline, e.g. "Huy hiệu mới!". */
  title: ReactNode;
  message?: ReactNode;
  cta?: ReactNode;
  onCta?: () => void;
  className?: string;
}

/** Badge-unlock celebration — the badge pops in over confetti. i18n-free. */
export function BadgeUnlockModal({
  open,
  onClose,
  icon,
  badgeTitle,
  color = 'sunbeam',
  title,
  message,
  cta,
  onCta,
  className,
}: BadgeUnlockModalProps) {
  return (
    <CelebrationOverlay open={open} onClose={onClose} className={className}>
      <div className="flex flex-col items-center gap-4">
        <div className="motion-safe:animate-[pop-in_.5s_var(--ease-spring)]">
          <IconChip color={color} tone="gradient" size="lg" className="size-24 [&_svg]:size-11">
            {icon}
          </IconChip>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-bold uppercase tracking-wide text-primary">{title}</span>
          <span className="font-display text-2xl font-extrabold text-foreground">{badgeTitle}</span>
        </div>
        {message ? <p className="text-foreground-muted">{message}</p> : null}
        {cta ? (
          <Button size="lg" fullWidth onClick={onCta ?? onClose}>
            {cta}
          </Button>
        ) : null}
      </div>
    </CelebrationOverlay>
  );
}
