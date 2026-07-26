// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * CHẠY TRỌN ĐƯỜNG BIÊN KHUNG trên một tài liệu BẤT KỲ, từ dòng lệnh.
 *
 * Đường này vốn chỉ đi được qua trình duyệt, nên mỗi lần muốn biết "một chương trình thật đi qua thì
 * ra gì" đều phải ngồi bấm. Tệ hơn: khi nó dừng vì máy bí, không có cách nào ghi lại chuỗi quyết
 * định của người duyệt để chạy lại y hệt — mà lặp lại được mới là thứ chứng minh đường này đứng
 * vững, chứ không phải một lần chạy may.
 *
 * KHÔNG có tên tài liệu, tên khung, hay một câu chữ nào của chương trình nào nằm trong file này.
 * Mọi thứ riêng của một lần chạy đi qua tham số. Tài liệu là của người dùng, và luật bản quyền của
 * dự án nói rõ: văn bản chương trình thương mại không bao giờ vào repo.
 *
 *   pnpm exec tsx src/scripts/ingest-framework.ts \
 *     --pdf <đường dẫn> [--pages 16-17] --slug <slug> --name-en "..." --name-vi "..." \
 *     [--locale en] [--decisions <file.json>] [--apply] [--out <file.json>]
 *
 * Chạy lần đầu KHÔNG kèm --decisions: nó in ra chỗ máy bí (trùng định danh, chuỗi quay vòng) kèm
 * lý do bí, rồi dừng. Ghi quyết định vào một file JSON, chạy lại kèm --decisions --apply.
 *
 * Script không tự nạp env: `set -a; . ./.env; set +a` trước khi chạy.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { CollisionDecision } from '@bingoo.ai/authoring'
import { frameworkFromText, resolveFrameworkCollisions } from '../services/authoring-framework.service'
import { applyAuthoredFramework } from '../services/authoring.service'

interface Args {
  pdf: string
  pages?: string
  slug: string
  nameEn: string
  nameVi: string
  locale: string
  decisions?: string
  out?: string
  apply: boolean
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i >= 0 ? argv[i + 1] : undefined
  }
  const pdf = get('--pdf')
  const slug = get('--slug')
  if (pdf === undefined || slug === undefined) {
    throw new Error('cần --pdf <đường dẫn> và --slug <slug>')
  }
  return {
    pdf,
    slug,
    ...(get('--pages') !== undefined ? { pages: get('--pages') as string } : {}),
    nameEn: get('--name-en') ?? slug,
    nameVi: get('--name-vi') ?? get('--name-en') ?? slug,
    locale: get('--locale') ?? 'en',
    ...(get('--decisions') !== undefined ? { decisions: get('--decisions') as string } : {}),
    ...(get('--out') !== undefined ? { out: get('--out') as string } : {}),
    apply: argv.includes('--apply'),
  }
}

/** "16" hoặc "16-18" → danh sách số trang 1-based. Rỗng = cả tài liệu. */
function pageList(spec: string | undefined, total: number): number[] {
  if (spec === undefined) return Array.from({ length: total }, (_, i) => i + 1)
  const [a, b] = spec.split('-').map((s) => Number.parseInt(s.trim(), 10))
  const from = Number.isFinite(a) ? (a as number) : 1
  const to = Number.isFinite(b) ? (b as number) : from
  const out: number[] = []
  for (let p = Math.max(1, from); p <= Math.min(total, to); p += 1) out.push(p)
  return out
}

/**
 * Rút text bằng chính thư viện mà trình xem PDF dùng.
 *
 * Đi thẳng vào file trên đĩa chứ không qua kho lưu trữ: một tài liệu chỉ để thử thì không có lý do
 * gì phải tải lên đâu cả, và đường trích chỉ cần văn bản.
 */
async function extractPages(path: string, spec: string | undefined): Promise<string> {
  const data = new Uint8Array(await readFile(path))
  const doc = await getDocument({ data, useSystemFonts: true }).promise
  const pages = pageList(spec, doc.numPages)
  const parts: string[] = []
  for (const p of pages) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()
    const line = content.items
      .map((it) => ('str' in it ? it.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (line) parts.push(line)
  }
  return parts.join('\n\n')
}

const tierMark = (e: { tier: string; machineProven?: boolean }): string =>
  e.machineProven === true ? 'CHẮC ' : `${e.tier} `

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))

  const text = await extractPages(args.pdf, args.pages)
  console.log(`nguồn: ${text.length} ký tự${args.pages ? ` (trang ${args.pages})` : ''}`)
  if (text.length < 200) throw new Error('rút được quá ít chữ — tài liệu có thể là ảnh quét, cần OCR')

  /**
   * `--resume` đọc lại bản nháp đã lưu thay vì gọi AI lần nữa.
   *
   * Không có nó thì đường này không lặp lại được: lần trích sau ra slug khác, nên chuỗi quyết định
   * của người duyệt viết cho lần trước trỏ vào những cái không còn tồn tại và bị từ chối sạch. Việc
   * duyệt chỉ có nghĩa khi nó áp lên đúng bản nháp mà người duyệt đã đọc.
   */
  const resume = process.argv.includes('--resume') ? args.out : undefined
  const draft =
    resume !== undefined
      ? ((await readFile(resume, 'utf8').then(JSON.parse)) as Awaited<ReturnType<typeof frameworkFromText>>)
      : await frameworkFromText(text, args.locale, {
          slug: args.slug,
          name: { en: args.nameEn, vi: args.nameVi },
        })

  if (args.out !== undefined && resume === undefined) {
    await writeFile(args.out, JSON.stringify(draft, null, 2))
    console.log(`bản nháp đã lưu: ${args.out} (chạy lại kèm --resume để duyệt trên đúng bản này)`)
  }

  const g = draft.compiled.graph
  const verified = draft.compiled.objectives.filter((o) => (o.evidence ?? []).some((e) => e.verified)).length
  console.log(
    `trích: ${g.nodes.filter((n) => n.kind !== 'OBJECTIVE').length} kiến thức · ${g.edges.length} quan hệ · ` +
      `${draft.compiled.objectives.length} mục tiêu (${verified} có câu-trích đã kiểm)`,
  )
  for (const w of draft.warnings.slice(0, 8)) console.log(`  cảnh báo: ${w}`)

  // ── CHỖ MÁY BÍ ───────────────────────────────────────────────────────────────────────────────
  for (const c of draft.collisions ?? []) {
    console.log(`\nTRÙNG ĐỊNH DANH: ${c.slugs[0]}  ⟷  ${c.slugs[1]}`)
    for (const ax of c.explanation.facets?.axes ?? []) {
      const state = ax.a === undefined || ax.b === undefined ? 'thiếu' : ax.same ? 'GIỐNG' : 'khác'
      console.log(`    ${ax.axis.padEnd(16)} ${state}${ax.same ? '' : `  ${ax.a ?? '·'} / ${ax.b ?? '·'}`}`)
    }
  }
  for (const cy of draft.cycles ?? []) {
    console.log(`\nQUAY VÒNG: ${cy.path.join(' → ')}`)
    for (const l of cy.links) {
      console.log(`    ${tierMark(l.explanation).padEnd(12)} ${l.from} → ${l.to}`)
    }
  }
  // Mọi thứ khác đang chặn — in ra hết, vì "còn chặn" mà không nói chặn ở đâu thì cũng là đường cụt.
  for (const v of draft.violations.filter((x) => x.severity === 'error')) {
    console.log(`\nCHẶN [${v.code}] ${v.message}`)
  }
  for (const i of draft.issues.filter((x) => x.severity === 'error')) {
    console.log(`\nCHẶN [${i.code}] ${i.message}`)
  }

  // ── QUYẾT ĐỊNH CỦA NGƯỜI DUYỆT ────────────────────────────────────────────────────────────────
  let compiled = draft.compiled
  let blocking = draft.blocking
  if (args.decisions !== undefined) {
    const decisions = JSON.parse(await readFile(args.decisions, 'utf8')) as CollisionDecision[]
    const r = await resolveFrameworkCollisions({
      graph: compiled.graph,
      objectives: compiled.objectives,
      decisions,
    })
    console.log(
      `\nngười duyệt: ${r.applied}/${decisions.length} quyết định đã thi hành` +
        (r.rejected.length
          ? ` · ${r.rejected.length} bị từ chối (${r.rejected.map((x) => x.code).join(', ')})`
          : ''),
    )
    for (const x of [...r.violations, ...r.issues].filter((x) => x.severity === 'error')) {
      console.log(`  còn chặn [${x.code}] ${x.message}`)
    }
    for (const x of r.issues.filter((x) => x.severity === 'info')) console.log(`  ${x.message}`)
    compiled = { ...compiled, graph: r.graph, objectives: [...r.objectives] }
    blocking = r.blocking
  }

  if (!args.apply) {
    console.log(blocking ? '\nCÒN CHẶN — chưa ghi.' : '\nHết chặn. Thêm --apply để ghi.')
    return
  }
  if (blocking) throw new Error('còn lỗi chặn — không ghi. Bổ sung quyết định rồi chạy lại.')

  const res = await applyAuthoredFramework({
    graph: compiled.graph,
    ...(compiled.framework ? { framework: compiled.framework } : {}),
    objectives: compiled.objectives,
    concepts: compiled.concepts,
    source: { text },
  })
  console.log(`\nĐÃ GHI: ${JSON.stringify(res)}`)
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
