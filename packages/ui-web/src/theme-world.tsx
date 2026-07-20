// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { CSSProperties, HTMLAttributes } from 'react'

/**
 * A theme "world" (§3B) — a skin overlay that re-hues the primary family and
 * provides a decorative `--scene` background. In production these come from a
 * remote-config registry (JSON); this is the built-in starter set. Components
 * are unchanged: they read the same semantic tokens, which the world overrides.
 */
export interface ThemeWorld {
  id: string
  name: string
  emoji: string
  /** CSS custom-property overrides applied to the subtree. */
  vars: Record<string, string>
}

export const THEME_WORLDS: ThemeWorld[] = [
  { id: 'default', name: 'Default', emoji: '🎈', vars: {} },
  {
    id: 'space',
    name: 'Space',
    emoji: '🚀',
    vars: {
      '--primary': '#8f74ff',
      '--primary-hover': '#7c5cff',
      '--primary-active': '#6b4cf0',
      '--ring': '#a992ff',
      '--primary-soft': 'rgb(143 116 255 / 0.20)',
      '--primary-soft-foreground': '#cabfff',
      '--scene':
        'radial-gradient(60% 60% at 82% 8%, rgba(124,92,255,.5), transparent 60%), linear-gradient(160deg,#141033,#0a0a1f)',
      '--on-scene': '#ece6ff',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    emoji: '🐠',
    vars: {
      '--primary': '#0aa5c4',
      '--primary-hover': '#008ca8',
      '--primary-active': '#007a90',
      '--ring': '#4fd8e6',
      '--primary-soft': 'rgb(10 165 196 / 0.18)',
      '--primary-soft-foreground': '#075f70',
      '--scene': 'linear-gradient(180deg,#00b4d8,#0077b6 70%,#023e8a)',
      '--on-scene': '#eafcff',
    },
  },
  {
    id: 'dino',
    name: 'Dino',
    emoji: '🦕',
    vars: {
      '--primary': '#18b862',
      '--primary-hover': '#0f9b51',
      '--primary-active': '#0c7a41',
      '--ring': '#63e08a',
      '--primary-soft': 'rgb(24 184 98 / 0.18)',
      '--primary-soft-foreground': '#0c7a41',
      '--scene': 'linear-gradient(160deg,#2f6b3a,#1f4d2a)',
      '--on-scene': '#effff0',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    emoji: '🌅',
    vars: {
      '--primary': '#f4633f',
      '--primary-hover': '#e04a27',
      '--primary-active': '#bf3a1c',
      '--ring': '#ff8a6a',
      '--primary-soft': 'rgb(244 99 63 / 0.16)',
      '--primary-soft-foreground': '#b33a1c',
      '--scene': 'linear-gradient(160deg,#ff8a5c,#f4633f 55%,#7a2f8a)',
      '--on-scene': '#fff2ec',
    },
  },
]

export interface ThemeWorldScopeProps extends HTMLAttributes<HTMLDivElement> {
  world?: ThemeWorld
}

/** Applies a theme world to its subtree (token overrides + `data-theme-pack`). */
export function ThemeWorldScope({ world, style, ...props }: ThemeWorldScopeProps) {
  const vars = (world?.vars ?? {}) as CSSProperties
  return (
    <div
      data-theme-pack={world && world.id !== 'default' ? world.id : undefined}
      style={{ ...vars, ...style }}
      {...props}
    />
  )
}
