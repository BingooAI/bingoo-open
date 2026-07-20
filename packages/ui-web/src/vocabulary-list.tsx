'use client';

import { Volume2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from './lib/cn';
import { ENTER, stagger, tile } from './lib/interactive';

export interface VocabularyWord {
  term: string;
  definition: string;
  example?: string;
  emoji?: string;
  audioSrc?: string;
}

export interface VocabularyListProps {
  title?: string;
  words: VocabularyWord[];
  /** Play a pronunciation clip. The app owns playback. */
  onPlayAudio?: (src: string) => void;
  className?: string;
}

/**
 * The "Key words" box every Learner's Book chapter opens with. Tap a word to flip its
 * definition open; tap the speaker to hear it. i18n-free — all text comes from the data.
 */
export function VocabularyList({ title, words, onPlayAudio, className }: VocabularyListProps) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section
      className={cn('rounded-2xl border-2 border-primary/40 bg-primary-soft/40 p-4', className)}
    >
      {title ? (
        <h4 className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-primary">
          {title}
        </h4>
      ) : null}
      <ul className="flex flex-col gap-1.5">
        {words.map((w, i) => {
          const on = open === w.term;
          return (
            <li key={w.term} className={ENTER} style={stagger(i)}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(on ? null : w.term)}
                  aria-expanded={on}
                  className={cn(
                    tile({ state: on ? 'selected' : 'idle', size: 'none' }),
                    'flex flex-1 items-center gap-2 rounded-xl px-3 py-2 text-left',
                  )}
                >
                  {w.emoji ? <span className="text-lg">{w.emoji}</span> : null}
                  <span className="font-semibold text-foreground">{w.term}</span>
                </button>
                {w.audioSrc && onPlayAudio ? (
                  <button
                    type="button"
                    onClick={() => onPlayAudio(w.audioSrc!)}
                    aria-label={w.term}
                    className={cn(
                      tile({ state: 'idle', size: 'none' }),
                      'grid size-9 place-items-center rounded-xl text-foreground-muted hover:text-primary',
                    )}
                  >
                    <Volume2 className="size-4" />
                  </button>
                ) : null}
              </div>
              {on ? (
                <div className={cn('mt-1 rounded-xl bg-surface px-3 py-2', ENTER)}>
                  <p className="text-sm text-foreground">{w.definition}</p>
                  {w.example ? (
                    <p className="mt-1 text-sm italic text-foreground-muted">“{w.example}”</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
