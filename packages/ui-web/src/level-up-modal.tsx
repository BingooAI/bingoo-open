'use client'

import type { ReactNode } from 'react'
import { Button } from './button'
import { CelebrationOverlay } from './celebration'

export interface LevelUpModalProps {
  open: boolean
  onClose: () => void
  level: number
  /** Prefix before the level number, e.g. "Lv.". */
  levelPrefix?: string
  title: ReactNode
  message?: ReactNode
  cta?: ReactNode
  onCta?: () => void
  className?: string
}

/** Level-up celebration — a glowing level medallion with confetti. i18n-free. */
export function LevelUpModal({
  open,
  onClose,
  level,
  levelPrefix = 'Lv.',
  title,
  message,
  cta,
  onCta,
  className,
}: LevelUpModalProps) {
  return (
    <CelebrationOverlay open={open} onClose={onClose} className={className}>
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-28 place-items-center rounded-full bg-gradient-brand text-white shadow-pop motion-safe:animate-[pop-in_.45s_var(--ease-spring)]">
          <span className="flex flex-col items-center leading-none">
            <span className="text-2xs font-bold uppercase tracking-wide opacity-90">{levelPrefix}</span>
            <span className="font-display text-4xl font-extrabold tabular-nums">{level}</span>
          </span>
        </div>
        <h2 className="font-display text-2xl font-extrabold text-foreground">{title}</h2>
        {message ? <p className="text-foreground-muted">{message}</p> : null}
        {cta ? (
          <Button size="lg" fullWidth onClick={onCta ?? onClose}>
            {cta}
          </Button>
        ) : null}
      </div>
    </CelebrationOverlay>
  )
}
