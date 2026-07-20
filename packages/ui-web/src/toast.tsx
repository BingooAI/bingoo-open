'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { cn } from './lib/cn';

export type ToastVariant = 'default' | 'success' | 'danger';

interface ToastItem {
  id: number;
  title: ReactNode;
  description?: ReactNode;
  variant: ToastVariant;
}

export interface ToastInput {
  title: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /** Auto-dismiss delay in ms (default 4000). */
  duration?: number;
}

const ToastContext = createContext<{ toast: (t: ToastInput) => void } | null>(null);

/** Push toasts from anywhere under `<ToastProvider>`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}

const VARIANT: Record<ToastVariant, string> = {
  default: 'border-border',
  success: 'border-success/50',
  danger: 'border-danger/50',
};

/** Toast host — mount once near the app root; renders an aria-live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const toast = useCallback((t: ToastInput) => {
    const id = (idRef.current += 1);
    setToasts((prev) => [
      ...prev,
      { id, title: t.title, description: t.description, variant: t.variant ?? 'default' },
    ]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, t.duration ?? 4000);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto rounded-xl border bg-surface px-4 py-3 shadow-lg animate-[fade-up_.25s_var(--ease-out-soft)]',
              VARIANT[t.variant],
            )}
          >
            <p className="font-display text-sm font-bold text-foreground">{t.title}</p>
            {t.description ? (
              <p className="mt-0.5 text-xs text-foreground-muted">{t.description}</p>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
