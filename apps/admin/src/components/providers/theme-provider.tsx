'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ComponentProps } from 'react';

/**
 * App-wide theme controller (next-themes). Themes are driven by the `data-theme`
 * attribute, so the semantic tokens from @bingoo/tokens swap automatically —
 * light + dark both covered by the shared token set.
 */
export const THEMES = ['light', 'dark'] as const;
export type ThemeName = (typeof THEMES)[number];

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      themes={[...THEMES]}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
