/**
 * tokens.ts — design tokens (spec §4 ThemeTokens, FR-C-05).
 *
 * Styles bind to token IDs, never raw hex/px. This is the single knob that a
 * whole explainer's look flows through, and it's what the editor's inspector
 * offers instead of free-form colour pickers.
 */
import type { ThemeTokens } from '@bingoo/explainer'

export const defaultTheme: ThemeTokens = {
  colors: {
    ink: '#2b2724',
    inkSoft: '#7d736a',
    paper: '#f7f2e9',
    accent: '#e07a42', // warm orange
    accent2: '#3f83bf', // water blue
    good: '#3f9d5a',
    warn: '#d98b2b',
    faint: '#d8cfc2',
    // soft fills so shapes read as "finished" rather than empty outlines
    waterFill: '#cfe6f4',
    sunCore: '#f7d488',
    cloudFill: '#fbf8f2',
    ground: '#cbb99c',
    vapor: '#8fb9d9',
    leaf: '#bcd9a6',
    leafDeep: '#6fae5a',
  },
  fontSizes: {
    caption: 30,
    body: 40,
    title: 68,
    huge: 96,
  },
  weights: {
    sm: 4,
    md: 7,
    lg: 11,
  },
  fonts: {
    // CSS variables defined by next/font (theme/fonts.ts, applied on <html>).
    // Strings only here → tokens.ts stays headless-safe (used by the verifier).
    hand: 'var(--font-baloo), ui-rounded, system-ui, sans-serif',
    sans: 'var(--font-bvp), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  register: 'warm',
}

export type ResolvedStyle = {
  stroke: string
  fill: string
  strokeWidth: number
  fontSize: number
  fontFamily: string
  align: string
}

/**
 * A LESSON IS CONTENT, NOT APP CHROME.
 *
 * These tokens used to resolve to `var(--foreground, #2b2724)` — the admin's own
 * theme variables — so a lesson rendered inside a dark-mode admin got its INK
 * from the app (near-white) while its PAPER came from the doc's hex (cream), and
 * the whole thing went white-on-cream: unreadable. Half the palette mapped to a
 * variable and half did not (`cloudFill`, `leaf`, `sunCore`… never did), so the
 * lesson was painted by two disagreeing systems.
 *
 * A doc's theme IS its theme. It renders as authored — cream paper, dark ink —
 * whatever the surrounding app is doing. A lesson that wants to be dark says so
 * in its own theme. The admin's chrome stays dark around it; the lesson does not
 * become part of the chrome.
 */
export function resolveColor(theme: ThemeTokens, id: string | undefined, fallbackId = 'ink'): string {
  const key = id ?? fallbackId
  // a token id resolves against the DOC's palette; anything else (an authored hex)
  // passes through untouched
  return theme.colors[key] ?? theme.colors[fallbackId] ?? key
}

/** Resolve a token-bound StyleTokens against a theme into concrete CSS values. */
/** What a doc gets when its theme declares no `fonts` — never an unstyled serif. */
const FONT_FALLBACK: Record<string, string> = {
  hand: 'var(--font-baloo), ui-rounded, "Segoe UI Rounded", system-ui, sans-serif',
  sans: 'var(--font-bvp), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
}

export function resolveStyle(
  theme: ThemeTokens,
  style?: {
    color?: string
    fill?: string
    weight?: string
    font?: string
    fontSize?: string
    align?: string
  },
): ResolvedStyle {
  const color = resolveColor(theme, style?.color, 'ink')
  const fill = style?.fill ? resolveColor(theme, style.fill, style.fill) : 'none'
  const strokeWidth = theme.weights[style?.weight ?? 'md'] ?? 7
  const fontSize = theme.fontSizes[style?.fontSize ?? 'body'] ?? 40
  // A doc whose theme omits `fonts` (an LLM will) used to fall back to
  // "cursive" — which the browser renders as a pale serif italic, i.e. every
  // title in the lesson silently became unreadable. An omitted OPTIONAL field
  // must never degrade to unstyled text; fall back to the real stack.
  const fontFamily =
    (theme.fonts ?? {})[style?.font ?? 'hand'] ?? FONT_FALLBACK[style?.font ?? 'hand'] ?? FONT_FALLBACK.hand!
  return {
    stroke: color,
    fill,
    strokeWidth,
    fontSize,
    fontFamily,
    align: style?.align ?? 'center',
  }
}

export function tokenColor(theme: ThemeTokens, id: string | undefined, fallback = 'ink'): string {
  return resolveColor(theme, id, fallback)
}
