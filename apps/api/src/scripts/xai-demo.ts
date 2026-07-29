// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * DEMO XAI THẬT — không phải provenance. Buộc LLM, KHI sinh khung, xuất kèm LÝ DO + TRÍCH NGUỒN cho
 * từng quyết định, cùng một lượt (lý do là mạch suy luận được cấu trúc hoá, không phải biện minh hậu kỳ):
 *   • vì sao đây là một objective (trích đúng câu nguồn nó đến từ đó)
 *   • vì sao objective này gắn những skill/knowledge này
 *   • vì sao cái này phải học trước cái kia
 *
 * Chạy: cd apps/api && set -a; . ./.env; set +a; pnpm exec tsx src/scripts/xai-demo.ts
 */

import { getAi } from '../providers'
import { modelFor } from '../config/models'

// NGUỒN (paraphrase, không trích nguyên văn Thông tư) — MOET Lớp 1, mạch Số & Phép tính.
const SOURCE = `CHƯƠNG TRÌNH TOÁN LỚP 1 — SỐ VÀ PHÉP TÍNH
- Đếm, đọc, viết các số trong phạm vi 10; 20; 100.
- Nhận biết chục và đơn vị; làm tròn chục.
- So sánh và sắp thứ tự các số trong phạm vi 100.
- Nhận biết ý nghĩa của phép cộng và phép trừ.
- Cộng và trừ (không nhớ) các số trong phạm vi 100.
- Cộng, trừ nhẩm trong phạm vi 10.`

const SYSTEM = `Bạn là chuyên gia phân tích chương trình. Từ NGUỒN người dùng đưa, trích các MỤC TIÊU học tập.
Với MỖI mục tiêu, BẮT BUỘC kèm lý do — đây là phần quan trọng nhất:
  - sourceQuote: câu/cụm CHÍNH XÁC trong nguồn mà mục tiêu này đến từ đó (bằng chứng, không bịa).
  - whyObjective: vì sao đây là một mục tiêu học tập riêng, đánh giá được (1 câu, tiếng Việt cho giáo viên).
  - knowledge: các kỹ năng/kiến thức nền mục tiêu này đòi hỏi; mỗi cái kèm "why" = vì sao mục tiêu này cần nó.
Sau đó liệt kê prerequisites giữa các mục tiêu: {before, after, why} — why = LÝ DO SƯ PHẠM vì sao phải học "before" trước "after".
CHỈ trả JSON đúng dạng, không văn bản thừa:
{"objectives":[{"code":"","statement":"","sourceQuote":"","whyObjective":"","knowledge":[{"skill":"","why":""}]}],"prerequisites":[{"before":"","after":"","why":""}]}
statement/why/skill viết tiếng Việt. Nếu nguồn có mã thì dùng, không thì tự đặt mã ngắn.`

function firstJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return {}
  try {
    return JSON.parse(m[0]) as Record<string, unknown>
  } catch {
    return {}
  }
}

async function main(): Promise<void> {
  console.log('Đang gọi LLM (sinh khung KÈM lý do + trích nguồn)…\n')
  const res = await getAi().generateText({
    system: SYSTEM,
    messages: [{ role: 'user', content: SOURCE }],
    model: modelFor('extraction'),
    maxTokens: 4000,
  })
  const parsed = firstJson(res.text)
  const objectives = Array.isArray(parsed.objectives) ? (parsed.objectives as Record<string, unknown>[]) : []
  const prereqs = Array.isArray(parsed.prerequisites)
    ? (parsed.prerequisites as Record<string, unknown>[])
    : []

  console.log('═══════════ VÌ SAO CÓ MỖI OBJECTIVE (+ skill/knowledge) ═══════════')
  for (const o of objectives) {
    console.log(`\n▎ ${o.code ?? ''}  ${o.statement ?? ''}`)
    console.log(`   ↳ trích nguồn : "${o.sourceQuote ?? ''}"`)
    console.log(`   ↳ vì sao là mục tiêu: ${o.whyObjective ?? ''}`)
    const ks = Array.isArray(o.knowledge) ? (o.knowledge as Record<string, unknown>[]) : []
    for (const k of ks) console.log(`   ↳ cần kỹ năng "${k.skill}"  ← vì: ${k.why}`)
  }

  console.log('\n═══════════ VÌ SAO CÁI NÀY HỌC TRƯỚC CÁI KIA ═══════════')
  for (const p of prereqs) {
    console.log(`\n▎ "${p.before}"  học trước  "${p.after}"`)
    console.log(`   ↳ vì: ${p.why}`)
  }
}

await main()
