'use client';

import type { ContentBlock } from '@bingoo/core';
import { Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { ContentBlocks } from './content-blocks';
import { cn } from './lib/cn';

export interface ReadingPaneProps {
  /** Render validated content blocks… */
  blocks?: ContentBlock[];
  /** …or arbitrary children. */
  children?: ReactNode;
  /** Show the A− / A+ text-size control. */
  showFontControl?: boolean;
  fontControlLabels?: { smaller: string; larger: string };
  className?: string;
}

const SIZES = ['text-base', 'text-lg', 'text-xl'] as const;

/**
 * A long-form reading container with comfortable measure + an optional text-size
 * control. Fluid, so it reads well in a 16:9 pane or a 9:16 feed. Renders shared
 * ContentBlocks (LLM-authorable) or any children.
 */
export function ReadingPane({
  blocks,
  children,
  showFontControl = true,
  fontControlLabels,
  className,
}: ReadingPaneProps) {
  const [size, setSize] = useState(1);
  return (
    <div className={cn('mx-auto w-full max-w-2xl', className)}>
      {showFontControl ? (
        <div className="mb-3 flex items-center justify-end gap-1.5">
          <button
            type="button"
            aria-label={fontControlLabels?.smaller}
            disabled={size === 0}
            onClick={() => setSize((s) => Math.max(0, s - 1))}
            className="grid size-8 place-items-center rounded-lg border border-border text-foreground-muted outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            aria-label={fontControlLabels?.larger}
            disabled={size === SIZES.length - 1}
            onClick={() => setSize((s) => Math.min(SIZES.length - 1, s + 1))}
            className="grid size-8 place-items-center rounded-lg border border-border text-foreground-muted outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Plus className="size-4" />
          </button>
        </div>
      ) : null}
      <div className={cn(SIZES[size])}>{blocks ? <ContentBlocks blocks={blocks} /> : children}</div>
    </div>
  );
}
