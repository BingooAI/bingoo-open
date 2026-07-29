// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * GHI ARTIFACT — bốn lớp, mỗi lớp một việc:
 *
 *   document.json   bản kê: băm nội dung, khổ trang, 28 phần, độ chính xác từng trang, cảnh báo
 *   outline.json    cây tiêu đề → blockId (mục lục để máy điều hướng)
 *   parts/…/spans.jsonl   LỚP 0 — mỗi TỪ một hộp, theo thứ tự đọc (khớp `PositionedUnit`)
 *   parts/…/blocks.jsonl  LỚP 2 — khối ngữ nghĩa, trỏ ngược vào spans
 *   parts/…/doc.md        LỚP 3 — bản đọc cho người/LLM, mỗi khối gắn `^id`
 *
 * `spans.jsonl` là NGUỒN SỰ THẬT DUY NHẤT về toạ độ mức từ; block không nhân bản hộp từ, chỉ giữ
 * hộp mức DÒNG để vẽ nhanh và một khoảng [đầu, cuối] trỏ vào spans (R3 — một nguồn sự thật).
 *
 * Đầu ra KHÔNG có dấu thời gian: chạy lại trên cùng file cho ra byte y hệt, nên so diff được.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Block, DocumentLayout, Part } from './model'

export const EXTRACTOR_VERSION = '1.0.0'

export interface SourceMeta {
  readonly file: string
  readonly sha256: string
  readonly pageCount: number
}

/** Rỗng thì ghi tệp RỖNG, không ghi một dòng trắng — phần 00 (ảnh scan) không có khối nào, và một
 *  dòng trắng làm mọi trình đọc jsonl ngây thơ ném lỗi ngay dòng đầu. */
const jsonl = (rows: readonly unknown[]): string =>
  rows.length === 0 ? '' : rows.map((r) => JSON.stringify(r)).join('\n') + '\n'

const partDir = (part: Part): string => `${String(part.index).padStart(2, '0')}-${part.slug}`

interface OutlineNode {
  readonly id: string
  readonly text: string
  readonly level: number
  readonly page: number
  readonly pageLabel: number | null
  readonly children: OutlineNode[]
}

function outlineOf(part: Part): OutlineNode[] {
  const roots: OutlineNode[] = []
  const stack: OutlineNode[] = []
  for (const b of part.blocks) {
    if (b.kind !== 'heading' || b.level === undefined) continue
    const node: OutlineNode = {
      id: b.id,
      text: b.text,
      level: b.level,
      page: b.page,
      pageLabel: b.pageLabel,
      children: [],
    }
    while (stack.length > 0 && (stack[stack.length - 1] as OutlineNode).level >= node.level) stack.pop()
    const parent = stack[stack.length - 1]
    if (parent === undefined) roots.push(node)
    else parent.children.push(node)
    stack.push(node)
  }
  return roots
}

/** Markdown cho LLM đọc: giữ thứ bậc, giữ nhãn cột, và gắn id để trích dẫn quy được về toạ độ. */
function markdownOf(part: Part): string {
  const out: string[] = [
    `# ${part.title}`,
    '',
    `> Phần ${part.index} · trang PDF ${part.pageStart}–${part.pageEnd}`,
    '',
  ]
  let lastPage = -1
  let lastCell = ''
  for (const b of part.blocks) {
    if (b.kind === 'page_number') continue
    if (b.page !== lastPage) {
      out.push('', `<!-- trang PDF ${b.page}${b.pageLabel === null ? '' : ` · trang in ${b.pageLabel}`} -->`)
      lastPage = b.page
    }
    // Nhãn cột in MỘT lần cho mỗi ô, không lặp trên từng gạch đầu dòng trong ô đó.
    const cellId = b.cell === undefined ? '' : `${b.cell.table}:${b.cell.row}:${b.cell.col}`
    const label =
      b.cell?.header === undefined || cellId === lastCell || b.kind === 'table_header'
        ? ''
        : `**${b.cell.header}:** `
    lastCell = cellId
    const anchor = ` ^${b.id}`
    switch (b.kind) {
      case 'heading':
        out.push('', `${'#'.repeat(Math.min(6, (b.level ?? 1) + 1))} ${b.text}${anchor}`, '')
        break
      case 'table_heading':
        out.push('', `**${b.text}**${anchor}`, '')
        break
      case 'table_header':
        break // nhãn cột đã đi kèm ô dữ liệu bên dưới, không in lại thành một dòng riêng
      case 'table_cell':
      case 'list_item':
        out.push(`- ${label}${b.text}${anchor}`)
        break
      default:
        out.push(`${b.text}${anchor}`)
        break
    }
  }
  return out.join('\n').replace(/\n{3,}/gu, '\n\n') + '\n'
}

const countBy = <T extends string>(xs: readonly T[]): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const x of xs) out[x] = (out[x] ?? 0) + 1
  return out
}

/**
 * README đi kèm artifact. Sinh ra cùng dữ liệu chứ không viết tay: người (hoặc mô hình) nhận được
 * thư mục này mà không có repo vẫn biết mỗi trường nghĩa là gì và tô sáng bằng cách nào.
 */
function readmeOf(layout: DocumentLayout, source: SourceMeta): string {
  const parts = layout.parts
    .map(
      (p) =>
        `| ${p.index} | \`${partDir(p)}\` | ${p.title} | ${p.pageStart}–${p.pageEnd} | ${p.blocks.length} |`,
    )
    .join('\n')
  return `# Thông tư 32/2018 — bản bóc tách có toạ độ

Sinh bằng \`apps/api/src/scripts/tt32/index.ts\` (bộ bóc tách v${EXTRACTOR_VERSION}) từ:

- \`${source.file}\` · ${source.pageCount} trang · sha256 \`${source.sha256}\`

Toạ độ chỉ đúng với ĐÚNG bản file có băm trên. File đổi thì băm đổi, và mọi rect ở đây hết hiệu lực.
Chạy lại trên cùng file cho ra byte y hệt (không có dấu thời gian trong output).

## Ba lớp

| Tệp | Là gì | Dùng khi |
|---|---|---|
| \`parts/*/spans.jsonl\` | mỗi dòng một **TỪ** kèm hộp | tô sáng chính xác, khớp lại câu trích |
| \`parts/*/blocks.jsonl\` | mỗi dòng một **khối ngữ nghĩa** | trích dẫn, hỏi đáp, dựng khung năng lực |
| \`parts/*/doc.md\` | bản đọc cho người/LLM | nhét vào ngữ cảnh mô hình |

\`document.json\` là bản kê (độ chính xác từng trang, cảnh báo). \`outline.json\` là cây tiêu đề.

## Toạ độ

Mọi \`rect\` là **0..1 theo khổ trang, gốc GÓC TRÊN-TRÁI**: \`x\` từ mép trái, \`y\` từ mép trên,
\`w\`/\`h\` là bề rộng/chiều cao chia cho khổ trang. Chiều cao một từ bằng cỡ chữ, **đường chân chữ
nằm ở cạnh DƯỚI hộp**. Nhân với kích thước ảnh render là ra pixel — không phụ thuộc DPI hay zoom:

\`\`\`js
const box = { left: r.x * W, top: r.y * H, width: r.w * W, height: r.h * H }
\`\`\`

## Tô sáng một trích dẫn

1. Có \`blockId\` → đọc \`blocks.jsonl\`, lấy \`page\` + \`rects\` (một hộp mỗi dòng). Xong.
2. Chỉ có một câu chữ → đọc \`spans.jsonl\` của phần đó, đưa vào \`locateInUnits(quote, units)\`
   của \`@bingoo.ai/authoring\` với \`{ text: t, page: p, rect: {x,y,w,h}, order: i }\`.
   Câu xuất hiện nhiều lần thì lõi CỐ Ý không trả khung — biết trang nhưng không biết chỗ nào.

## Trường của một khối

- \`id\` \`tt32.<phần>.p<trang PDF>.<thứ tự trong trang>\` — ổn định khi bóc lại cùng file.
- \`hash\` 8 hex đầu của sha256(text) — dùng để biết một trích dẫn cũ còn trỏ đúng chữ không.
- \`page\` số trang **PDF** (1..${source.pageCount}); \`pageLabel\` số trang **in trên giấy**
  (mỗi phần đánh lại từ đầu, trang bìa không có số).
- \`kind\` \`heading\` · \`para\` · \`list_item\` · \`table_heading\` · \`table_header\` ·
  \`table_cell\` · \`page_number\`.
- \`path\` đường dẫn ngữ nghĩa: phần → mục → lớp → mạch kiến thức → chủ đề → nhãn cột.
  Đây là thứ làm cho một "yêu cầu cần đạt" tự nói được nó thuộc về đâu.
- \`spans\` \`[đầu, cuối]\` — khoảng chỉ số vào \`spans.jsonl\` (bao gồm cả hai đầu).
- \`cell\` vị trí trong lưới bảng của trang đó, suy từ **nét kẻ thật** của bảng.

## Chữ đã DỰNG LẠI — biết để khỏi tưởng là chữ gốc

PDF không lưu câu, nó lưu từng glyph ở từng toạ độ. Ba thứ dưới đây trong bản in là **xếp tầng**,
lấy thô ra sẽ mất nghĩa, nên chúng được dựng lại và ghi nhận số lượng ở \`document.json\`:

| Trong bản in | Trong artifact | Vì sao |
|---|---|---|
| \`1\` trên gạch, \`2\` dưới gạch | \`1/2\` | Ba tầng: tử · câu văn · mẫu. Lấy thô ra thì câu còn \`"– Nhận biết được ; ;...; thông qua"\` |
| \`mm²\`, \`60°\` | \`mm^2\`, \`60^o\` | Số nhấc nằm ở baseline khác; lấy thô ra thì thành \`"diện tích (mm , cm , dm , m )"\` |
| glyph font Symbol | \`≠ λ ∑ Δ ° → ∞ ×\` | Font không khai \`ToUnicode\`; xem bảng \`symbolsMapped\` để kiểm từng mã |

Hộp của một phân số trùm **cả tử lẫn mẫu**; hộp của \`mm^2\` trùm cả chân lẫn số nhấc — nên tô sáng
vẫn phủ đúng chỗ. Ba phép này là **dựng lại có ghi nhận**, không phải chữ nguyên văn trong luồng
text của PDF: đối chiếu với bản in thì khớp, còn đối chiếu với \`copy‑paste\` từ trình đọc PDF thì
không, vì chính trình đọc cũng làm rơi mấy ký tự đó.

## Giới hạn — đọc trước khi tin

- **Trang 1–3 không có chữ.** Bản Thông tư ký đóng dấu là ảnh scan; không OCR.
- **Hộp ở mức TỪ**, không mức chữ cái — tô nửa từ là chính xác giả.
- **Khối không vắt qua trang.** Một đoạn bị ngắt giữa hai trang thành hai khối, vì một khối chỉ
  mang hộp của một trang.
- **Chỉ số hàng/cột đếm lại theo từng trang**; bảng dài nhiều trang không có số hàng chạy suốt.
- Trang nào chuỗi glyph dựng lại không khớp pdfjs sẽ bị hạ xuống \`precision: "line"\` và ghi vào
  \`document.json\` — hiện **không có trang nào** như vậy.

## ${layout.parts.length} phần

| # | Thư mục | Tên | Trang PDF | Khối |
|---|---|---|---|---|
${parts}
`
}

export function writeArtifacts(outDir: string, layout: DocumentLayout, source: SourceMeta): void {
  mkdirSync(join(outDir, 'parts'), { recursive: true })
  writeFileSync(join(outDir, 'README.md'), readmeOf(layout, source))

  for (const part of layout.parts) {
    const dir = join(outDir, 'parts', partDir(part))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'spans.jsonl'),
      jsonl(part.spans.map((s) => ({ i: s.i, p: s.page, t: s.text, ...s.rect }))),
    )
    writeFileSync(join(dir, 'blocks.jsonl'), jsonl(part.blocks as readonly Block[]))
    writeFileSync(join(dir, 'doc.md'), markdownOf(part))
  }

  writeFileSync(
    join(outDir, 'outline.json'),
    JSON.stringify(
      layout.parts.map((p) => ({
        part: p.slug,
        title: p.title,
        pageStart: p.pageStart,
        headings: outlineOf(p),
      })),
      null,
      2,
    ) + '\n',
  )

  writeFileSync(
    join(outDir, 'document.json'),
    JSON.stringify(
      {
        source,
        extractor: {
          version: EXTRACTOR_VERSION,
          unit: 'word',
          coords: 'Rect 0..1 theo khổ trang, gốc góc trên-trái (khớp @bingoo.ai/authoring)',
          note: 'spans.jsonl khớp PositionedUnit → dùng thẳng với locateInUnits.',
        },
        parts: layout.parts.map((p) => ({
          index: p.index,
          slug: p.slug,
          title: p.title,
          dir: `parts/${partDir(p)}`,
          pageStart: p.pageStart,
          pageEnd: p.pageEnd,
          spans: p.spans.length,
          blocks: p.blocks.length,
          kinds: countBy(p.blocks.map((b) => b.kind)),
        })),
        symbolsMapped: layout.symbolsMapped,
        pages: layout.pages,
        warnings: layout.warnings,
      },
      null,
      2,
    ) + '\n',
  )
}
