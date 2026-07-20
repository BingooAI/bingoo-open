'use client';

import { Volume2 } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface SoundButtonProps {
  /** Audio URL to play on press (browser Audio). */
  src?: string;
  /** Called after (or instead of) playing — wire custom playback here. */
  onPlay?: () => void;
  /** Accessible label (data). */
  label: string;
  icon?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'soft' | 'solid' | 'ghost';
  className?: string;
}

const SIZE = {
  sm: 'size-8 [&_svg]:size-4',
  md: 'size-11 [&_svg]:size-5',
  lg: 'size-14 [&_svg]:size-6',
} as const;

const TONE = {
  soft: 'bg-primary-soft text-primary hover:brightness-95',
  solid: 'bg-primary text-primary-foreground hover:bg-primary-hover',
  ghost: 'text-foreground hover:bg-surface-muted',
} as const;

/**
 * A round button that plays a sound — used for reward stingers, pronunciation,
 * or mascot voice. Pass `src` for built-in browser playback, or `onPlay` to wire
 * your own audio layer (native uses an injected player). Label is data.
 */
export function SoundButton({
  src,
  onPlay,
  label,
  icon,
  size = 'md',
  tone = 'soft',
  className,
}: SoundButtonProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  function play() {
    if (src) {
      const el = audioRef.current ?? new Audio(src);
      audioRef.current = el;
      el.currentTime = 0;
      void el.play().catch(() => {});
    }
    onPlay?.();
  }

  return (
    <button
      type="button"
      onClick={play}
      aria-label={label}
      className={cn(
        'grid place-items-center rounded-full outline-none transition-[transform,background-color,filter] active:scale-95 focus-visible:ring-2 focus-visible:ring-ring',
        SIZE[size],
        TONE[tone],
        className,
      )}
    >
      {icon ?? <Volume2 />}
    </button>
  );
}
