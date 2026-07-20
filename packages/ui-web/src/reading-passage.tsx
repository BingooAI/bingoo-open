'use client';

import { cn } from './lib/cn';
import { ENTER, tile } from './lib/interactive';

export interface ReadingPassageProps {
  title?: string;
  author?: string;
  paragraphs: string[];
  /** Number the paragraphs so questions can point at them ("see paragraph 3"). */
  numbered?: boolean;
  glossary?: Array<{ term: string; definition: string }>;
  className?: string;
}

/** A reading text — numbered paragraphs plus the hard words defined underneath. i18n-free. */
export function ReadingPassage({
  title,
  author,
  paragraphs,
  numbered = true,
  glossary,
  className,
}: ReadingPassageProps) {
  return (
    <article
      className={cn(
        // Nothing to tap here — it sits back and lets the questions do the work.
        tile({ state: 'quiet', size: 'none' }),
        'bg-surface p-4',
        ENTER,
        className,
      )}
    >
      {title ? <h4 className="font-display text-lg font-bold text-foreground">{title}</h4> : null}
      {author ? <p className="mb-2 text-xs font-medium text-foreground-subtle">{author}</p> : null}

      <div className="flex flex-col gap-2">
        {paragraphs.map((p, i) => (
          <div key={i} className="flex gap-3">
            {numbered ? (
              <span className="w-5 shrink-0 pt-0.5 text-right text-xs font-bold tabular-nums text-foreground-subtle">
                {i + 1}
              </span>
            ) : null}
            <p className="flex-1 text-base leading-relaxed text-foreground">{p}</p>
          </div>
        ))}
      </div>

      {glossary?.length ? (
        <dl className="mt-3 flex flex-col gap-1 border-t-2 border-dashed border-border pt-3">
          {glossary.map((g) => (
            <div key={g.term} className="flex gap-2 text-sm">
              <dt className="font-bold text-foreground">{g.term}</dt>
              <dd className="text-foreground-muted">{g.definition}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </article>
  );
}
