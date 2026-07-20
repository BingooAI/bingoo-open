import { ChevronDown } from 'lucide-react';
import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from './lib/cn';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  selectSize?: 'md' | 'lg';
}

/** Styled native <select> — accessible, zero-JS, keyboard-friendly by default. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, selectSize = 'md', children, ...props },
  ref,
) {
  const height = selectSize === 'lg' ? 'h-13 text-base' : 'h-11 text-sm';
  return (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full appearance-none rounded-2xl border border-border bg-surface pl-4 pr-11 font-sans text-foreground outline-none transition-colors',
          'focus:border-primary focus:ring-2 focus:ring-ring/45',
          invalid && 'border-danger focus:border-danger focus:ring-danger/35',
          'disabled:opacity-60',
          height,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-foreground-subtle"
        aria-hidden
      />
    </div>
  );
});
