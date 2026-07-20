// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Parse-only sanity check for NL search (no DB writes). Confirms the LLM turns a
 * Vietnamese sentence into a structured MediaSearchQuery with the right kind + a
 * cleaned topic. Run: `node --env-file=.env --import tsx src/scripts/media-nl-check.ts`
 */
import { parseNlQuery } from '../services/media-nl-query.service'

const CASES = [
  'tìm các ảnh liên quan đến chủ đề phòng cháy chữa cháy',
  'cho tôi video bài hát tiếng Anh cho trẻ mầm non',
  'tài liệu ôn tập toán lớp 5',
]

let fail = 0
for (const sentence of CASES) {
  const q = await parseNlQuery(sentence)
  console.log(`\n"${sentence}"\n→ ${JSON.stringify(q)}`)
  if (!q.text || !q.text.trim()) {
    console.log('  ❌ empty text')
    fail++
  }
}

// Focused assertion on the example from the conversation.
const fire = await parseNlQuery('tìm các ảnh liên quan đến chủ đề phòng cháy chữa cháy')
const okKind = fire.kind?.includes('IMAGE') ?? false
const okText = /cháy|phòng|chữa/i.test(fire.text ?? '') && !/tìm|các ảnh/i.test(fire.text ?? '')
console.log(
  `\nExample → kind has IMAGE: ${okKind ? '✅' : '❌'} | topic cleaned: ${okText ? '✅' : '❌'} (${JSON.stringify(fire)})`,
)
if (!okKind || !okText) fail++

console.log(`\n${fail === 0 ? '🎉 all good' : `⚠️ ${fail} issue(s)`}`)
process.exit(fail === 0 ? 0 : 1)
