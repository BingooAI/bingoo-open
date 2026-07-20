// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/** FNV-1a 32-bit → dayRank: xoay vòng tie-break theo ngày, tái lập được. SPEC §8.3. */

export function fnv1a32(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** SPEC §8.3 — 0 nếu không daySeed (không xoay); ngược lại FNV-1a32(`${key}:${daySeed}`). */
export function dayRank(key: string, daySeed?: string): number {
  if (!daySeed) return 0
  return fnv1a32(`${key}:${daySeed}`)
}
