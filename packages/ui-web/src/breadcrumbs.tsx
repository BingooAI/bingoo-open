import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';

export interface Crumb {
  id: string;
  label: ReactNode;
  href?: string;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  /** Accessible label for the nav landmark. */
  ariaLabel?: string;
}

/**
 * Breadcrumb trail. Uses plain `<a>` — pass locale-aware hrefs from the app.
 * The last crumb renders as the current page (no link, `aria-current`).
 */
export function Breadcrumbs({ items, ariaLabel = 'Breadcrumb' }: BreadcrumbsProps) {
  return (
    <nav aria-label={ariaLabel}>
      <ol className="flex flex-wrap items-center gap-1 text-sm">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.id} className="flex items-center gap-1">
              {c.href && !last ? (
                <a
                  href={c.href}
                  className="rounded text-foreground-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.label}
                </a>
              ) : (
                <span
                  aria-current={last ? 'page' : undefined}
                  className={last ? 'font-medium text-foreground' : 'text-foreground-muted'}
                >
                  {c.label}
                </span>
              )}
              {!last ? (
                <ChevronRight className="size-3.5 text-foreground-subtle" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
