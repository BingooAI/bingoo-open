/**
 * lib/json.ts — tolerant JSON extraction for LLM output.
 *
 * Models occasionally wrap JSON in ``` fences or emit a stray trailing comma.
 * `extractJson` slices the outermost {...}, strips fences, and repairs the most
 * common lint (trailing commas) before parsing — so one malformed character
 * doesn't sink a whole generation. Genuinely broken JSON (a missing comma
 * mid-array) still throws, which the caller turns into a repair round.
 */
export function looseParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    /* fall through to repair */
  }
  const repaired = text.replace(/,\s*([}\]])/g, '$1') // drop trailing commas
  return JSON.parse(repaired)
}

export function extractJson(text: string): unknown {
  let t = (text ?? '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) t = fence[1].trim()
  const s = t.indexOf('{')
  const e = t.lastIndexOf('}')
  if (s < 0 || e < 0) throw new Error('no JSON object in response')
  return looseParse(t.slice(s, e + 1))
}
