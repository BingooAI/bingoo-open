'use client'

import type { ReactNode } from 'react'
import { Modal, ModalOverlay } from 'react-aria-components'
import { Button } from './button'
import { cn } from './lib/cn'

// Deterministic pseudo-random (SSR-safe: same values on server + client, no
// hydration mismatch). Classic hash of an index → 0..1.
function jitter(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed) * 43758.5453
  return x - Math.floor(x)
}

const PIECE_TINTS = ['bg-primary', 'bg-accent-teal', 'bg-accent-sunbeam', 'bg-accent-coral', 'bg-success']

export interface ConfettiProps {
  /** Number of pieces. */
  count?: number
  className?: string
}

/**
 * A burst of falling confetti pieces — pure CSS (token keyframe `confetti-fall`),
 * no deps. Deterministic layout (SSR-safe) and hidden under `prefers-reduced-motion`.
 * Mount it over any surface (it's absolutely positioned + pointer-events-none).
 */
export function Confetti({ count = 60, className }: ConfettiProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden', className)}
    >
      {Array.from({ length: count }, (_, i) => {
        const left = jitter(i, 1) * 100
        const delay = jitter(i, 2) * 0.8
        const dur = 1.6 + jitter(i, 3) * 1.6
        const size = 6 + Math.round(jitter(i, 4) * 6)
        const tint = PIECE_TINTS[Math.floor(jitter(i, 5) * PIECE_TINTS.length)]!
        const round = jitter(i, 6) > 0.5
        return (
          <span
            key={i}
            className={cn('absolute top-0 block', tint, round ? 'rounded-full' : 'rounded-[1px]')}
            style={{
              left: `${left}%`,
              width: size,
              height: size * (round ? 1 : 1.6),
              animation: `confetti-fall ${dur}s linear ${delay}s infinite`,
            }}
          />
        )
      })}
    </div>
  )
}

export interface CelebrationOverlayProps {
  open: boolean
  onClose: () => void
  /** Show the confetti burst (default true). */
  confetti?: boolean
  children: ReactNode
  className?: string
}

/**
 * Controlled full-screen celebration overlay (focus-trap, ESC, scroll-lock via
 * React Aria) with a confetti layer behind a centered card. Reused by the
 * level-up / badge-unlock / reward moments. Text is caller-owned (i18n-free).
 */
export function CelebrationOverlay({
  open,
  onClose,
  confetti = true,
  children,
  className,
}: CelebrationOverlayProps) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(o) => !o && onClose()}
      isDismissable
      className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center overflow-hidden bg-overlay p-4 backdrop-blur-sm data-[entering]:animate-[fade-in_.2s] data-[exiting]:animate-[fade-out_.15s]"
    >
      {confetti ? <Confetti /> : null}
      <Modal
        className={cn(
          'relative w-full max-w-sm rounded-[var(--radius-card,2rem)] border border-border bg-surface p-8 text-center shadow-xl outline-none data-[entering]:animate-[pop-in_.35s_var(--ease-spring)]',
          className,
        )}
      >
        {children}
      </Modal>
    </ModalOverlay>
  )
}

export interface RewardCelebrationProps {
  open: boolean
  onClose: () => void
  /** Optional mascot / hero visual (caller supplies, e.g. <Mascot/>). */
  mascot?: ReactNode
  title: ReactNode
  message?: ReactNode
  /** Primary CTA label; omit to hide. */
  cta?: ReactNode
  onCta?: () => void
  confetti?: boolean
  className?: string
}

/** The big "you did it" moment: confetti + mascot + headline + CTA. */
export function RewardCelebration({
  open,
  onClose,
  mascot,
  title,
  message,
  cta,
  onCta,
  confetti = true,
  className,
}: RewardCelebrationProps) {
  return (
    <CelebrationOverlay open={open} onClose={onClose} confetti={confetti} className={className}>
      <div className="flex flex-col items-center gap-4">
        {mascot ? <div className="motion-safe:animate-[pop-in_.5s_var(--ease-spring)]">{mascot}</div> : null}
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
