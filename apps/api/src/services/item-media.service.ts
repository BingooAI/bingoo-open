/**
 * Ô MEDIA per-item — MỘT NGUỒN dẫn xuất mọi ô media (ảnh + audio) của một AuthoredItem, có NHÃN rõ để
 * người soạn biết sinh cho GÌ (ảnh-vật kit · minh hoạ câu hỏi · đáp án A/B/C · đọc đề). Route
 * `/content/item/media-targets` trả cái này; script/test verify cũng dùng CHUNG (không sao chép query →
 * không lệch giữa nơi hiển thị và nơi kiểm chứng).
 *
 * Nguyên tắc: nhãn slot + query PHẢI khớp CHÍNH cấu trúc payload mà kit/quiz render đọc — đặc biệt
 * ảnh-vật kit lưu URL vào `params.assets[shape]`, đúng khoá `shape` mà count.ts/tenframe… đọc lúc vẽ.
 */

import { kitHasObjectImage } from '@bingoo.ai/manipulatives'

export interface MediaSlot {
  path: string
  kind: 'image' | 'audio'
  slot: string
  label: { vi: string; en: string }
  /** Câu tìm/sinh mặc định cho slot (đề bài / nhãn đáp án / vật). */
  query: string
  /** true → lưu URL (kit render ảnh-vật cần URL); false → lưu assetId. */
  asUrl: boolean
  /** Giá trị đang gắn (assetId hoặc URL) — null nếu trống. */
  current: string | null
}

/**
 * MỌI ô media của một item, có NHÃN rõ để người soạn biết sinh cho GÌ:
 *  · kit render ảnh-vật → "Ảnh cho vật" (lưu URL); quiz/khác → "Ảnh minh hoạ"
 *  · "Đọc đề" (audio prompt)
 *  · mỗi đáp án quiz → "Ảnh đáp án A/B/C" + "Đọc đáp án A/B/C"
 */
export function itemMediaSlots(item: { primitiveKind: string; payload: unknown }): MediaSlot[] {
  const p = (item.payload ?? {}) as Record<string, unknown>
  const pr = p.prompt as Record<string, string> | string | undefined
  const promptQ = pr && typeof pr === 'object' ? (pr.vi ?? pr.en ?? '') : typeof pr === 'string' ? pr : ''
  const isKit = item.primitiveKind.startsWith('manip:')
  const kitKind = isKit ? item.primitiveKind.slice('manip:'.length) : ''
  const params = (p.params ?? {}) as Record<string, unknown>
  const assets = (params.assets ?? {}) as Record<string, string>
  const slots: MediaSlot[] = []

  if (isKit && kitHasObjectImage(kitKind)) {
    const shape = typeof params.shape === 'string' ? params.shape : 'apple'
    // Ảnh-vật phải là 1 VẬT ĐƠN LẺ (kit tự lặp N cái) — KHÔNG phải cả cảnh. Dùng objectLabel + ép nền/không số.
    const obj = (p.objectLabel ?? {}) as Record<string, string>
    const objName = obj.en || obj.vi || ''
    const objQuery = objName
      ? `A single ${objName}, one object only, centered, plain white background, simple flat illustration icon, no text, no numbers, no counting`
      : promptQ
    slots.push({
      path: `params.assets.${shape}`,
      kind: 'image',
      slot: 'kit-object',
      label: { vi: `Ảnh cho vật${objName ? ` (${obj.vi || objName})` : ''}`, en: 'Object image' },
      query: objQuery,
      asUrl: true,
      current: assets[shape] ?? null,
    })
  } else if (!isKit && promptQ) {
    slots.push({
      path: 'imageAssetId',
      kind: 'image',
      slot: 'illustration',
      label: { vi: 'Ảnh minh hoạ câu hỏi', en: 'Question illustration' },
      query: promptQ,
      asUrl: false,
      current: (p.imageAssetId as string) || null,
    })
  }
  if (promptQ)
    slots.push({
      path: 'promptAudioAssetId',
      kind: 'audio',
      slot: 'prompt-audio',
      label: { vi: 'Đọc đề', en: 'Read prompt' },
      query: promptQ,
      asUrl: false,
      current: (p.promptAudioAssetId as string) || null,
    })

  const choices = Array.isArray(p.choices) ? p.choices : []
  choices.forEach((ch, i) => {
    const co = (ch ?? {}) as Record<string, unknown>
    const letter = String.fromCharCode(65 + i)
    const q = typeof co.label === 'string' && co.label ? co.label : `${promptQ} ${letter}`
    const audio = (co.audio ?? {}) as Record<string, unknown>
    slots.push({
      path: `choices[${i}].imageAssetId`,
      kind: 'image',
      slot: 'choice-image',
      label: { vi: `Ảnh đáp án ${letter}`, en: `Answer ${letter} image` },
      query: q,
      asUrl: false,
      current: (co.imageAssetId as string) || null,
    })
    slots.push({
      path: `choices[${i}].audio.assetId`,
      kind: 'audio',
      slot: 'choice-audio',
      label: { vi: `Đọc đáp án ${letter}`, en: `Read answer ${letter}` },
      query: q,
      asUrl: false,
      current: (audio.assetId as string) || null,
    })
  })
  return slots
}
