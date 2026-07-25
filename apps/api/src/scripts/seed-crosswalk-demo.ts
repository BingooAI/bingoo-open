// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SEED DEMO CROSSWALK — khung mẫu "Khung B" ↔ GDPT 2018 (MOET) Toán Lớp 1.
 *
 * Dựng một lát cắt "Số & Phép tính" của HAI khung để minh hoạ ba thứ người dùng hỏi:
 *   1) TÍNH CHẶT CHẼ / LIÊN KẾT — các KC nền nối nhau bằng cạnh TIÊN QUYẾT (đếm → so sánh → cộng trừ;
 *      đếm bước → nhân → chia/bảng cửu chương). Đồ thị không còn là bãi node rời.
 *   2) CROSSWALK — hai khung KHÔNG nối objective↔objective (repo cấm: authoring.repo.ts:387).
 *      "Trùng" thể hiện bằng việc objective của cả hai khung cùng MAPS_TO MỘT KC nền chung.
 *   3) GAP khi chuyển khung — KC mà Khung B phủ nhưng MOET Lớp 1 KHÔNG: chẵn/lẻ, nhân, chia,
 *      bảng cửu chương, phân số, đếm bước. Học xong MOET Lớp 1 sang Khung B là thiếu đúng những
 *      KC đó (đọc qua FrameworkReport — báo cáo tính theo KC nền, không cần dịch hồ sơ).
 *
 * BẢN QUYỀN: "Khung B" là dữ liệu BỊA (xem chú thích tại DEMO_FRAMEWORK_B) — repo công khai không
 * mang mã/phát biểu của khung thương mại nào. Phía MOET trích Thông tư 32 (văn bản quy phạm pháp
 * luật — Luật SHTT loại khỏi bảo hộ quyền tác giả). Khung thật đi qua luồng upload, không qua seed.
 * Titles ĐỦ song ngữ {vi,en} (R4).
 *
 * Đi qua CỔNG BẤT BIẾN (applyAuthoredFramework → checkInvariants I1–I8): mỗi KC math khai đủ trục
 * bắt buộc object+channel, và (object,scope) khác nhau nên không trùng định danh 15 KC Stage 1 sẵn có.
 * Idempotent theo slug (I1 khử trùng cùng-slug) — mỗi khung khai cùng đồ thị KC nền; chạy lại an toàn.
 *
 * Chạy:  cd apps/api && set -a; . ./.env; set +a; pnpm exec tsx src/scripts/seed-crosswalk-demo.ts
 */

import { readFileSync } from 'node:fs'
import type { GraphData, SkillEdge, SkillNode } from '@bingoo.ai/knowledge-engine'
import type { CompiledObjective } from '@bingoo.ai/authoring'
import { applyAuthoredFramework } from '../services/authoring.service'
import { contentHashOf, pdfPositionedUnits } from '../services/pdf-anchor.service'
import { resolveSourcePath, writeObjectiveTraces } from '../services/decision-trace.service'

// ── KC nền CHUNG (within-100 / Stage 2–Lớp 1). object+channel bắt buộc; scope để phân biệt định danh.
const kc = (
  slug: string,
  en: string,
  vi: string,
  object: string,
  channel: string,
  scope: Record<string, string | number>,
  kind: SkillNode['kind'] = 'SKILL',
): SkillNode => ({
  slug,
  title: { en, vi },
  kind,
  subject: 'math',
  strand: 'Number',
  facets: { object, channel, scope },
})

const KCS: SkillNode[] = [
  kc('cw-count-100', 'Count within 100', 'Đếm trong phạm vi 100', 'counting', 'compute', { max: 100 }),
  kc(
    'cw-place-value-100',
    'Place value: tens and ones to 100',
    'Giá trị vị trí: chục và đơn vị đến 100',
    'place-value',
    'understand',
    { max: 100 },
    'KNOWLEDGE',
  ),
  kc(
    'cw-compare-100',
    'Compare and order numbers to 100',
    'So sánh và sắp thứ tự số đến 100',
    'comparison',
    'compute',
    { max: 100 },
  ),
  kc(
    'cw-meaning-addsub',
    'Meaning of addition and subtraction',
    'Ý nghĩa phép cộng và phép trừ',
    'operation-meaning',
    'understand',
    { max: 100 },
    'KNOWLEDGE',
  ),
  kc(
    'cw-addsub-100',
    'Add and subtract within 100 (no regrouping)',
    'Cộng, trừ trong phạm vi 100 (không nhớ)',
    'addition+subtraction',
    'compute',
    { max: 100 },
  ),
  kc(
    'cw-mental-10',
    'Mental addition and subtraction within 10',
    'Cộng, trừ nhẩm trong phạm vi 10',
    'mental-calculation',
    'recall',
    { max: 10 },
  ),
  kc(
    'cw-skip-count-100',
    'Count in steps of 2, 5 and 10 to 100',
    'Đếm bước 2, 5, 10 đến 100',
    'skip-counting',
    'compute',
    { max: 100 },
  ),
  // ── Chỉ Khung B phủ (MOET Lớp 1 chưa) — đây là GAP khi chuyển MOET → Khung B:
  kc(
    'cw-even-odd-100',
    'Even and odd numbers to 100',
    'Số chẵn và số lẻ đến 100',
    'parity',
    'understand',
    { max: 100 },
    'KNOWLEDGE',
  ),
  kc(
    'cw-multiply',
    'Multiplication as repeated addition and arrays',
    'Phép nhân như cộng lặp và mảng',
    'multiplication',
    'understand',
    { max: 100 },
    'KNOWLEDGE',
  ),
  kc(
    'cw-divide',
    'Division as sharing and grouping',
    'Phép chia như chia đều và chia nhóm',
    'division',
    'understand',
    { max: 100 },
    'KNOWLEDGE',
  ),
  kc('cw-times-tables', 'Times tables for 2, 5 and 10', 'Bảng nhân 2, 5 và 10', 'times-tables', 'recall', {
    tables: '2,5,10',
  }),
  kc(
    'cw-unit-fraction',
    'A quarter as one of four equal parts',
    'Một phần tư là một trong bốn phần bằng nhau',
    'fraction',
    'understand',
    { parts: 4 },
    'KNOWLEDGE',
  ),
]

// ── TIÊN QUYẾT giữa KC (linkage). DAG: đếm là gốc; nhân mở ra chia + bảng cửu chương.
const pre = (from: string, to: string): SkillEdge => ({
  from,
  to,
  mode: 'RECOMMENDED',
  relType: 'PREREQUISITE',
  weight: 1,
})
const EDGES: SkillEdge[] = [
  pre('cw-count-100', 'cw-place-value-100'),
  pre('cw-count-100', 'cw-compare-100'),
  pre('cw-count-100', 'cw-skip-count-100'),
  pre('cw-count-100', 'cw-meaning-addsub'),
  pre('cw-place-value-100', 'cw-addsub-100'),
  pre('cw-meaning-addsub', 'cw-addsub-100'),
  pre('cw-mental-10', 'cw-addsub-100'),
  pre('cw-skip-count-100', 'cw-even-odd-100'),
  pre('cw-skip-count-100', 'cw-multiply'),
  pre('cw-multiply', 'cw-divide'),
  pre('cw-multiply', 'cw-times-tables'),
]

const GRAPH: GraphData = { nodes: KCS, edges: EDGES }

const obj = (slug: string, code: string, en: string, vi: string, mapsTo: string[]): CompiledObjective => ({
  slug,
  title: { en, vi },
  code,
  mapsTo,
})

/**
 * Khung THỨ HAI của demo — **dữ liệu bịa, không phải khung thật của ai**.
 *
 * Chỗ này từng mang mã + phát biểu nguyên văn của một khung tiểu học thương mại. Đó là tài sản
 * trí tuệ của bên thứ ba, và repo này công khai (§1 đã bỏ `test/fixtures/cambridge-moet.ts` vì
 * đúng lý do đó — giữ lại ở đây thì chỉ là cùng một vi phạm ở chỗ khó thấy hơn).
 *
 * Demo không cần một khung thật để chứng minh điều nó muốn chứng minh: cái cần là HAI khung khác
 * nhau cùng chứng nhận một số KC nền (→ "trùng") và một khung phủ thêm KC khung kia không có
 * (→ "lệch"). Một khung bịa làm việc đó y hệt, và người đọc seed biết ngay đây là dữ liệu mẫu.
 *
 * Muốn chạy demo trên khung thật: upload PDF của khung đó qua luồng "Sinh khung năng lực" — đó là
 * đường dành cho khung thật, và tài liệu ở lại máy người dùng thay vì vào git.
 */
const DEMO_FRAMEWORK_B: CompiledObjective[] = [
  obj(
    'demo-b-n01',
    'D2.N.01',
    'Count a group of objects up to one hundred',
    'Đếm một nhóm vật đến một trăm',
    ['cw-count-100'],
  ),
  obj('demo-b-n02', 'D2.N.02', 'Count forward in twos, fives and tens', 'Đếm tiến theo 2, 5 và 10', [
    'cw-skip-count-100',
  ]),
  obj('demo-b-n03', 'D2.N.03', 'Tell an even number from an odd number', 'Phân biệt số chẵn với số lẻ', [
    'cw-even-odd-100',
  ]),
  obj('demo-b-n04', 'D2.N.04', 'Read a numeral and write it down', 'Đọc một chữ số và viết lại', [
    'cw-count-100',
  ]),
  obj(
    'demo-b-n05',
    'D2.N.05',
    'Treat adding and taking away as opposite moves',
    'Coi thêm vào và bớt ra là hai chiều ngược nhau',
    ['cw-meaning-addsub'],
  ),
  obj(
    'demo-b-n06',
    'D2.N.06',
    'Add and take away two-digit numbers with no carrying',
    'Cộng và bớt số hai chữ số mà không phải nhớ',
    ['cw-addsub-100'],
  ),
  obj(
    'demo-b-n07',
    'D2.N.07',
    'Read multiplying as repeated groups',
    'Hiểu nhân là gộp nhiều nhóm bằng nhau',
    ['cw-multiply'],
  ),
  obj(
    'demo-b-n08',
    'D2.N.08',
    'Read dividing as sharing into equal groups',
    'Hiểu chia là chia thành nhóm đều',
    ['cw-divide'],
  ),
  obj(
    'demo-b-n09',
    'D2.N.09',
    'Recall the two, five and ten multiplication facts',
    'Nhớ các phép nhân với 2, 5 và 10',
    ['cw-times-tables'],
  ),
  obj(
    'demo-b-n10',
    'D2.N.10',
    'Split a two-digit number into tens and ones',
    'Tách số hai chữ số thành chục và đơn vị',
    ['cw-place-value-100'],
  ),
  obj(
    'demo-b-n11',
    'D2.N.11',
    'Put numbers up to one hundred in order',
    'Sắp các số đến một trăm theo thứ tự',
    ['cw-compare-100'],
  ),
  obj(
    'demo-b-n12',
    'D2.N.12',
    'Name one part out of four equal parts',
    'Gọi tên một phần trong bốn phần bằng nhau',
    ['cw-unit-fraction'],
  ),
]

// ── GDPT 2018 (MOET, Thông tư 32) — Toán Lớp 1 (Số & Phép tính). Chỉ phủ phần OVERLAP.
const MOET: CompiledObjective[] = [
  obj('moet-g1-1ss1', '1Ss1', 'Count, read and write numbers to 100', 'Đếm, đọc, viết số đến 100', [
    'cw-count-100',
  ]),
  obj('moet-g1-1ss2', '1Ss2', 'Recognise tens and ones', 'Nhận biết chục và đơn vị', ['cw-place-value-100']),
  obj('moet-g1-1ss3', '1Ss3', 'Compare and order numbers to 100', 'So sánh và sắp thứ tự số đến 100', [
    'cw-compare-100',
  ]),
  obj(
    'moet-g1-1st1',
    '1St1',
    'Understand the meaning of addition and subtraction',
    'Hiểu ý nghĩa phép cộng và phép trừ',
    ['cw-meaning-addsub'],
  ),
  obj(
    'moet-g1-1st2',
    '1St2',
    'Add and subtract within 100 without regrouping',
    'Cộng, trừ trong phạm vi 100 không nhớ',
    ['cw-addsub-100'],
  ),
  obj('moet-g1-1st4', '1St4', 'Add and subtract within 10 mentally', 'Cộng, trừ nhẩm trong phạm vi 10', [
    'cw-mental-10',
  ]),
]

// Câu mục tiêu VERBATIM từ Thông tư 32/2018/TT-BGDĐT (văn bản quy phạm pháp luật — Luật SHTT loại
// khỏi bảo hộ quyền tác giả, không phải giáo trình có bản quyền như §1 canh). Dùng để định vị đúng
// DÒNG trong PDF khi seed → "mở đúng trang, tô đúng dòng".
const QUOTE_BY_CODE: Record<string, string> = {
  '1Ss1': 'Count, read, and write numbers within 10; within 20; within 100.',
  '1Ss2': 'Recognise tens and ones, and round tens.',
  '1Ss3': 'Recognise how to compare and order numbers within 100 (in groups of no more than 4 numbers).',
  '1St1': 'Recognise the meaning of addition and subtraction.',
  '1St2': 'Perform addition and subtraction (without regrouping) of numbers within 100.',
  '1St4': 'Perform mental addition and subtraction within 10.',
}
const withQuote = (o: CompiledObjective): CompiledObjective => {
  const q = o.code ? QUOTE_BY_CODE[o.code] : undefined
  return q ? { ...o, evidence: [{ chunkId: 'circular32', quote: q }] } : o
}
const MOET_ANCHORED = MOET.map(withQuote)

// Đường dẫn PDF nguồn — TƯƠNG ĐỐI gốc repo (SOURCE_DOC_ROOT). Gitignore (*.pdf); có trên máy dev.
const PDF_KEY = 'Math_Circular32_P1_Grade1-5_EN.pdf'

async function main(): Promise<void> {
  // Mỗi khung KHAI cùng đồ thị KC nền (I1 khử trùng cùng-slug → idempotent) + objectives của khung.
  const other = await applyAuthoredFramework({
    graph: GRAPH,
    framework: {
      slug: 'demo-primary-math-stage-b',
      name: {
        en: 'Demo Primary Mathematics — Stage B (≈ Grade 1) · Number [sample data]',
        vi: 'Khung mẫu Toán Tiểu học — Bậc B (≈ Lớp 1) · Số [dữ liệu mẫu]',
      },
      kind: 'CURRICULUM',
      locale: 'en',
    },
    objectives: DEMO_FRAMEWORK_B,
  })
  console.log('Khung B (mẫu):', JSON.stringify(other.framework), '| KC seeded:', other.nodes)

  const moet = await applyAuthoredFramework({
    graph: GRAPH,
    framework: {
      slug: 'moet-primary-math-g1',
      name: {
        en: 'MOET Circular 32 Mathematics — Grade 1 (Numbers & Operations)',
        vi: 'GDPT 2018 Toán — Lớp 1 (Số và Phép tính)',
      },
      kind: 'CURRICULUM',
      locale: 'vi',
    },
    objectives: MOET_ANCHORED,
  })
  console.log('MOET Grade 1:', JSON.stringify(moet.framework))

  // NEO TÀI LIỆU — đọc Circular32 (trên máy dev), định vị từng câu trong PDF → ghi thẻ + toạ độ.
  // KHÔNG AI. Không có PDF (clone công khai) → bỏ qua, panel vẫn chạy với excerpt.
  const fvid = moet.framework?.frameworkVersionId
  if (fvid) {
    try {
      const bytes = new Uint8Array(readFileSync(resolveSourcePath(PDF_KEY)))
      const { units, pageCount } = await pdfPositionedUnits(bytes)
      const sourceText = units.map((u) => u.text).join(' ')
      const t = await writeObjectiveTraces(fvid, MOET_ANCHORED, sourceText, {
        units,
        contentHash: contentHashOf(bytes),
        pageCount,
        storageKey: PDF_KEY,
      })
      console.log(`Neo Circular32: ${t.records} thẻ, ${t.anchored} có toạ độ (mở đúng trang, tô đúng dòng).`)
    } catch (e) {
      console.log(`Bỏ qua neo tài liệu (không thấy ${PDF_KEY}): ${(e as Error).message}`)
    }
  }

  const otherKcs = new Set(DEMO_FRAMEWORK_B.flatMap((o) => o.mapsTo))
  const moetKcs = new Set(MOET.flatMap((o) => o.mapsTo))
  const overlap = [...otherKcs].filter((k) => moetKcs.has(k))
  const gap = [...otherKcs].filter((k) => !moetKcs.has(k))
  console.log(`\nCROSSWALK overlap (cả hai khung cùng MAPS_TO): ${overlap.length} KC → ${overlap.join(', ')}`)
  console.log(`GAP MOET→Khung B (KC chỉ Khung B phủ): ${gap.length} KC → ${gap.join(', ')}`)
}

await main()
