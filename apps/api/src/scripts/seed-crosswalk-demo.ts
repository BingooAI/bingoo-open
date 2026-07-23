// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SEED DEMO CROSSWALK — Cambridge Primary Maths Stage 2 ↔ GDPT 2018 (MOET) Toán Lớp 1.
 *
 * Dựng một lát cắt "Số & Phép tính" của HAI khung để minh hoạ ba thứ người dùng hỏi:
 *   1) TÍNH CHẶT CHẼ / LIÊN KẾT — các KC nền nối nhau bằng cạnh TIÊN QUYẾT (đếm → so sánh → cộng trừ;
 *      đếm bước → nhân → chia/bảng cửu chương). Đồ thị không còn là bãi node rời.
 *   2) CROSSWALK — hai khung KHÔNG nối objective↔objective (repo cấm: authoring.repo.ts:387).
 *      "Trùng" thể hiện bằng việc objective của cả hai khung cùng MAPS_TO MỘT KC nền chung.
 *   3) GAP khi chuyển khung — KC mà Cambridge Stage 2 phủ nhưng MOET Lớp 1 KHÔNG: chẵn/lẻ, nhân,
 *      chia, bảng cửu chương, phân số, đếm bước. Học xong MOET Lớp 1 sang Cambridge là thiếu đúng
 *      những KC đó (đọc qua FrameworkReport — báo cáo tính theo KC nền, không cần dịch hồ sơ).
 *
 * BẢN QUYỀN: phát biểu ở đây là DIỄN GIẢI LẠI bằng lời của mình + mã/cấu trúc (dữ kiện). KHÔNG trích
 * nguyên văn từ PDF Cambridge (có bản quyền) hay Thông tư 32. Titles ĐỦ song ngữ {vi,en} (R4).
 *
 * Đi qua CỔNG BẤT BIẾN (applyAuthoredFramework → checkInvariants I1–I8): mỗi KC math khai đủ trục
 * bắt buộc object+channel, và (object,scope) khác nhau nên không trùng định danh 15 KC Stage 1 sẵn có.
 * Idempotent theo slug (I1 khử trùng cùng-slug) — mỗi khung khai cùng đồ thị KC nền; chạy lại an toàn.
 *
 * Chạy:  cd apps/api && set -a; . ./.env; set +a; pnpm exec tsx src/scripts/seed-crosswalk-demo.ts
 */

import type { GraphData, SkillEdge, SkillNode } from '@bingoo.ai/knowledge-engine'
import type { CompiledObjective } from '@bingoo.ai/authoring'
import { applyAuthoredFramework } from '../services/authoring.service'

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
  // ── Chỉ Cambridge Stage 2 phủ (MOET Lớp 1 chưa) — đây là GAP khi chuyển MOET → Cambridge:
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

// ── Cambridge Primary Maths — Stage 2 (Number). Objective → KC nền (paraphrase).
const CAMBRIDGE: CompiledObjective[] = [
  obj('cam-s2-2nc01', '2Nc.01', 'Count objects to 100', 'Đếm vật đến 100', ['cw-count-100']),
  obj('cam-s2-2nc04', '2Nc.04', 'Count in ones, twos, fives or tens to 100', 'Đếm theo 1, 2, 5, 10 đến 100', [
    'cw-skip-count-100',
  ]),
  obj('cam-s2-2nc05', '2Nc.05', 'Recognise even and odd numbers to 100', 'Nhận biết số chẵn, số lẻ đến 100', [
    'cw-even-odd-100',
  ]),
  obj('cam-s2-2ni01', '2Ni.01', 'Read and write numbers to 100', 'Đọc và viết số đến 100', ['cw-count-100']),
  obj('cam-s2-2ni02', '2Ni.02', 'Link addition and subtraction', 'Liên hệ phép cộng và phép trừ', [
    'cw-meaning-addsub',
  ]),
  obj(
    'cam-s2-2ni04',
    '2Ni.04',
    'Add and subtract two-digit numbers without regrouping',
    'Cộng, trừ số hai chữ số không nhớ',
    ['cw-addsub-100'],
  ),
  obj('cam-s2-2ni05', '2Ni.05', 'Understand multiplication', 'Hiểu phép nhân', ['cw-multiply']),
  obj('cam-s2-2ni06', '2Ni.06', 'Understand division', 'Hiểu phép chia', ['cw-divide']),
  obj('cam-s2-2ni07', '2Ni.07', 'Know the 2, 5 and 10 times tables', 'Thuộc bảng nhân 2, 5, 10', [
    'cw-times-tables',
  ]),
  obj('cam-s2-2np01', '2Np.01', 'Understand place value to 100', 'Hiểu giá trị vị trí đến 100', [
    'cw-place-value-100',
  ]),
  obj('cam-s2-2np02', '2Np.02', 'Compare and order numbers to 100', 'So sánh và sắp thứ tự số đến 100', [
    'cw-compare-100',
  ]),
  obj('cam-s2-2nf02', '2Nf.02', 'Understand a quarter', 'Hiểu một phần tư', ['cw-unit-fraction']),
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

async function main(): Promise<void> {
  // Mỗi khung KHAI cùng đồ thị KC nền (I1 khử trùng cùng-slug → idempotent) + objectives của khung.
  const cam = await applyAuthoredFramework({
    graph: GRAPH,
    framework: {
      slug: 'cambridge-primary-math-s2',
      name: {
        en: 'Cambridge Primary Mathematics — Stage 2 (Number)',
        vi: 'Cambridge Toán Tiểu học — Stage 2 (Số)',
      },
      kind: 'CURRICULUM',
      locale: 'en',
    },
    objectives: CAMBRIDGE,
  })
  console.log('Cambridge Stage 2:', JSON.stringify(cam.framework), '| KC seeded:', cam.nodes)

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
    objectives: MOET,
  })
  console.log('MOET Grade 1:', JSON.stringify(moet.framework))

  const camKcs = new Set(CAMBRIDGE.flatMap((o) => o.mapsTo))
  const moetKcs = new Set(MOET.flatMap((o) => o.mapsTo))
  const overlap = [...camKcs].filter((k) => moetKcs.has(k))
  const gap = [...camKcs].filter((k) => !moetKcs.has(k))
  console.log(`\nCROSSWALK overlap (cả hai khung cùng MAPS_TO): ${overlap.length} KC → ${overlap.join(', ')}`)
  console.log(`GAP MOET→Cambridge (KC chỉ Cambridge phủ): ${gap.length} KC → ${gap.join(', ')}`)
}

await main()
