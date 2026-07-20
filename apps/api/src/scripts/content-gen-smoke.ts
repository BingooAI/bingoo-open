// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SMOKE-TEST sinh content NGOÀI explainer (bank item: quiz auto-key + kit thao tác). Trả lời câu
 * "sinh content ổn chưa" bằng bằng chứng chạy LLM thật:
 *   Phần 1 — để LLM TỰ CHỌN dạng bài cho 1 KC (buildGeneratorPort không ép kinds) → xem chọn gì, có
 *            hợp schema QuizQuestion + chấm được (auto-key) không.
 *   Phần 2 — ép KIT (manip:tenframe) qua generateOneItem → kiểm đa-locale + thang hỗ trợ 4 level + chấm
 *            được (checkAnswer). In nội dung thật để soát mắt.
 * Không lưu DB (persist:false / trả về thẳng). Chi phí: ~2 call LLM.
 * Run: `node --env-file=.env --import tsx src/scripts/content-gen-smoke.ts`
 */
import { db } from '@bingoo.ai/db'
import { pickText } from '@bingoo.ai/core'
import { primitiveMeta, validateItem, type AuthoredItem } from '@bingoo.ai/authored-item'
import { buildGeneratorPort } from '../services/content-adapters'
import { generateOneItem } from '../services/content-item-gen.service'

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

/** Đa-locale khi text có ÍT NHẤT vi + en (en là gốc). */
function isMultiLocale(v: unknown): boolean {
  return Boolean(v && typeof v === 'object' && 'en' in (v as object) && 'vi' in (v as object))
}
/** Thang hỗ trợ 4 level đầy đủ + mỗi cấp đa-locale. */
function hasSupportLadder(payload: Record<string, unknown>): boolean {
  const s = payload.support as Record<string, unknown> | undefined
  if (!s) return false
  return (['hint', 'guide', 'instruction', 'teach'] as const).every((k) => isMultiLocale(s[k]))
}

function spec(kc: string) {
  return {
    targetKcs: [kc],
    variant: 'single' as const,
    difficultyBand: 'core' as const,
    bandRange: ['core' as const],
    scaffolding: { hintOpenLevel: 1, representationStage: 'pictorial' as const },
    reviewInserts: [],
    language: 'vi',
    pace: 'standard' as const,
  }
}

function reportItem(it: AuthoredItem) {
  const p = it.payload as Record<string, unknown>
  const meta = primitiveMeta(it.primitiveKind)
  const errs = validateItem(it).filter((i) => i.severity === 'error')
  check(
    `[${it.primitiveKind}] hợp lệ (validateItem 0 lỗi)`,
    errs.length === 0,
    errs.map((e) => e.message).join('; '),
  )
  check(
    `[${it.primitiveKind}] chấm được (registry measurable + graderKind)`,
    Boolean(meta?.measurable && meta.graderKind),
    `${meta?.graderKind ?? 'none'}`,
  )
  check(
    `[${it.primitiveKind}] đề đa-locale (vi+en)`,
    isMultiLocale(p.prompt),
    JSON.stringify(p.prompt).slice(0, 70),
  )
  // Render path: pickText rút đúng vi + en, cả hai non-empty & khác nhau (chứng minh QuizShell hiện đúng locale).
  if (isMultiLocale(p.prompt)) {
    const vi = pickText(p.prompt as Record<string, string>, 'vi')
    const en = pickText(p.prompt as Record<string, string>, 'en')
    check(
      `[${it.primitiveKind}] pickText(vi)≠pickText(en), cả hai có chữ`,
      Boolean(vi && en && vi !== en),
      `vi="${vi.slice(0, 30)}" en="${en.slice(0, 30)}"`,
    )
  }
  check(
    `[${it.primitiveKind}] thang hỗ trợ 4 level đa-locale`,
    hasSupportLadder(p),
    Object.keys((p.support ?? {}) as object).join(','),
  )
}

async function main() {
  const KC = 'add-within-20'

  // ── Phần 1: LLM TỰ CHỌN dạng bài (không ép kinds) ──────────────────────────────
  console.log('1) LLM tự chọn dạng bài cho KC =', KC, '…\n')
  const chosen = await buildGeneratorPort({
    count: 2,
    brief: 'Cộng trong phạm vi 20, có nhớ, ngữ cảnh đồ vật quen thuộc.',
  }).generate(spec(KC), KC as never)
  check('LLM sinh ≥1 item hợp lệ', chosen.length > 0, `got ${chosen.length}`)
  console.log('   → LLM chọn dạng:', chosen.map((i) => i.primitiveKind).join(', '), '\n')
  for (const it of chosen) {
    reportItem(it)
    const p = it.payload as Record<string, unknown>
    console.log(`      prompt.vi = ${JSON.stringify((p.prompt as Record<string, string>)?.vi ?? p.prompt)}`)
  }

  // ── Phần 2: ép KIT tenframe (thao tác, chấm bằng checkAnswer) ──────────────────
  console.log('\n2) Ép KIT manip:tenframe …\n')
  const kit = await generateOneItem({
    kc: KC,
    primitiveKind: 'manip:tenframe',
    brief: 'Đặt số chấm vào khung mười để thể hiện tổng của phép cộng trong 10.',
    languages: ['vi'],
    persist: false,
  })
  check('kit tenframe: LLM trả item hợp lệ', kit !== null)
  if (kit) {
    reportItem(kit)
    const p = kit.payload as Record<string, unknown>
    check(
      'kit có target (đáp án để chấm)',
      Boolean(p.target && typeof p.target === 'object'),
      JSON.stringify(p.target),
    )
    console.log('   payload.params =', JSON.stringify(p.params), '| target =', JSON.stringify(p.target))
    console.log(
      '   support.hint.vi =',
      JSON.stringify((p.support as Record<string, Record<string, string>>)?.hint?.vi),
    )
  }

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`)
  await db.$disconnect()
  process.exit(fail === 0 ? 0 : 1)
}

main().catch(async (err) => {
  console.error('content-gen smoke crashed:', err)
  await db.$disconnect()
  process.exit(1)
})
