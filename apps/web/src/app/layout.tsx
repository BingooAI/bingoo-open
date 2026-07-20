import type { ReactNode } from 'react'

/**
 * Passthrough root layout. The real `<html>`/`<body>` live in
 * `[locale]/layout.tsx` (locale-aware: lang, fonts, theme) and in the global
 * `not-found.tsx`. This root layout only exists to satisfy Next's requirement
 * that the app tree has a root layout — it must not add a second `<html>`.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}
