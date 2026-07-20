'use client';

import { Play } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';
import { cn } from './lib/cn';

export interface CodePlaygroundProps {
  code: string;
  onChange?: (code: string) => void;
  language?: string;
  onRun?: () => void;
  running?: boolean;
  /** Program output (from an injected runner). */
  output?: ReactNode;
  runLabel: string;
  outputLabel?: ReactNode;
  editable?: boolean;
  rows?: number;
  className?: string;
}

/**
 * A lightweight code playground: an editable code area, a Run button, and an
 * output pane. Dependency-free (textarea editor) so it runs on web + native;
 * syntax highlighting and the actual runner are injected. For university / adult
 * learners. i18n-free.
 */
export function CodePlayground({
  code,
  onChange,
  language,
  onRun,
  running,
  output,
  runLabel,
  outputLabel,
  editable = true,
  rows = 8,
  className,
}: CodePlaygroundProps) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-border bg-surface', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          {language ?? 'code'}
        </span>
        {onRun ? (
          <Button
            size="sm"
            onClick={onRun}
            loading={running}
            leftIcon={<Play className="size-3.5" />}
          >
            {runLabel}
          </Button>
        ) : null}
      </div>
      <textarea
        value={code}
        onChange={(e) => onChange?.(e.target.value)}
        readOnly={!editable}
        spellCheck={false}
        rows={rows}
        className="block w-full resize-y bg-transparent p-4 font-mono text-sm leading-relaxed text-foreground outline-none"
      />
      {output != null ? (
        <div className="border-t border-border bg-surface-muted/40">
          {outputLabel ? (
            <div className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {outputLabel}
            </div>
          ) : null}
          <pre className="overflow-x-auto p-4 font-mono text-sm text-foreground">
            <code>{output}</code>
          </pre>
        </div>
      ) : null}
    </div>
  );
}
