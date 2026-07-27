// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Chữ của tài liệu người khác KHÔNG được vào repo công khai này.
 *
 * Đây là hàng rào cho một luật đã mắc lỗi hai lần theo cùng một kiểu: bỏ file nhưng giữ lại thứ
 * trỏ tới nó. Bộ audio bị xoá mà 162 URL vẫn ở lại catalog; một fixture giáo trình bị xoá mà mã +
 * phát biểu của cùng khung đó vẫn ngồi trong seed. Cả hai lần, diff trông sạch.
 *
 * Phần authoring sắp tới làm rủi ro đó nặng thêm: người dùng upload SÁCH (có bản quyền), và để
 * giải thích được "vì sao bài này khớp mục tiêu kia" thì hệ phải hiện lên chính chữ trong sách.
 * Ranh giới là:
 *
 *   TOẠ ĐỘ đi vào repo được  — trang, khung tô, offset, băm nội dung, verdict cấu trúc.
 *   CHỮ NGUỒN thì không       — chỉ ở DB (SourceDocument.excerptText) + file người dùng tự upload.
 *
 * Các assertion dưới đây thuộc loại PHỦ ĐỊNH: chúng đỏ khi chữ nguồn *xuất hiện lại* trong cây
 * commit — đó mới là lỗi đáng bắt, không phải lúc nó vắng mặt. Test chỉ soát thứ `git ls-files`
 * đang theo dõi, vì đó đúng là thứ đã publish; file trên đĩa mà git bỏ qua thì không tính.
 */
import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, extname, join, resolve } from 'node:path'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

const git = (...args: string[]): string =>
  execFileSync('git', args, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const tracked = (): string[] =>
  git('ls-files', '-z')
    .split('\0')
    .filter((p) => p.length > 0)

/** Chỉ đọc file dạng văn bản — chữ nguồn rò rỉ qua mã/dữ liệu, không qua ảnh hay font. */
const TEXT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.sql',
  '.prisma',
  '.yml',
  '.yaml',
  '.css',
  '.html',
  '.txt',
  '.snap',
  '.csv',
])

/**
 * File TỰ NÓI về hàng rào này thì được miễn — nếu không, test tự bắt chính mình, và cách "sửa"
 * duy nhất là làm hàng rào yếu đi.
 */
const SELF = ['apps/api/test/copyright-guard.test.ts']

/**
 * `git ls-files` liệt kê cả file đã XOÁ trên đĩa nhưng chưa đưa vào index. Đọc thẳng thì cả hàng rào
 * ném lỗi giữa chừng — và một hàng rào ném lỗi trông y hệt một hàng rào bắt được vi phạm, nên người
 * ta mất thời gian đi tìm nội dung có bản quyền không hề tồn tại.
 *
 * File không còn trên đĩa thì không chứa được chữ nào; bỏ qua ở đây không nới lỏng gì cả — git vẫn
 * chặn ở lần commit sau, và lần chạy tiếp theo lại quét đủ.
 */
const textFiles = (): { path: string; text: string }[] =>
  tracked()
    .filter((p) => TEXT_EXT.has(extname(p)) && !SELF.includes(p) && existsSync(join(REPO, p)))
    .map((p) => ({ path: p, text: readFileSync(join(REPO, p), 'utf8') }))

/**
 * Dấu vết của chữ nguồn có bản quyền.
 *
 * Mỗi mẫu nhắm vào một thứ chỉ xuất hiện khi ai đó dán nội dung tài liệu vào, chứ không phải khi
 * người ta viết mã bình thường về tài liệu. `reason` là câu nói cho người làm đỏ test biết PHẢI
 * làm gì, không phải một mã lỗi.
 */
const SIGNATURES: { name: string; all: RegExp[]; reason: string }[] = [
  {
    name: 'tên bộ sách giáo khoa',
    all: [/K[eế]t n[oố]i tri th[uứ]c|\bKNTT\b|Chân tr[oờ]i s[aá]ng t[aạ]o|C[aá]nh Di[eề]u/i],
    reason:
      'Tên bộ sách giáo khoa có bản quyền. Sách người dùng upload chỉ được nhắc tới bằng ref runtime ' +
      '(storageKey / courseSlug), không bằng tên đặt cứng trong mã.',
  },
  {
    name: 'dòng mục lục sách (bài + số trang)',
    all: [/B[aà]i\s+\d+\s*[:.].{0,80}?\b(tr|trang|p|page)\.?\s*\d+/i],
    reason:
      'Trông như một dòng mục lục dán từ sách (nhan đề bài + số trang). Cặp nhan-đề↔trang là chữ ' +
      'nguồn: để nó ở DB. Trong repo chỉ giữ TOẠ ĐỘ (page, rects, contentHash).',
  },
  {
    /**
     * Mã CỘNG phát biểu, trên cùng một dòng — không phải mã trơ.
     *
     * Mã trơ ("1Nc.01") là nhãn hàm, và repo dùng nó làm ví dụ định dạng + fixture ở bảy chỗ. Thứ
     * §1 cấm, và thứ đã khiến `test/fixtures/cambridge-moet.ts` bị bỏ, là PHÁT BIỂU nguyên văn của
     * mục tiêu. Nên tripwire đòi cả hai cùng xuất hiện: đúng hình dạng của một hàng khung bị dán
     * vào (`obj('…', '2Nc.01', 'Count objects to 100', …)`), và bỏ qua ví dụ định dạng.
     */
    name: 'mã khung bên thứ ba KÈM phát biểu',
    all: [/\b\d[A-Z][a-z]{1,2}\.\d{2}\b/, /['"][A-Z][a-z]+(\s+[\w-]+){2,}['"]/],
    reason:
      'Một dòng mang cả MÃ khung (kiểu "2Nc.01") lẫn PHÁT BIỂU mục tiêu — đó là nội dung khung của ' +
      'bên thứ ba. Khung thật đi qua luồng upload (tài liệu ở lại máy người dùng), không qua seed.',
  },
]

/** Dòng đầu tiên khớp ĐỦ mọi mẫu của một dấu vết; -1 nếu không dòng nào khớp. */
const firstHitLine = (text: string, all: RegExp[]): number =>
  text.split('\n').findIndex((line) => all.every((re) => re.test(line)))

describe('chữ nguồn có bản quyền không nằm trong cây commit', () => {
  for (const sig of SIGNATURES) {
    it(`không có ${sig.name}`, () => {
      const hits = textFiles()
        .map((f) => ({ path: f.path, line: firstHitLine(f.text, sig.all) }))
        .filter((h) => h.line >= 0)
        .map((h) => `${h.path}:${h.line + 1}`)
      // Danh sách file kèm dòng — người làm đỏ test cần biết mở chỗ nào, không phải một chữ "false".
      expect(hits, `${sig.reason}\nChỗ khớp: ${hits.join(', ')}`).toEqual([])
    })
  }
})

describe('hàng rào thật sự bắt được — kiểm bằng chính nội dung đã bị bỏ', () => {
  it('đỏ trên hàng khung bên thứ ba mà seed từng mang', () => {
    // CLAUDE.md §6: test chỉ xanh trên input tốt thì không chứng minh gì. Đây là DÒNG THẬT vừa bị
    // xoá khỏi seed — nếu mẫu không bắt được nó, hàng rào chỉ là trang trí.
    const removed = `  obj('cam-s2-2nc01', '2Nc.01', 'Count objects to 100', 'Đếm vật đến 100', ['cw-count-100']),`
    const sig = SIGNATURES.find((s) => s.name === 'mã khung bên thứ ba KÈM phát biểu')
    expect(sig).toBeDefined()
    expect(firstHitLine(removed, sig!.all)).toBe(0)
  })

  it('KHÔNG đỏ trên mã trơ dùng làm ví dụ định dạng', () => {
    // Mặt còn lại của cùng một hàng rào: bắt quá tay thì người ta sẽ nới nó ra, và khi đó nó không
    // còn bắt được gì. Hai dòng dưới là cách repo vẫn dùng mã làm ví dụ — phải xanh.
    const sig = SIGNATURES.find((s) => s.name === 'mã khung bên thứ ba KÈM phát biểu')!
    expect(firstHitLine(`  code: '1Nc.01',`, sig.all)).toBe(-1)
    expect(firstHitLine(` * Mã hiển thị của objective (vd 1Nc.02).`, sig.all)).toBe(-1)
  })
})

describe('không tài liệu nguồn nào được git theo dõi', () => {
  it('không có PDF nào tracked', () => {
    // Chương trình, sách, khung — dạng nào cũng tới đây dưới dạng PDF. Rule *.pdf trong .gitignore
    // là im lặng, không cưỡng chế: nó không chặn `git add -f`, cũng không chặn file đã tracked từ
    // trước. Đây là chỗ cưỡng chế.
    const pdfs = tracked().filter((p) => p.toLowerCase().endsWith('.pdf'))
    expect(pdfs, `PDF bị commit: ${pdfs.join(', ')}. Tài liệu ở lại máy người dùng.`).toEqual([])
  })

  it('.gitignore vẫn còn rule chặn PDF toàn cây', () => {
    // Rule này từng chỉ tồn tại trong working tree của một máy. Nếu ai bỏ nó đi, lần `git add -A`
    // kế tiếp sẽ publish một cuốn sách — nên mất rule phải làm test đỏ, không phải chờ phát hiện sau.
    const ignore = readFileSync(join(REPO, '.gitignore'), 'utf8')
    expect(ignore).toMatch(/^\*\.pdf$/m)
  })
})
