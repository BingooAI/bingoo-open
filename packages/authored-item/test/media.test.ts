/**
 * HỢP ĐỒNG MEDIA — trích ĐÚNG ô chưa resolve theo cấu trúc + policy, có dedupKey để tái dùng.
 * Không sinh gì (thuần). Canh: không ép media thừa, đọc-to/đáp-án-tranh theo policy, dedup ổn định.
 */

import { describe, expect, it } from 'vitest'
import { mediaDedupKey, mediaTargets } from '../src/media'
import type { AuthoredItem } from '../src/model'

const item = (payload: unknown, primitiveKind = 'single'): AuthoredItem => ({
  itemKey: 'k',
  skills: ['kc'],
  difficulty: 1500,
  primitiveKind,
  payload,
})

describe('content block media', () => {
  it('block image có alt mà chưa có assetId/src → 1 target ảnh (query = alt)', () => {
    const t = mediaTargets(item({ type: 'image', alt: 'một quả táo đỏ' }, 'block:image'))
    expect(t).toHaveLength(1)
    expect(t[0]).toMatchObject({ kind: 'image', path: 'assetId', query: 'một quả táo đỏ' })
  })

  it('block image ĐÃ có assetId → không target (không sinh thừa)', () => {
    expect(mediaTargets(item({ type: 'image', alt: 'x', assetId: 'a1' }, 'block:image'))).toHaveLength(0)
  })

  it('block image có src ngoài → coi như đã resolve', () => {
    expect(
      mediaTargets(item({ type: 'image', alt: 'x', src: 'https://e/x.png' }, 'block:image')),
    ).toHaveLength(0)
  })
})

describe('quiz — policy đọc-to / đáp-án-tranh', () => {
  const q = {
    type: 'single',
    prompt: 'Số nào chẵn?',
    choices: [
      { id: 'a', label: 'hai' },
      { id: 'b', label: 'ba', emoji: '3️⃣' }, // đã có tranh (emoji)
      { id: 'c', image: 'https://e/4.png' }, // đã có ảnh, không label
    ],
  }

  it('policy rỗng → không target (không tự ép media)', () => {
    expect(mediaTargets(item(q))).toHaveLength(0)
  })

  it('readAloud → audio cho prompt + audio cho đáp án CÓ CHỮ (không cho đáp án chỉ ảnh)', () => {
    const t = mediaTargets(item(q), { readAloud: true })
    const audios = t.filter((x) => x.kind === 'audio')
    // prompt + "hai" + "ba" = 3 (đáp án c không có label → không đọc)
    expect(audios).toHaveLength(3)
    expect(t.find((x) => x.path === 'media.assetId')?.query).toBe('Số nào chẵn?')
    expect(t.some((x) => x.path === 'choices[0].audio.assetId' && x.query === 'hai')).toBe(true)
  })

  it('pictureChoices → ảnh CHỈ cho đáp án chỉ-có-chữ (bỏ đáp án đã có emoji/ảnh)', () => {
    const t = mediaTargets(item(q), { pictureChoices: true })
    const imgs = t.filter((x) => x.kind === 'image')
    // chỉ "hai" (a) cần ảnh; b có emoji, c có image → bỏ
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toMatchObject({ path: 'choices[0].imageAssetId', query: 'hai' })
  })

  it('đáp án đã có audio → không thêm đọc-to', () => {
    const t = mediaTargets(
      item({ type: 'single', choices: [{ id: 'a', label: 'x', audio: { assetId: 'au1' } }] }),
      { readAloud: true },
    )
    expect(t.filter((x) => x.path.startsWith('choices'))).toHaveLength(0)
  })
})

describe('dedupKey — tái dùng ổn định', () => {
  it('cùng mô tả (khác hoa/thường/khoảng trắng) → cùng khoá', () => {
    expect(mediaDedupKey('image', '  Quả  TÁO đỏ ')).toBe(mediaDedupKey('image', 'quả táo đỏ'))
  })
  it('khác kind → khác khoá', () => {
    expect(mediaDedupKey('image', 'táo')).not.toBe(mediaDedupKey('audio', 'táo'))
  })
})

// ── áp asset + điều phối resolve (dedup) ─────────────────────────────────────
import { applyMediaAsset, resolveMediaTargets } from '../src/media'

describe('applyMediaAsset — set immutable, tạo node trung gian', () => {
  it('set đường lồng (choices[0].audio.assetId), tạo audio nếu thiếu', () => {
    const p = { choices: [{ id: 'a', label: 'x' }] }
    const out = applyMediaAsset(p, 'choices[0].audio.assetId', 'au1') as typeof p & {
      choices: { audio?: { assetId: string } }[]
    }
    expect(out.choices[0]?.audio?.assetId).toBe('au1')
    expect((p.choices[0] as { audio?: unknown }).audio).toBeUndefined() // gốc không đổi
  })
  it('set trường phẳng (assetId)', () => {
    expect(applyMediaAsset({ type: 'image' }, 'assetId', 'a1')).toMatchObject({ assetId: 'a1' })
  })
})

describe('resolveMediaTargets — dedup: mỗi mô tả chỉ resolve MỘT LẦN', () => {
  const q = {
    type: 'single',
    choices: [
      { id: 'a', label: 'táo' },
      { id: 'b', label: 'táo' }, // trùng mô tả → tái dùng
      { id: 'c', label: 'lê' },
    ],
  }

  it('gọi resolve đúng số mô tả KHÁC NHAU, điền hết ô', async () => {
    const calls: string[] = []
    let n = 0
    const r = await resolveMediaTargets(item(q), { pictureChoices: true }, (t) => {
      calls.push(t.query)
      return Promise.resolve(`asset-${++n}`)
    })
    // 3 ô nhưng "táo" trùng → chỉ 2 lần gọi I/O
    expect(calls.sort()).toEqual(['lê', 'táo'])
    expect(r.filled).toBe(3)
    const c = (r.payload as typeof q).choices as { imageAssetId?: string }[]
    expect(c[0]?.imageAssetId).toBe(c[1]?.imageAssetId) // cùng "táo" → cùng asset
    expect(c[0]?.imageAssetId).not.toBe(c[2]?.imageAssetId)
  })

  it('resolve trả null → ô vào unresolved, không nổ', async () => {
    const r = await resolveMediaTargets(item(q), { pictureChoices: true }, () => Promise.resolve(null))
    expect(r.filled).toBe(0)
    expect(r.unresolved.length).toBe(3)
  })
})
