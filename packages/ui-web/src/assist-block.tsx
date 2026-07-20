'use client';

import type { Assist } from '@bingoo/core';
import { cn } from './lib/cn';
import { SoundButton } from './sound-button';

export interface AssistBlockProps {
  assist: Assist;
  /** Visual weight: guide (plain) vs instruction (muted, smaller). */
  tone?: 'guide' | 'instruction';
  /** A11y label for the audio play button (data). */
  playLabel?: string;
  className?: string;
}

/**
 * Renders one pedagogical support (guide / instruction / teach): shows the text
 * when present, offers a play button when audio is present — young learners can
 * listen instead of reading. Reused by quiz and lesson surfaces. i18n-free.
 */
export function AssistBlock({ assist, tone = 'guide', playLabel, className }: AssistBlockProps) {
  const audio = assist.audioSrc;
  if (!assist.text && !audio) return null;
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {audio ? <SoundButton src={audio} label={playLabel ?? ''} size="sm" /> : null}
      {assist.text ? (
        <p
          className={cn(
            tone === 'guide' ? 'text-sm text-foreground-muted' : 'text-xs text-foreground-subtle',
          )}
        >
          {assist.text}
        </p>
      ) : null}
    </div>
  );
}
