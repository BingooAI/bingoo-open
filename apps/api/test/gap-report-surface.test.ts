// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Canh mặt báo cáo lỗ hổng — ADR 0007.
 *
 * Engine đã có test riêng cho phép tính. Cái đáng canh ở TẦNG NÀY là những thứ engine không
 * biết: chuỗi hiển thị phải đủ cả hai ngôn ngữ, và câu chữ phải nói về bằng chứng chứ không
 * dán nhãn đứa trẻ. Cả hai đều là lời hứa của dự án, và lời hứa không có test là lời hứa sẽ
 * trôi. Chạy offline, không cần DB.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const load = (locale: string): Record<string, unknown> =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../../../packages/i18n/messages/${locale}.json`, import.meta.url)),
      'utf8',
    ),
  ) as Record<string, unknown>

const vi = load('vi')
const en = load('en')

/** Mọi đường dẫn lá của một object lồng nhau, để so hai bản dịch bằng tập khoá. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix]
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    leafPaths(v, prefix ? `${prefix}.${k}` : k),
  )
}

function at(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, k) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[k]
  }, root)
}

describe('chuỗi màn người dùng có đủ cả vi lẫn en (R4)', () => {
  it('hai bản dịch cùng một tập khoá, không thiếu bên nào', () => {
    const viKeys = leafPaths(at(vi, 'admin.users')).sort()
    const enKeys = leafPaths(at(en, 'admin.users')).sort()
    expect(viKeys.length).toBeGreaterThan(0)
    expect(enKeys).toEqual(viKeys)
  })

  it('không khoá nào bỏ trống', () => {
    for (const locale of [vi, en]) {
      for (const path of leafPaths(at(locale, 'admin.users'))) {
        const v = at(locale, `admin.users.${path}`)
        expect(typeof v, path).toBe('string')
        expect((v as string).trim().length, path).toBeGreaterThan(0)
      }
    }
  })

  it('mục điều hướng cũng có cả hai ngôn ngữ', () => {
    expect(typeof at(vi, 'admin.nav.users')).toBe('string')
    expect(typeof at(en, 'admin.nav.users')).toBe('string')
  })
})

describe('câu chữ nói về bằng chứng, không dán nhãn đứa trẻ (ADR 0007)', () => {
  /**
   * Hai câu này là chỗ dễ trượt nhất của cả tính năng: chúng xuất hiện đúng lúc một mục tiêu
   * CHƯA đạt, tức đúng lúc dễ viết thành một lời phán về đứa trẻ nhất.
   */
  it('lý do "chưa có bằng chứng" nói về việc đo, và nói rõ ĐỪNG dạy lại', () => {
    const viText = at(vi, 'admin.users.gap.reason.noEvidence') as string
    const enText = at(en, 'admin.users.gap.reason.noEvidence') as string
    expect(viText).toMatch(/quan sát|bằng chứng/i)
    expect(viText).toMatch(/chưa phải dạy lại|chưa phải dạy/i)
    expect(enText).toMatch(/observ|evidence/i)
    expect(enText).toMatch(/not reteach/i)
  })

  it('lý do "đã đo mà chưa tới" chỉ ra việc tiếp theo là dạy', () => {
    expect(at(vi, 'admin.users.gap.reason.notYet') as string).toMatch(/dạy/i)
    expect(at(en, 'admin.users.gap.reason.notYet') as string).toMatch(/teach/i)
  })

  /**
   * Cách A của ADR 0007: mục tiêu chỉ quan sát được tần suất thì KHÔNG quy thành điểm. Chuỗi
   * phải nói ra điều đó, vì một dòng chỉ ghi "5 lần" sẽ bị đọc như một thang điểm ẩn.
   */
  it('chuỗi cách A nói rõ mục tiêu này không quy thành điểm', () => {
    expect(at(vi, 'admin.users.gap.observationsOnly') as string).toMatch(/không quy thành điểm/i)
    expect(at(en, 'admin.users.gap.observationsOnly') as string).toMatch(/not scored/i)
  })

  /**
   * Chỗ dễ hiểu sai nhất của cả màn hình, và nó từng hiện ra thật: "Mức nắm 0% (khoảng tin cậy
   * 0%–100%)" cho một mục chưa ai đo. Engine nay trả `null` nên không có số để in, nhưng câu
   * chữ vẫn phải nói rõ ĐÂY KHÔNG PHẢI ĐIỂM 0 — vì đó chính là điều người đọc sẽ tự suy ra.
   */
  it('lời giải thích "chưa ai đo" phải phủ nhận thẳng rằng đó là điểm 0', () => {
    expect(at(vi, 'admin.users.gap.why.rule.noEvidence') as string).toMatch(/không phải điểm 0/i)
    expect(at(en, 'admin.users.gap.why.rule.noEvidence') as string).toMatch(/not a zero/i)
  })

  it('luật "mắt xích yếu nhất" nói rõ vì sao KHÔNG lấy trung bình', () => {
    expect(at(vi, 'admin.users.gap.why.rule.weakestRequired') as string).toMatch(/trung bình/i)
    expect(at(en, 'admin.users.gap.why.rule.weakestRequired') as string).toMatch(/average/i)
  })

  it('có nút mở giải thích, cả hai ngôn ngữ', () => {
    for (const [locale, root] of [
      ['vi', vi],
      ['en', en],
    ] as const) {
      const show = at(root, 'admin.users.gap.why.show')
      expect(typeof show, locale).toBe('string')
      expect((show as string).length, locale).toBeGreaterThan(0)
    }
  })

  /** Cách B: điểm không bao giờ được đứng một mình. */
  it('chuỗi cách B luôn kèm khoảng tin cậy', () => {
    for (const [locale, text] of [
      ['vi', at(vi, 'admin.users.gap.scoreWithInterval') as string],
      ['en', at(en, 'admin.users.gap.scoreWithInterval') as string],
    ] as const) {
      expect(text, locale).toContain('{value}')
      expect(text, locale).toContain('{lo}')
      expect(text, locale).toContain('{hi}')
    }
  })
})
