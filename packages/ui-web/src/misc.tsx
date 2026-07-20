import { type HTMLAttributes } from 'react';
import { cn } from './lib/cn';

/** Thin themed divider. */
export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        'bg-border',
        orientation === 'vertical' ? 'h-full w-px' : 'h-px w-full',
        className,
      )}
      {...props}
    />
  );
}

/** Shimmering loading placeholder. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-shimmer rounded-lg bg-surface-muted',
        'bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--foreground)_7%,transparent),transparent)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

/** Centered, max-width page container. */
export function Container({
  className,
  size = 'lg',
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const max = { sm: 'max-w-3xl', md: 'max-w-5xl', lg: 'max-w-6xl', xl: 'max-w-7xl' }[size];
  return <div className={cn('mx-auto w-full px-5 sm:px-6 lg:px-8', max, className)} {...props} />;
}

/** Vertical rhythm section wrapper. */
export function Section({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('py-16 sm:py-20 lg:py-28', className)} {...props} />;
}
