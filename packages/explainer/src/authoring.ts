/**
 * authoring.ts — the contract a GENERATOR must satisfy, and the gate that
 * enforces it.
 *
 * Three layers, weakest to strongest. Only the third one actually protects you:
 *
 *   1. THE PROMPT (`authoringGuide`) — rendered FROM the catalog, so it can
 *      never describe a template that no longer exists or a slot that moved.
 *      It is generated, not written. Useful, but a model can still ignore it.
 *
 *   2. THE SHAPE — the model emits a SceneDraft, which has no `place`, no `x`,
 *      no `y`, no `size`. It cannot write a coordinate because the schema has
 *      nowhere to put one. This is the "make it unrepresentable" layer, and it
 *      kills the single biggest failure mode outright (an LLM placing elements
 *      at arbitrary positions), rather than asking nicely.
 *
 *   3. THE GATE (`checkScene`) — everything left over is MEASURED against the
 *      same layout engine the renderer uses: unknown slot, wrong element type
 *      for the slot, too many/few elements, text over the slot's real character
 *      budget, missing flow.order in an ordered slot. Every finding names the
 *      element and says what to do, so a repair pass is mechanical rather than
 *      "try again and hope".
 *
 * What this buys: a scene that PASSES cannot overflow, collide, drift off-frame,
 * or reference a slot that doesn't exist — at either aspect. Not "is unlikely
 * to". Cannot.
 */
import { z } from 'zod'
import { QuizQuestion, TracingGlyph, ColoringPicture } from '@bingoo/core'
import { getManipulative, KIT_DOCS } from '@bingoo/manipulatives'
import type { Aspect, Scene, ElementType } from './schema'
import { resolveLayout } from './layout'
import { templateCatalog, contractOf, type Template } from './catalog'
import { SFX_CATALOG } from './sfx-catalog'

/* ─────────────────────────────────────────────────────── 1. the guide (text) */

/**
 * The template reference handed to the model — GENERATED from the catalog, with
 * character budgets measured from the real layout. Add a template and this grows
 * by itself; move a slot and the budgets move with it.
 */
export function authoringGuide(): string {
  const lines: string[] = []
  lines.push('# BỐ CỤC — HỢP ĐỒNG BẮT BUỘC')
  lines.push('')
  lines.push('KHÔNG BAO GIỜ viết toạ độ (x, y, size, place). Bố cục do engine tính.')
  lines.push('Mỗi phần tử chỉ khai `region` = TÊN SLOT của template. Slot lạ = scene hỏng.')
  lines.push('`maxChars` là số ký tự ĐO ĐƯỢC mà slot chứa nổi ở CẢ 16:9 lẫn 9:16. Vượt = hỏng.')
  lines.push('')
  for (const t of templateCatalog()) {
    lines.push(`## ${t.template}`)
    lines.push(t.use)
    for (const s of t.slots) {
      const card = s.min === s.max ? `${s.min}` : `${s.min}–${s.max}`
      const accepts = s.accepts.length ? s.accepts.join('|') : 'bất kỳ'
      const budget = s.maxChars ? ` · ≤${s.maxChars} ký tự` : ''
      const rung = s.rung ? ` · rung=${s.rung}` : ''
      lines.push(`- \`${s.name}\` (${accepts} ×${card}${rung}${budget}) — ${s.role}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

/* ─────────────────────────────────────── 2. the shape (no coordinates exist) */

/**
 * What a generator is allowed to emit. Note what is ABSENT: place, x, y, size,
 * w, h, overrides. A model physically cannot hand us a coordinate.
 */
export const ElementDraft = z.object({
  id: z.string(),
  type: z.enum([
    'text',
    'image',
    'shape',
    'stick',
    'diagram',
    'manipulative',
    'list',
    'table',
    'chart',
    'stat',
    'quote',
  ]),
  /** the slot name — the ONLY placement channel */
  region: z.string(),
  /** position within a multi-element slot (steps, grid, stats) */
  order: z.number().int().optional(),
  /** type rung for text; the catalog says which rung the slot wants */
  rung: z.string().optional(),
  content: z.unknown().optional(),
})
export type ElementDraft = z.infer<typeof ElementDraft>

export const SceneDraft = z.object({
  id: z.string(),
  template: z.string(),
  elements: z.array(ElementDraft),
  /** narration script; `[[cue:x]]` marks bind visuals to the voice */
  narration: z.string().optional(),
})
export type SceneDraft = z.infer<typeof SceneDraft>

/* ────────────────────────────────────────────────── 3. the gate (measured) */

export type Finding = {
  level: 'error' | 'warn'
  code: string
  elementId?: string
  message: string
  /** what a repair pass should DO — mechanical, not "try again" */
  fix: string
}

/** A slot is ORDERED when it can hold more than one element — then, and only
 *  then, the reading order is ambiguous and flow.order must disambiguate it.
 *  (Keying this off slot NAMES was wrong: `worked-example.steps` holds a single
 *  list element, so demanding an order on it was a spurious error — and it was
 *  the gate, not the example, that was at fault.) */
const isOrdered = (slot: { max: number }) => slot.max > 1

/**
 * Check a compiled scene against the catalog AND the real layout, at BOTH
 * aspects. This is the gate: a scene that passes cannot be laid out badly,
 * because the same `resolveLayout` that draws it is what just checked it.
 */
export function checkScene(
  scene: Scene,
  strings: Record<string, string> = {},
  /** the lesson's language — kits ship English labels, so this decides whether
   *  a kit that renders text must be re-labelled. */
  locale = 'en',
): Finding[] {
  const out: Finding[] = []

  // ── images ─────────────────────────────────────────────────────────────────
  // An image with no `prompt` and no `tags` becomes an asset with no description,
  // no alt text and nothing to filter on — so the library can never find it again
  // and the NEXT lesson pays to generate the same picture. The information exists
  // at authoring time; losing it is a choice.
  for (const el of scene.elements) {
    if (el.type !== 'image') continue
    const c = (el.content ?? {}) as {
      src?: string
      query?: string
      prompt?: string
      tags?: string[]
      alt?: string
    }
    if (c.src) continue // already a real asset
    if (!c.query) {
      out.push({
        level: 'error',
        code: 'image-no-query',
        elementId: el.id,
        message: `"${el.id}": ảnh không có "query" — không tìm được trong thư viện`,
        fix: `Thêm query bằng TIẾNG ANH, mô tả thứ cần vẽ`,
      })
    }
    if (!c.prompt) {
      out.push({
        level: 'warn',
        code: 'image-no-prompt',
        elementId: el.id,
        message: `"${el.id}": không có "prompt" (EN) — nếu phải sinh mới, model vẽ sẽ nhận chuỗi tìm kiếm thay vì một câu lệnh vẽ`,
        fix: `Thêm prompt bằng TIẾNG ANH: mô tả tranh, phong cách, nền`,
      })
    }
    if (!c.tags?.length) {
      out.push({
        level: 'error',
        code: 'image-no-tags',
        elementId: el.id,
        message: `"${el.id}": không có "tags" — ảnh sinh ra sẽ KHÔNG LỌC ĐƯỢC, và bài sau lại phải sinh lại (tốn tiền)`,
        fix: `Thêm 2–5 tag TIẾNG ANH, ví dụ ["star","yellow","cartoon","kids"]`,
      })
    }
  }

  // ── kit params ─────────────────────────────────────────────────────────────
  // Kit params are `unknown` — each kit normalises its own shape — so a bad enum
  // value ("shape": "banana") does not error, it just draws the WRONG OBJECT, or
  // nothing, in silence. The legal values are in the kit's source; check against
  // them. This is derived from KIT_DOCS, so a new enum param is covered the day
  // it is added.
  for (const el of scene.elements) {
    const kinds = [
      el.type === 'manipulative'
        ? (el.content as { kind?: string; params?: Record<string, unknown> } | undefined)
        : undefined,
      scene.gate?.activity?.manip,
    ].filter(Boolean) as { kind?: string; params?: Record<string, unknown> }[]
    for (const c of kinds) {
      const enums = c.kind ? KIT_DOCS[c.kind]?.paramEnums : undefined
      if (!enums || !c.params) continue
      for (const [key, legal] of Object.entries(enums)) {
        const v = c.params[key]
        if (typeof v !== 'string' || legal.includes(v)) continue
        out.push({
          level: 'error',
          code: 'kit-param-value',
          elementId: el.id,
          message: `"${el.id}" (${c.kind}): params.${key} = "${v}" không hợp lệ — kit sẽ vẽ SAI VẬT mà không báo lỗi`,
          fix: `Chọn một trong: ${legal.join(' | ')}`,
        })
      }
    }
  }

  // ── kit labels ─────────────────────────────────────────────────────────────
  // Kits ship ENGLISH defaults ("{n} is ODD"). A Vietnamese lesson that omits
  // `labels` renders "7 is ODD" in the middle of Vietnamese narration. Telling
  // the model not to do this in prose was not enough — so it is an error, found
  // by comparing against the kit's OWN defaultParams rather than a hardcoded
  // list, which means a new kit with labels is covered the day it is added.
  if (!locale.startsWith('en')) {
    for (const el of scene.elements) {
      if (el.type !== 'manipulative') continue
      const c = (el.content ?? {}) as { kind?: string; params?: Record<string, unknown> }
      const kit = c.kind ? getManipulative(c.kind) : undefined
      const dflt = (kit?.defaultParams ?? {}) as Record<string, unknown>
      if (!('labels' in dflt)) continue
      if (c.params && 'labels' in c.params) continue
      out.push({
        level: 'error',
        code: 'kit-labels-english',
        elementId: el.id,
        message: `"${el.id}" (${c.kind}) dùng nhãn TIẾNG ANH mặc định — bài này là "${locale}", nên nó sẽ hiện ví dụ "${JSON.stringify(Object.values(dflt.labels as object)[0])}" giữa bài tiếng Việt`,
        fix: `Thêm labels vào params, theo shape: ${JSON.stringify(dflt.labels)} — dịch sang ngôn ngữ của bài, giữ nguyên {n}`,
      })
    }
  }
  const contract = contractOf(scene.layout.template as Template)
  if (!contract) {
    out.push({
      level: 'error',
      code: 'unknown-template',
      message: `template "${scene.layout.template}" không có trong catalog`,
      fix: `Chọn một template trong: ${templateCatalog()
        .map((t) => t.template)
        .join(', ')}`,
    })
    return out
  }

  const slots = new Map(contract.slots.map((s) => [s.name, s]))
  const bySlot = new Map<string, string[]>()

  for (const el of scene.elements) {
    if (el.type === 'audio') continue
    const region = el.region
    if (!region) {
      out.push({
        level: 'error',
        code: 'no-slot',
        elementId: el.id,
        message: `"${el.id}" không khai region`,
        fix: `Đặt region = một trong: ${[...slots.keys()].join(', ')}`,
      })
      continue
    }
    const slot = slots.get(region)
    if (!slot) {
      out.push({
        level: 'error',
        code: 'unknown-slot',
        elementId: el.id,
        message: `"${el.id}" trỏ vào slot "${region}" — template ${scene.layout.template} không có slot đó (phần tử sẽ rơi vào ô dự phòng)`,
        fix: `Đổi region sang: ${[...slots.keys()].join(', ')}`,
      })
      continue
    }
    if (slot.accepts.length && !slot.accepts.includes(el.type as ElementType)) {
      out.push({
        level: 'error',
        code: 'wrong-type',
        elementId: el.id,
        message: `slot "${region}" nhận ${slot.accepts.join('|')}, nhưng "${el.id}" là ${el.type}`,
        fix: `Đổi type sang ${slot.accepts[0]}, hoặc chuyển phần tử sang slot khác`,
      })
    }
    if (isOrdered(slot) && el.flow?.order === undefined) {
      out.push({
        level: 'error',
        code: 'missing-order',
        elementId: el.id,
        message: `slot "${region}" có thứ tự, nhưng "${el.id}" không có flow.order → các bước sẽ xếp sai`,
        fix: `Đặt flow.order = 1..n theo đúng thứ tự dạy`,
      })
    }
    bySlot.set(region, [...(bySlot.get(region) ?? []), el.id])
  }

  // sfx sound names must exist in the catalog — an invented name plays nothing
  for (const beat of scene.beats ?? []) {
    for (const a of beat.actions) {
      if (a.verb !== 'sfx') continue
      if (!SFX_CATALOG[a.sound]) {
        out.push({
          level: 'error',
          code: 'sfx-unknown',
          message: `beat "${beat.id}": sfx "${a.sound}" không có trong kho âm thanh`,
          fix: `Dùng một tên có thật, ví dụ: correct · celebrate · pop_in · star · whoosh_move · ding`,
        })
      }
    }
  }

  // cardinality
  for (const s of contract.slots) {
    const n = bySlot.get(s.name)?.length ?? 0
    if (n < s.min)
      out.push({
        level: 'error',
        code: 'slot-underfilled',
        message: `slot "${s.name}" cần ít nhất ${s.min} phần tử, đang có ${n} — ${s.role}`,
        fix: `Thêm ${s.min - n} phần tử type=${s.accepts[0] ?? 'bất kỳ'} vào region="${s.name}"`,
      })
    if (n > s.max)
      out.push({
        level: 'error',
        code: 'slot-overfilled',
        message: `slot "${s.name}" chứa tối đa ${s.max}, đang có ${n} — chúng sẽ bị chia nhỏ đến mức không đọc nổi`,
        fix: `Bỏ bớt ${n - s.max} phần tử, hoặc tách ra scene mới`,
      })
  }

  // character budgets — MEASURED, both aspects
  for (const el of scene.elements) {
    const slot = el.region ? slots.get(el.region) : undefined
    if (!slot?.maxChars) continue
    const text = strings[el.id] ?? (el.content as { text?: string } | undefined)?.text
    if (!text) continue
    if (text.length > slot.maxChars)
      out.push({
        level: 'error',
        code: 'over-budget',
        elementId: el.id,
        message: `"${el.id}" dài ${text.length} ký tự, slot "${el.region}" chỉ chứa ${slot.maxChars} (đo ở khổ hẹp hơn) — chữ sẽ bị co xuống dưới ngưỡng đọc được`,
        fix: `Viết lại ≤${slot.maxChars} ký tự. Cắt chữ thừa, đừng thu nhỏ chữ.`,
      })
  }

  // ── every gate KIND must be RENDERABLE by the player ───────────────────────
  // The player wires exactly one widget per kind (GateHost). If a gate's kind
  // doesn't carry what its widget reads, that widget draws a BLANK card at play —
  // silent, and only noticed by a learner. This mirrors each widget's real needs
  // so any un-renderable gate is rejected at authoring, never at play. (The
  // 'activity' payload gets a deeper, core-schema check right below.)
  if (scene.kind === 'gate' && scene.gate) {
    const g = scene.gate
    const opts = g.options ?? []
    const optIds = new Set(opts.map((o) => o.id))
    const ansIds = Array.isArray(g.answer) ? g.answer : g.answer ? [g.answer] : []
    const needsChoices = () => {
      if (opts.length < 2)
        out.push({
          level: 'error',
          code: 'gate-options',
          elementId: scene.id,
          message: `gate "${scene.id}" (${g.kind}): cần ≥2 options, đang có ${opts.length} → player vẽ thẻ TRỐNG`,
          fix: `Thêm options:[{id,label},…] (≥2), hoặc chuyển sang gate.kind:"activity" với activity.quiz.`,
        })
      const bad = ansIds.filter((a) => a && !optIds.has(a))
      if (opts.length >= 2 && (ansIds.length === 0 || bad.length))
        out.push({
          level: 'error',
          code: 'gate-answer',
          elementId: scene.id,
          message: `gate "${scene.id}" (${g.kind}): answer ${bad.length ? `trỏ tới id không có trong options (${bad.join(', ')})` : 'rỗng'}`,
          fix: `answer là id (hoặc mảng id, đúng thứ tự với "sequence") nằm trong options.`,
        })
    }
    switch (g.kind) {
      case 'select':
      case 'predict-check':
      case 'sequence':
        needsChoices()
        break
      case 'hotspot':
        if ((g.hotspots?.length ?? 0) < 1)
          out.push({
            level: 'error',
            code: 'gate-hotspots',
            elementId: scene.id,
            message: `gate "${scene.id}": hotspot gate không có "hotspots" → không có gì để bấm`,
            fix: `Thêm hotspots:[{id,x,y,r,…}] và answer trỏ tới id đúng.`,
          })
        break
      case 'manipulate':
        if (!g.manip)
          out.push({
            level: 'error',
            code: 'gate-manip-missing',
            elementId: scene.id,
            message: `gate "${scene.id}": manipulate gate thiếu "manip" → không có gì để thao tác`,
            fix: `Thêm manip:{kind,params,target}, hoặc dùng gate.kind:"activity" với activity.manip.`,
          })
        else if (!getManipulative(g.manip.kind))
          out.push({
            level: 'error',
            code: 'gate-manip-kind',
            elementId: scene.id,
            message: `gate "${scene.id}": manip kind "${g.manip.kind}" không tồn tại`,
            fix: `Dùng một kind có trong bộ manipulative.`,
          })
        break
      case 'input':
        // The player has NO input widget — 'input' falls through to SelectGate,
        // which needs options a typed question can't have, so it renders blank.
        // Core already covers typed answers via QuizShell, so steer there.
        out.push({
          level: 'error',
          code: 'gate-input-unsupported',
          elementId: scene.id,
          message: `gate "${scene.id}": kind "input" KHÔNG có widget trong player → thẻ trống, học sinh không gõ được đáp án`,
          fix: `Dùng gate.kind:"activity" với activity.quiz loại nhập của core: "numeric" để gõ số (vd {"type":"numeric","prompt":"…","answer":95,"unit":"%"}), hoặc "fill" để điền chỗ trống.`,
        })
        break
      case 'activity':
        // deep-validated below against core's real contract
        break
    }
  }

  // ── the GATE's payload ─────────────────────────────────────────────────────
  // `Activity.quiz` is `z.unknown()` in the doc schema (the engine deliberately
  // does not couple itself to core's 55-type union at parse time). That left a
  // HOLE: a model wrote `{type:"single-choice", options:[…]}` — core's type is
  // `single` with `choices` and an `answerId` — and it sailed through validation,
  // then QuizShell rendered an EMPTY CARD, because there was nothing it knew how
  // to draw. Silent, and shipped. So the gate validates it here, against core's
  // real contract, which is the same one QuizShell renders from.
  if (scene.kind === 'gate' && scene.gate?.kind === 'activity') {
    const act = scene.gate.activity
    if (!act?.quiz && !act?.manip && !act?.tracing && !act?.coloring) {
      out.push({
        level: 'error',
        code: 'activity-empty',
        message: `gate "${scene.id}": activity rỗng → thẻ trống`,
        fix: `Thêm MỘT trong: activity.quiz | activity.manip | activity.tracing | activity.coloring`,
      })
    }
    for (const [key, schema] of [
      ['tracing', TracingGlyph],
      ['coloring', ColoringPicture],
    ] as const) {
      const payload = act?.[key]
      if (!payload) continue
      const r = schema.safeParse(payload)
      if (!r.success) {
        out.push({
          level: 'error',
          code: `activity-${key}`,
          message: `gate "${scene.id}": ${key} không đúng contract của @bingoo/core. ${r.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join(' · ')}`,
          fix:
            key === 'tracing'
              ? `TracingGlyph: {"id","label":"A","strokes":[{"id","points":[{"x","y"},…]}]}`
              : `ColoringPicture: {"id","regions":[{"id","d":"<svg path>","targetColor":"#e07a42"}]}`,
        })
      }
    }
    if (act?.quiz) {
      const r = QuizQuestion.safeParse(act.quiz)
      if (!r.success) {
        const detail = r.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join(' · ')
        out.push({
          level: 'error',
          code: 'activity-quiz',
          message: `gate "${scene.id}": câu hỏi không đúng contract của @bingoo/core → QuizShell vẽ THẺ RỖNG. ${detail}`,
          fix:
            `Dùng đúng shape, ví dụ: {"id":"q1","type":"single","prompt":"Số 5 là chẵn hay lẻ?",` +
            `"choices":[{"id":"even","label":"Chẵn"},{"id":"odd","label":"Lẻ"}],"answerId":"odd"}. ` +
            `Đáp án nằm TRONG câu hỏi (answerId), không phải ở gate.answer.`,
        })
      }
    }
    if (act?.manip && !getManipulative(act.manip.kind)) {
      out.push({
        level: 'error',
        code: 'activity-manip-kind',
        message: `gate "${scene.id}": manip kind "${act.manip.kind}" không tồn tại`,
        fix: `Dùng một kind trong bộ manipulative`,
      })
    }
  }

  // the layout itself, at both aspects — the same function the renderer uses
  for (const aspect of ['16:9', '9:16'] as Aspect[]) {
    const { overflow } = resolveLayout(scene, aspect)
    for (const id of overflow)
      out.push({
        level: 'error',
        code: 'overflow',
        elementId: id,
        message: `"${id}" tràn khỏi khung ở ${aspect}`,
        fix: `Bỏ toạ độ tự do (place) và dùng region`,
      })
  }

  return out
}

/** Convenience: is this scene safe to render? */
export function sceneIsValid(scene: Scene, strings?: Record<string, string>): boolean {
  return checkScene(scene, strings).every((f) => f.level !== 'error')
}
