'use client';

import { ChevronDown } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { cn } from './lib/cn';

export interface AccordionItemData {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItemData[];
  /** `single` = one open at a time; `multiple` = independent. */
  type?: 'single' | 'multiple';
  defaultOpen?: string[];
}

/** Accessible accordion (button + region, aria-expanded/controls). */
export function Accordion({ items, type = 'single', defaultOpen = [] }: AccordionProps) {
  const [open, setOpen] = useState<string[]>(defaultOpen);

  function toggle(id: string) {
    setOpen((prev) => {
      const isOpen = prev.includes(id);
      if (type === 'single') return isOpen ? [] : [id];
      return isOpen ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  return (
    <div className="w-full divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {items.map((it) => (
        <AccordionRow
          key={it.id}
          item={it}
          isOpen={open.includes(it.id)}
          onToggle={() => toggle(it.id)}
        />
      ))}
    </div>
  );
}

function AccordionRow({
  item,
  isOpen,
  onToggle,
}: {
  item: AccordionItemData;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const btnId = useId();
  return (
    <div>
      <h3 className="m-0">
        <button
          id={btnId}
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-3.5 text-left font-display text-sm font-bold text-foreground outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          {item.title}
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-foreground-muted transition-transform',
              isOpen && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h3>
      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-labelledby={btnId}
          className="bg-surface px-4 pb-4 text-sm text-foreground-muted"
        >
          {item.content}
        </div>
      ) : null}
    </div>
  );
}
