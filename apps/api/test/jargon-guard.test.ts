// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * LAN CAN THUẬT NGỮ — chặn từ vựng của MÁY lọt vào chuỗi NGƯỜI DUYỆT (giáo viên/moderator, R5) đọc.
 *
 * Vì sao là một BÀI TEST chứ không phải một bản đồ-thay-chữ: bản đồ thay chữ mục rữa dần, còn test
 * đỏ ngay khi ai đó thêm "node/Facets/KC/SUBSET…" vào namespace giáo viên. Cùng tinh thần các bất
 * biến khác của repo (AST thay vì grep). Đặt ở apps/api vì đây là package có sẵn test runner; nó
 * đọc thẳng catalog message của @bingoo.ai/i18n.
 *
 * Token mơ hồ trùng từ tiếng Anh thường ("same", "aligns", "overlap") KHÔNG bị cấm ở đây — chúng là
 * lời văn hợp lệ; pill enum thô (SAME/OVERLAP…) là chuyện render trong code, không phải i18n.
 */

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function load(loc: string): Record<string, unknown> {
  const raw = readFileSync(resolve(ROOT, `packages/i18n/messages/${loc}.json`), 'utf8')
  return JSON.parse(raw) as Record<string, unknown>
}

// Namespace mà người duyệt không chuyên đọc. (Panel truy-nguồn C6 sẽ thêm namespace của nó vào đây.)
const GUARDED = ['admin.authoring']
// Subtree được phép chứa token thô — cửa thoát "chi tiết kỹ thuật" cho staff.
const TECH_KEYS = new Set(['tech', 'technical', 'debug'])

// Thuật ngữ đục, gần như không đụng từ thường. Bắt cả số nhiều.
const WORD_BANS = [/\bfacets?\b/i, /\bKC\b/, /\bnodes?\b/i, /\bDAG\b/, /\bslugs?\b/i]
// Token máy dạng SCREAMING — tên enum/quan hệ.
const TOKEN_BANS = [/\bMAPS_TO\b/, /\bSUBSET\b/, /\bSUPERSET\b/, /\bVARIANT_OF\b/]

function pick(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined),
      obj,
    )
}

function collect(node: unknown, path: string, out: { path: string; value: string }[]): void {
  if (typeof node === 'string') {
    out.push({ path, value: node })
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (TECH_KEYS.has(k)) continue
      collect(v, path ? `${path}.${k}` : k, out)
    }
  }
}

const offends = (s: string): boolean => WORD_BANS.some((r) => r.test(s)) || TOKEN_BANS.some((r) => r.test(s))

for (const loc of ['vi', 'en']) {
  describe(`jargon-guard (${loc})`, () => {
    const msg = load(loc)
    for (const ns of GUARDED) {
      it(`${ns} — không có từ vựng máy trong chuỗi giáo viên thấy`, () => {
        const strings: { path: string; value: string }[] = []
        collect(pick(msg, ns), ns, strings)
        const offenders = strings.filter((s) => offends(s.value)).map((s) => `${s.path}: ${s.value}`)
        expect(offenders).toEqual([])
      })
    }
  })
}

describe('jargon-guard — CANARY (guard phải có răng)', () => {
  it('bắt đúng các mẫu thuật ngữ đã biết', () => {
    expect(offends('Bấm một node trên đồ thị')).toBe(true)
    expect(offends('Facets — danh tính')).toBe(true)
    expect(offends('Rèn KC')).toBe(true)
    expect(offends('No links to other nodes')).toBe(true)
    expect(offends('X MAPS_TO Y (SUBSET)')).toBe(true)
  })
  it('KHÔNG bắt lời văn hợp lệ trùng từ tiếng Anh thường', () => {
    expect(offends('add and subtract same numbers')).toBe(false)
    expect(offends('Aligns with the goal')).toBe(false)
    expect(offends('Overlap map')).toBe(false)
    expect(offends('Rèn kiến thức')).toBe(false)
  })
})
