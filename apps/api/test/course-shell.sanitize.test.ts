// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * VỎ KHOÁ TỪ SÁCH — hai lời hứa với người dùng, khoá lại bằng test (chạy offline, không LLM):
 *   ① Sinh từ sách thì GIỮ ĐÚNG cấu trúc & thứ tự của sách (không sắp lại theo tiên quyết).
 *   ② Bài không map được KC nào VẪN giữ đúng chỗ, được ghi nhận — bỏ đi là nói dối về sách.
 */

import { describe, expect, it } from 'vitest'
import { sanitizeCourse } from '../src/services/course-shell.sanitize'
import { ModelReplyError, parseModelJson } from '../src/lib/model-json'

const allowed = new Set(['count-to-10', 'add-within-20', 'parity'])

// Output kiểu LLM: thứ tự SÁCH (cố ý không theo tiên quyết), có chương ôn tập + bài ngoài stage + slug bịa.
const bookLike = {
  slug: 'stage1-book',
  title: { en: 'Stage 1', vi: 'Lớp 1' },
  objectives: [],
  units: [
    {
      title: { en: 'Getting started' },
      sourceRef: 'Unit 1',
      lessons: [{ title: { en: 'Counting to 10' }, sourceRef: '1.1', teaches: ['count-to-10'] }],
    },
    {
      title: { en: 'Shapes' },
      sourceRef: 'Unit 2',
      lessons: [
        { title: { en: '2D shapes' }, sourceRef: '2.1', teaches: [] }, // ngoài framework
      ],
    },
    {
      title: { en: 'Addition' },
      sourceRef: 'Unit 3',
      lessons: [
        { title: { en: 'Adding within 20' }, sourceRef: '3.1', teaches: ['add-within-20'] },
        { title: { en: 'Odd and even' }, sourceRef: '3.3', teaches: ['parity'] },
      ],
    },
    {
      title: { en: 'Check your progress' },
      sourceRef: 'Unit 4',
      lessons: [
        { title: { en: 'Mid-year review' }, sourceRef: '4.1', teaches: [] }, // ôn tập
      ],
    },
    {
      title: { en: 'Times tables (preview)' },
      sourceRef: 'Unit 6',
      lessons: [
        { title: { en: 'The 2 times table' }, sourceRef: '6.1', teaches: ['the-2-times-table'] }, // slug bịa
      ],
    },
  ],
}

describe('nguồn SÁCH — preserveStructure', () => {
  const { plan, unmappedLessons } = sanitizeCourse(bookLike, allowed, { preserveStructure: true })

  it('GIỮ ĐÚNG thứ tự chương theo sách, không sắp lại', () => {
    expect(plan.units.map((u) => u.title.en)).toEqual([
      'Getting started',
      'Shapes',
      'Addition',
      'Check your progress',
      'Times tables (preview)',
    ])
  })

  it('GIỮ ĐỦ mọi bài — kể cả bài không map được KC nào (bỏ = nói dối về sách)', () => {
    expect(plan.units.reduce((n, u) => n + u.lessons.length, 0)).toBe(6)
  })

  it('bài chưa map được ghi nhận đúng (theo sourceRef của sách)', () => {
    expect([...unmappedLessons]).toEqual(['2.1', '4.1', '6.1'])
  })

  it('slug model BỊA ("the-2-times-table", không có trong đồ thị) bị loại khỏi teaches', () => {
    const all = plan.units.flatMap((u) => u.lessons).flatMap((l) => l.teaches)
    expect(all).not.toContain('the-2-times-table')
    expect(all).toEqual(['count-to-10', 'add-within-20', 'parity']) // chỉ KC có thật
  })

  it('bài giữ đúng THỨ TỰ trong từng chương', () => {
    const addition = plan.units.find((u) => u.title.en === 'Addition')
    expect(addition?.lessons.map((l) => l.title.en)).toEqual(['Adding within 20', 'Odd and even'])
  })
})

describe('nguồn PROMPT — không có "cấu trúc gốc" để trung thành → bỏ bài rỗng', () => {
  it('chỉ giữ bài có teaches', () => {
    const { plan } = sanitizeCourse(bookLike, allowed, {})
    expect(plan.units.reduce((n, u) => n + u.lessons.length, 0)).toBe(3)
  })
})

/**
 * Câu trả lời hỏng phải DỪNG, không được biến thành một vật rỗng đi tiếp.
 *
 * Test cũ ở đây khai đúng ý ("cắt JSON là hỏng TO, không nuốt") rồi ghim CHÍNH cái hành vi nuốt:
 * nó khẳng định hỏng thì trả `{}`, và ghi chú "lớp gọi phải tự ném lỗi rỗng" — mà không lớp gọi nào
 * làm thế. Bốn chỗ trong repo chép đoạn ấy, và cả bốn đều đi tiếp với vật rỗng: kế hoạch bài, kế
 * hoạch khoá, vỏ khoá từ sách, bản nháp khung. Cái tệ nhất là kế hoạch bài — nó được LƯU kèm tên
 * model và dấu vân prompt, tức hồ sơ khai rằng AI soạn ra một thứ AI chưa từng trả về.
 */
describe('câu trả lời hỏng thì DỪNG, không đi tiếp với vật rỗng', () => {
  it('không có JSON → ném, và nói rõ bước nào hỏng', () => {
    expect(() => parseModelJson('xin lỗi tôi không thể', 'Không dựng được vỏ khoá học')).toThrow(
      /Không dựng được vỏ khoá học/,
    )
  })

  it('JSON cắt dở → ném, KHÔNG coi là vỏ khoá hợp lệ', () => {
    expect(() => parseModelJson('{"units":[{"title":{"en":"A"}', 'Không dựng được vỏ khoá học')).toThrow(
      ModelReplyError,
    )
  })

  it('JSON đọc được thì trả về đúng nội dung', () => {
    expect(parseModelJson('{"a":1}', 'x')).toEqual({ a: 1 })
  })
})

/**
 * BA CÂU HỎI VỀ SÁCH mà chỗ lọc từng nuốt sạch.
 *
 * `keep()` cũ vứt mọi slug không có trong vốn từ khung, không để lại gì. Một dòng đó giết cả hai
 * việc: sách dạy thêm cái gì (làm dày), và vì sao một đề xuất bị loại (lọc). Cả hai đọc lên giống
 * hệt "sách không dạy gì cả", và không ai truy được ngược.
 */
describe('sách nói được nó dạy gì ngoài khung, và cái gì bị loại', () => {
  const allowed = new Set(['count-100', 'add-100'] as Slug[])
  const book = {
    slug: 'book',
    title: { en: 'Book', vi: 'Sách' },
    units: [
      {
        slug: 'u1',
        title: { en: 'Unit 1', vi: 'Chương 1' },
        lessons: [
          {
            slug: 'l1',
            title: { en: 'Counting', vi: 'Đếm' },
            teaches: [
              { slug: 'count-100', quote: 'Đếm các số trong phạm vi 100.' },
              { slug: 'khong-co-trong-khung' },
            ],
            proposes: [{ title: 'Estimate quantities', quote: 'Ước lượng số lượng đồ vật.' }],
          },
          { slug: 'l2', title: { en: 'Revision', vi: 'Ôn tập' }, teaches: [] },
        ],
      },
    ],
  }

  it('ánh xạ giữ được CÂU TRONG SÁCH — không có câu thì không kiểm được gì', () => {
    const r = sanitizeCourse(book, allowed, { preserveStructure: true })
    expect(r.mappings).toHaveLength(1)
    expect(r.mappings[0]?.conceptSlug).toBe('count-100')
    expect(r.mappings[0]?.quote).toBe('Đếm các số trong phạm vi 100.')
  })

  it('slug không có trong khung bị loại NHƯNG có lý do đi kèm', () => {
    const r = sanitizeCourse(book, allowed, { preserveStructure: true })
    expect(r.dropped).toEqual([
      { lessonSlug: 'l1', proposed: 'khong-co-trong-khung', reason: 'not-in-vocabulary' },
    ])
    // và nó KHÔNG lọt vào vỏ khoá — vỏ khoá vẫn chỉ neo vào đồ thị thật.
    expect(r.plan.units[0]?.lessons[0]?.teaches).toEqual(['count-100'])
  })

  it('sách dạy thứ khung chưa có → thành ĐỀ XUẤT, không bị vứt', () => {
    const r = sanitizeCourse(book, allowed, { preserveStructure: true })
    expect(r.proposed).toEqual([
      { title: 'Estimate quantities', lessonSlug: 'l1', quote: 'Ước lượng số lượng đồ vật.' },
    ])
  })

  it('dạng cũ (mảng chuỗi) vẫn nhận — không vứt một câu trả lời đúng vì sai vỏ', () => {
    const old = {
      ...book,
      units: [{ ...book.units[0], lessons: [{ slug: 'l1', title: { en: 'C' }, teaches: ['add-100'] }] }],
    }
    const r = sanitizeCourse(old, allowed, { preserveStructure: true })
    expect(r.plan.units[0]?.lessons[0]?.teaches).toEqual(['add-100'])
    expect(r.mappings[0]?.quote).toBeUndefined() // và nói thật là không có câu trích
  })

  it('bài ôn tập vẫn giữ đúng chỗ, và vẫn được đếm là chưa neo', () => {
    const r = sanitizeCourse(book, allowed, { preserveStructure: true })
    expect(r.plan.units[0]?.lessons).toHaveLength(2)
    expect(r.unmappedLessons).toContain('Revision')
  })
})
