'use client';

import type { ReactNode } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

export type StepState = 'idle' | 'running' | 'done' | 'error';

export interface StepDef {
  key: string;
  title: string;
  /** Tóm tắt kết quả khi xong (vd "42 khái niệm · 61 quan hệ"). */
  summary?: string;
  state: StepState;
  /** Nội dung/điều khiển của bước — chỉ hiện khi bước đang mở. */
  body?: ReactNode;
}

/**
 * Tiến trình dạng dọc: mỗi chặng hiện trạng thái (chờ/đang chạy/xong/lỗi) + kết quả tóm tắt.
 * Người soạn thấy rõ đang ở đâu và mỗi bước ra cái gì — không còn "spinner mù".
 */
export function Stepper({ steps }: { steps: StepDef[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-4">
            {/* cột chỉ dấu */}
            <div className="flex flex-col items-center">
              <StepMark state={s.state} index={i + 1} />
              {!last && (
                <div
                  className={cn('w-px flex-1', s.state === 'done' ? 'bg-primary/50' : 'bg-border')}
                />
              )}
            </div>

            {/* nội dung */}
            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-6')}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    s.state === 'idle' ? 'text-foreground-muted' : 'text-foreground',
                  )}
                >
                  {s.title}
                </span>
                {s.summary ? (
                  <span
                    className={cn(
                      'text-xs',
                      s.state === 'error' ? 'text-danger' : 'text-foreground-muted',
                    )}
                  >
                    {s.summary}
                  </span>
                ) : null}
              </div>
              {s.body ? <div className="mt-3">{s.body}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepMark({ state, index }: { state: StepState; index: number }) {
  const base = 'grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold';
  if (state === 'done') {
    return (
      <div className={cn(base, 'border-primary bg-primary text-primary-foreground')}>
        <Check className="size-4" />
      </div>
    );
  }
  if (state === 'running') {
    return (
      <div className={cn(base, 'border-primary bg-primary-soft text-primary')}>
        <Loader2 className="size-4 animate-spin" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className={cn(base, 'border-danger bg-danger-soft text-danger')}>
        <AlertCircle className="size-4" />
      </div>
    );
  }
  return <div className={cn(base, 'border-border bg-surface text-foreground-muted')}>{index}</div>;
}
