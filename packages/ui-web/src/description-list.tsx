import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface DescriptionListProps {
  items: { term: ReactNode; description: ReactNode }[];
  className?: string;
}

/** Key/value description list (term → description). */
export function DescriptionList({ items, className }: DescriptionListProps) {
  return (
    <dl className={cn('grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm', className)}>
      {items.map((it, i) => (
        <div key={i} className="contents">
          <dt className="text-foreground-muted">{it.term}</dt>
          <dd className="font-medium text-foreground">{it.description}</dd>
        </div>
      ))}
    </dl>
  );
}
