'use client';

import type { BranchKeyNode } from '@bingoo/core';
import { Check, RotateCcw, X } from 'lucide-react';
import { cn } from './lib/cn';
import { ENTER, stagger, tile } from './lib/interactive';

export interface BranchKeyLabels {
  yes: string;
  no: string;
  back?: string;
}

export interface BranchKeyProps {
  subject: string;
  subjectEmoji?: string;
  subjectImage?: string;
  nodes: BranchKeyNode[];
  root: string;
  /** Controlled: question node id → yes(true)/no(false). */
  answers: Record<string, boolean>;
  onChange: (answers: Record<string, boolean>) => void;
  labels: BranchKeyLabels;
  reveal?: { correct: boolean; reached: string | null; answer: string };
  disabled?: boolean;
  className?: string;
}

/**
 * Identification key (dichotomous key) — answer yes/no questions until you reach a
 * result, exactly as in the Science books ("Does it have fur?" → mammal …). The
 * walk + grading live in `@bingoo/core` (`traverseKey`). i18n-free.
 */
export function BranchKey({
  subject,
  subjectEmoji,
  subjectImage,
  nodes,
  root,
  answers,
  onChange,
  labels,
  reveal,
  disabled,
  className,
}: BranchKeyProps) {
  const locked = !!reveal || disabled;
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Walk the key with the current answers to find where we are.
  const trail: Array<{ node: BranchKeyNode; answer: boolean }> = [];
  let cur = byId.get(root);
  while (cur && cur.result === undefined) {
    const a = answers[cur.id];
    if (a === undefined) break;
    trail.push({ node: cur, answer: a });
    const next = a ? cur.yes : cur.no;
    cur = next ? byId.get(next) : undefined;
  }
  const atLeaf = !!cur && cur.result !== undefined;
  const answerNode = byId.get(reveal?.answer ?? '');

  const answer = (id: string, v: boolean) => {
    if (locked) return;
    onChange({ ...answers, [id]: v });
  };
  const back = () => {
    if (locked || trail.length === 0) return;
    const next = { ...answers };
    delete next[trail[trail.length - 1]!.node.id];
    onChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* The thing to identify */}
      <div className={cn(tile({ state: 'quiet', size: 'none' }), 'flex items-center gap-3 p-3')}>
        {subjectImage ? (
          <img src={subjectImage} alt="" className="size-16 rounded-xl object-cover" />
        ) : subjectEmoji ? (
          <span className="text-4xl">{subjectEmoji}</span>
        ) : null}
        <span className="font-semibold text-foreground">{subject}</span>
      </div>

      {/* Trail of answered questions */}
      {trail.map(({ node, answer: a }, i) => (
        <div
          key={node.id}
          style={stagger(i)}
          className={cn(
            tile({ state: 'quiet', size: 'none' }),
            'flex items-start gap-2 rounded-xl px-3 py-2 text-sm motion-safe:animate-fade-up',
          )}
        >
          <span className="flex-1 text-foreground-muted">{node.question}</span>
          <span
            className={cn(
              'shrink-0 rounded-md px-2 py-0.5 text-xs font-bold',
              a ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
            )}
          >
            {a ? labels.yes : labels.no}
          </span>
        </div>
      ))}

      {/* Current question, or the result */}
      {cur && !atLeaf ? (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-2xl border-2 border-primary bg-primary-soft/30 p-4',
            ENTER,
          )}
        >
          <p className="text-center font-semibold text-foreground">{cur.question}</p>
          <div className="flex justify-center gap-3">
            {/* yes/no keep their green/red *affordance* colours — they are the choice,
                not a verdict — but ride on the shared tile for press + focus feel. */}
            <button
              type="button"
              disabled={locked}
              onClick={() => answer(cur!.id, true)}
              className={cn(
                tile({ size: 'none' }),
                'rounded-xl border-success bg-success-soft px-5 py-2 font-bold text-success',
              )}
            >
              {labels.yes}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => answer(cur!.id, false)}
              className={cn(
                tile({ size: 'none' }),
                'rounded-xl border-danger bg-danger-soft px-5 py-2 font-bold text-danger',
              )}
            >
              {labels.no}
            </button>
          </div>
        </div>
      ) : atLeaf ? (
        <div
          className={cn(
            tile({
              state: reveal ? (reveal.correct ? 'correct' : 'wrong') : 'selected',
              size: 'none',
            }),
            'flex items-center justify-center gap-2 p-4 text-lg font-bold',
          )}
        >
          {reveal ? reveal.correct ? <Check className="size-5" /> : <X className="size-5" /> : null}
          {cur!.result}
        </div>
      ) : null}

      {/* Correct answer when they got it wrong */}
      {reveal && !reveal.correct && answerNode ? (
        <p className="text-center text-sm font-semibold text-success">→ {answerNode.result}</p>
      ) : null}

      {!locked && trail.length > 0 && labels.back ? (
        <button
          type="button"
          onClick={back}
          className={cn(
            tile({ size: 'none' }),
            'inline-flex w-fit items-center gap-1.5 self-center rounded-lg px-3 py-1.5 text-sm font-semibold',
          )}
        >
          <RotateCcw className="size-3.5" />
          {labels.back}
        </button>
      ) : null}
    </div>
  );
}
