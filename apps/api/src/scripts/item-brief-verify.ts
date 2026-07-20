/**
 * VERIFY B2 — misconception → distractor nhắm đúng. Sinh 1 item `single` cho KC, TIÊM misconception
 * "quên nhớ khi cộng qua 10" → kỳ vọng LLM đặt một đáp án SAI = 13→3 (quên nhớ). In choices để soát.
 * Run: `node --env-file=.env --import tsx src/scripts/item-brief-verify.ts`
 */
import { db } from '@bingoo/db'
import type { Misconception } from '@bingoo/plans'
import { generateOneItem } from '../services/content-item-gen.service'

const MCS: Misconception[] = [
  {
    id: 'm-carry',
    type: 'procedural',
    wrong: {
      vi: 'Cộng qua 10 nhưng QUÊN NHỚ (chỉ lấy hàng đơn vị): 8+5 → viết 3',
      en: 'Adds past ten but forgets to carry: 8+5 → writes 3',
    },
    targetsKc: 'add-within-20',
    diagnostic: { vi: 'Học sinh trả lời 8+5=3 thay vì 13', en: 'Answers 8+5=3 instead of 13' },
  },
]

async function main() {
  console.log('Sinh item single cho add-within-20 với misconception "quên nhớ"…\n')
  const item = await generateOneItem({
    kc: 'add-within-20',
    primitiveKind: 'single',
    brief: 'Phép cộng 8 + 5 trong phạm vi 20, có nhớ.',
    languages: ['vi'],
    misconceptions: MCS,
    persist: false,
  })
  if (!item) {
    console.log('❌ LLM không ra item hợp lệ')
    await db.$disconnect()
    process.exit(1)
  }
  const p = item.payload as {
    prompt?: Record<string, string>
    choices?: { id: string; label?: Record<string, string> | string }[]
    answerId?: string
    support?: Record<string, Record<string, string>>
  }
  const loc = (l?: Record<string, string> | string) => (l && typeof l === 'object' ? (l.vi ?? l.en) : l) ?? ''
  console.log('LOẠI:', item.primitiveKind)
  console.log('ĐỀ:', loc(p.prompt))
  if (p.choices?.length) {
    console.log('ĐÁP ÁN ĐÚNG:', p.answerId)
    for (const c of p.choices) console.log(`  ${c.id === p.answerId ? '✓' : '·'} [${c.id}] ${loc(c.label)}`)
  }
  console.log('support.hint.vi:', loc(p.support?.hint))
  console.log('support.teach.vi:', loc(p.support?.teach)?.slice(0, 140))
  // Misconception "quên nhớ" ảnh hưởng → khái niệm NHỚ/carry/qua-10 xuất hiện ở đề/đáp án/hỗ trợ.
  const blob = [
    loc(p.prompt),
    ...(p.choices ?? []).map((c) => loc(c.label)),
    loc(p.support?.hint),
    loc(p.support?.guide),
    loc(p.support?.instruction),
    loc(p.support?.teach),
  ]
    .join(' ')
    .toLowerCase()
  const targetsMc = /nhớ|carry|qua 10|qua mười|13|=\s*3|→\s*3/.test(blob)
  console.log(
    `\n${targetsMc ? '✅' : '⚠️ '} misconception "quên nhớ" ${targetsMc ? 'CÓ ẢNH HƯỞNG (khái niệm nhớ/13 xuất hiện)' : 'không thấy tường minh (soát mắt)'}`,
  )
  await db.$disconnect()
  process.exit(0)
}

main().catch(async (e) => {
  console.error('crash:', e)
  await db.$disconnect()
  process.exit(1)
})
