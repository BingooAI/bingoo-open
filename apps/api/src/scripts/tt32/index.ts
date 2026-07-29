// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CLI — bóc tách Thông tư 32/2018 (Chương trình GDPT 2018) ra JSON có toạ độ.
 *
 *   cd apps/api
 *   pnpm exec tsx src/scripts/tt32/index.ts [đường-dẫn.pdf] [--out <thư mục>]
 *
 * Không cần env (chỉ đọc file + ghi thư mục ra). Mặc định đọc PDF ở gốc repo và ghi vào `out/tt32`
 * — `out/` đã gitignore: file chương trình và bản bóc tách của nó KHÔNG ra repo công khai.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractPages } from './extract-pdf'
import { buildLayout } from './layout'
import { writeArtifacts } from './emit'

const REPO_ROOT = resolve(import.meta.dirname, '../../../../..')
const DEFAULT_PDF = 'thong-tu-32-2018-tt-bgddt-ban-hanh-chuong-trinh-giao-duc-pho-thong-moi_332022836.pdf'

function parseArgs(argv: readonly string[]): { pdf: string; out: string } {
  const rest = [...argv]
  let out = resolve(REPO_ROOT, 'out/tt32')
  const at = rest.indexOf('--out')
  if (at !== -1) {
    out = resolve(rest[at + 1] ?? out)
    rest.splice(at, 2)
  }
  const pdf = resolve(rest[0] ?? resolve(REPO_ROOT, DEFAULT_PDF))
  return { pdf, out }
}

const { pdf, out } = parseArgs(process.argv.slice(2))
const bytes = new Uint8Array(readFileSync(pdf))
const sha256 = createHash('sha256').update(bytes).digest('hex')
console.log(`Đọc ${pdf}\n  sha256 ${sha256}  ·  ${(bytes.length / 1e6).toFixed(1)} MB`)

const pages = await extractPages(bytes, (p, total) => {
  if (p % 200 === 0 || p === total) process.stderr.write(`  … ${p}/${total} trang\n`)
})
const layout = buildLayout(pages)
writeArtifacts(out, layout, { file: DEFAULT_PDF, sha256, pageCount: pages.length })

const spans = layout.parts.reduce((n, p) => n + p.spans.length, 0)
const blocks = layout.parts.reduce((n, p) => n + p.blocks.length, 0)
const kinds = new Map<string, number>()
for (const p of layout.parts) for (const b of p.blocks) kinds.set(b.kind, (kinds.get(b.kind) ?? 0) + 1)
const noText = layout.pages.filter((p) => !p.textLayer).length
const lineOnly = layout.pages.filter((p) => p.precision === 'line').length

console.log(`\nĐã ghi ${out}`)
console.log(`  ${layout.parts.length} phần · ${pages.length} trang · ${spans} từ · ${blocks} khối`)
console.log(`  khối theo loại: ${[...kinds].map(([k, n]) => `${k}=${n}`).join(' · ')}`)
console.log(`  trang không có lớp text: ${noText} · trang phải lùi về mức dòng: ${lineOnly}`)
if (layout.warnings.length > 0) {
  console.log(`  cảnh báo: ${layout.warnings.length} (xem document.json)`)
  for (const w of layout.warnings.slice(0, 5)) console.log(`    · ${w}`)
}
for (const p of layout.parts) {
  console.log(
    `  [${String(p.index).padStart(2, '0')}] ${p.slug} — trang ${p.pageStart}–${p.pageEnd} · ${p.blocks.length} khối`,
  )
}
