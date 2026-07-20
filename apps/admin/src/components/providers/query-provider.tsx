'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { ApiError } from '@/lib/api-client';

/**
 * TanStack Query provider for the admin app — the single data-fetching layer.
 * One client per browser session (created in state so it survives re-renders but
 * isn't shared across users in SSR). Sensible admin defaults: short stale time,
 * no refetch-on-focus spam, and NO retry on auth walls (401/403) or client
 * errors — those are terminal and should surface immediately, not hammer the API.
 */
function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.isAuth) return false;
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
