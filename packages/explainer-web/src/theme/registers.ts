// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * registers.ts — style registers (spec §8). A register is a token bundle that
 * decides the "hand-drawn" look WITHOUT touching the document or choreographer.
 * Swap register → the whole explainer restyles: warm friendly doodle vs clean
 * professional doodle.
 */
export type Register = {
  id: string
  label: string
  /** stroke jitter amplitude (logical units) — 0 = ruler-clean */
  roughness: number
  /** width variation along a stroke (0..1) */
  widthVary: number
  /** hand-drawn wobble on straight edges (0..1) */
  handDrawn: number
  /** corner rounding for boxes (logical units) */
  corner: number
  fontToken: string
}

export const registers: Record<string, Register> = {
  warm: {
    id: 'warm',
    label: 'Doodle ấm',
    roughness: 2.2,
    widthVary: 0.35,
    handDrawn: 0.8,
    corner: 22,
    fontToken: 'hand',
  },
  clean: {
    id: 'clean',
    label: 'Doodle sạch',
    roughness: 0.6,
    widthVary: 0.12,
    handDrawn: 0.25,
    corner: 10,
    fontToken: 'sans',
  },
}

export function getRegister(id: string | undefined): Register {
  return registers[id ?? 'warm'] ?? registers.warm!
}

/**
 * Deterministic hand-drawn wobble for a straight segment. Seeded so a scrubbed
 * frame matches a played one (spec §2). Returns an SVG path with slight
 * mid-point deviation to read as pen-drawn.
 */
export function wobbleLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  amount: number,
  seed: number,
): string {
  if (amount <= 0.01) return `M ${x1} ${y1} L ${x2} ${y2}`
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  const dev = (seededUnit(seed) - 0.5) * 2 * amount * 8
  return `M ${x1} ${y1} Q ${mx + nx * dev} ${my + ny * dev} ${x2} ${y2}`
}

function seededUnit(seed: number): number {
  const h = Math.sin(seed * 91.17) * 43758.5453
  return h - Math.floor(h)
}
