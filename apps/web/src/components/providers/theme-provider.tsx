'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import type { ComponentProps } from 'react'

/**
 * App-wide theme controller (next-themes).
 *
 * Themes are driven by the `data-theme` attribute, so semantic tokens in
 * `themes.css` swap automatically. To add a theme later: add a
 * `[data-theme="…"]` block in themes.css and list it in `THEMES` below.
 */
export const THEMES = ['light', 'dark'] as const
export type ThemeName = (typeof THEMES)[number]

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
  )
}
