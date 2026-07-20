import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'w-full rounded-2xl border border-border bg-surface px-4 py-3 font-sans text-sm text-foreground outline-none transition-colors',
        'placeholder:text-foreground-subtle',
        'focus:border-primary focus:ring-2 focus:ring-ring/45',
        invalid && 'border-danger focus:border-danger focus:ring-danger/35',
        'disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
