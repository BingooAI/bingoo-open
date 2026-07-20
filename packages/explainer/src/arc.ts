// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * arc.ts — the PEDAGOGICAL SHAPE of a lesson, and the gate that enforces it.
 *
 * The layout contract stops a scene from looking wrong. It says nothing about
 * whether the LESSON teaches, and a model left to itself writes a trailer: ten
 * scenes, each one idea, no time to look at anything, straight from "here is a
 * rule" to "you're done". Every scene passes. The lesson is still bad.
 *
 * So the arc is a contract too. It is not a style preference — it is two results
 * that bingoo's own `@bingoo.ai/plans` already encodes:
 *
 *   • CPA (concrete → pictorial → abstract). A child must HANDLE eight stars
 *     before they can accept "8 is even". A lesson that opens on the rule has
 *     skipped the only part that builds understanding; the rule is then a fact
 *     to memorise, not a thing that makes sense.
 *   • Gradual release (I do → we do → you do). Between watching a worked example
 *     and being tested alone there is a step — doing one WITH help — and it is
 *     the step generated lessons always drop.
 *
 * `checkDoc` measures a lesson against this. Every finding says what to add, so
 * a repair pass is mechanical: "you have 0 `guided` scenes, add a worked-example
 * between the rule and the first test" is actionable in a way that "make it more
 * pedagogical" never is.
 */
import { getManipulative } from '@bingoo.ai/manipulatives'
import type { ExplainerDoc, LocaleBundle, Scene } from './schema'
import type { Finding } from './authoring'

export type Phase =
  'explore' | 'orient' | 'teach' | 'formalize' | 'guided' | 'practice' | 'recap' | 'checkout'

export const PHASES: {
  id: Phase
  vi: string
  why: string
  /** how many scenes this phase needs at minimum */
  min: number
  /** whether the scenes here must be gates (learner DOES something) */
  gate?: boolean
  /** templates that fit this phase */
  templates: string[]
}[] = [
  {
    id: 'explore',
    vi: 'Khám phá',
    why: 'Đặt câu hỏi, khơi tò mò. CHƯA dạy gì cả — học sinh phải muốn biết trước đã.',
    min: 1,
    templates: ['title-card', 'section', 'compare'],
  },
  {
    id: 'orient',
    vi: 'Làm quen',
    why: "Cho học sinh NHÌN và ĐẾM vật thật (manipulative) trước khi nghe bất kỳ quy tắc nào. Đây là bước 'concrete' — bỏ nó là quy tắc trở thành thứ phải học thuộc.",
    min: 1,
    templates: ['teach', 'image-grid'],
  },
  {
    id: 'teach',
    vi: 'Dạy',
    why: 'Mỗi scene MỘT ý. Đi từ vật thật → hình vẽ. Ít nhất 3 scene: một ý mà chỉ nói một lần thì chưa ai học được.',
    min: 3,
    templates: ['teach', 'compare', 'sequence', 'flow', 'bullets-media'],
  },
  {
    id: 'formalize',
    vi: 'Chốt quy tắc',
    why: "Giờ mới trừu tượng hoá: gọi tên, viết quy tắc. Đến sau phần 'dạy', không bao giờ đến trước.",
    min: 1,
    templates: ['rule', 'definition', 'bullets'],
  },
  {
    id: 'guided',
    vi: 'Luyện có hướng dẫn',
    why: "'Cô làm cùng em': một bài mẫu giải từng bước. Đây là bước hay bị BỎ QUA nhất — nhảy thẳng từ xem sang tự làm là chỗ học sinh rơi.",
    min: 1,
    templates: ['worked-example', 'sequence'],
  },
  {
    id: 'practice',
    vi: 'Thực hành',
    why: "'Em tự làm.' Ít nhất 2 gate, khó dần. Đặt NGAY SAU phần chúng kiểm tra.",
    min: 2,
    gate: true,
    templates: ['practice'],
  },
  {
    id: 'recap',
    vi: 'Ôn tập',
    why: 'Nhắc lại từng thứ học sinh GIỜ LÀM ĐƯỢC — không phải liệt kê nội dung đã trình bày.',
    min: 1,
    templates: ['recap', 'bullets', 'stats'],
  },
  {
    id: 'checkout',
    vi: 'Kiểm tra cuối',
    why: 'Một câu hỏi cuối, kiểu khác với lúc luyện, để biết học sinh THẬT SỰ hiểu chứ không phải nhớ dạng bài.',
    min: 1,
    gate: true,
    templates: ['practice'],
  },
]

const ORDER = PHASES.map((p) => p.id)

/** An exposition scene with less narration than this flashes past unread. */
export const MIN_NARRATION_CHARS = 60

/* ══════════════════════════════ length ═══════════════════════════════════════
 * A lesson's size is a consequence of how long it should RUN, not a constant.
 * "12 scenes" is meaningless to a teacher; "8 minutes" is the thing they
 * actually have. So the plan is derived from the target duration, and the phase
 * minimums scale with it — a 20-minute lesson does not just have more scenes,
 * it has more TEACHING scenes and more practice, in the same proportion.
 */

/** Vietnamese narration, spoken: ~14 characters per second. */
export const CHARS_PER_SEC = 14
/** A gate holds the timeline while the child thinks and answers. */
export const GATE_SECONDS = 35
/** Dwell after the last narration line of a scene, before the next. */
export const SCENE_PAD_SECONDS = 2

export const DEFAULT_MINUTES = 8

/** Relative weight of each phase — the SHAPE stays the same at any length. */
const WEIGHT: Record<Phase, number> = {
  explore: 1,
  orient: 1,
  teach: 3,
  formalize: 1,
  guided: 1,
  practice: 2,
  recap: 1,
  checkout: 1,
}
const TOTAL_WEIGHT = Object.values(WEIGHT).reduce((a, b) => a + b, 0) // 11

/** Average seconds a scene runs (an exposition scene of 3–4 narration lines,
 *  blended with the gates). Derived from the reference lesson, not guessed. */
export const SEC_PER_SCENE = 32

/**
 * A lesson does not grow without bound in SCENE COUNT — past a point it grows in
 * DEPTH. Dividing 45 minutes by 32 seconds gives 84 scenes, which is arithmetically
 * true and pedagogically absurd: nobody authors 84 scenes, no model emits them in
 * one pass, and a 45-minute lesson is not a 6-minute lesson repeated seven times.
 * Beyond this cap the scenes simply run longer — more to look at, more to say,
 * more time on each idea.
 */
export const MAX_SCENES = 34
export const MIN_SCENES_FLOOR = 8

export type Plan = {
  minutes: number
  scenes: number
  /** minimum scenes per phase at this length */
  min: Record<Phase, number>
}

/** The plan for a target duration. This is what `MIN_SCENES` used to hardcode. */
export function planFor(minutes = DEFAULT_MINUTES): Plan {
  const m = Math.max(3, Math.min(45, minutes))
  const scenes = Math.max(MIN_SCENES_FLOOR, Math.min(MAX_SCENES, Math.round((m * 60) / SEC_PER_SCENE)))
  const min = {} as Record<Phase, number>
  for (const p of PHASES) {
    // never below the floor that makes the phase mean anything — a "teach"
    // phase with one scene has said a thing once, which is not teaching
    min[p.id] = Math.max(p.min, Math.round((scenes * WEIGHT[p.id]) / TOTAL_WEIGHT))
  }
  return { minutes: m, scenes, min }
}

/** Bridge the LessonBrief's requested `sceneCount` to the arc's duration model.
 *  The brief thinks in scenes; the arc (and the gate) think in minutes. Mapping
 *  through here means the outline target, the writer's `meta.targetMinutes`, and
 *  checkDoc's plan are all computed from ONE function — so a brief asking for 6
 *  short scenes is lifted to the arc floor (never below MIN_SCENES_FLOOR) instead
 *  of generating a lesson the gate then rejects. */
export function planForScenes(sceneCount: number): Plan {
  // lift to the arc floor FIRST, then derive minutes from the resulting scene
  // count — so targetMinutes and the scene count always describe the same
  // lesson (a floored 6→8 lesson claims ~8×scene-length, not the 6 asked for).
  let plan = planFor((Math.max(MIN_SCENES_FLOOR, sceneCount) * SEC_PER_SCENE) / 60)
  // The per-phase minimums can SUM above plan.scenes for short lessons (teach≥3,
  // practice≥2, six others≥1 = 11 > the 8-scene floor). checkDoc enforces each
  // phase min, so the real minimum is their sum — target at least that, or WRITE
  // can never satisfy the arc gate. Re-plan until the scene count covers it.
  const need = (p: Plan) => Object.values(p.min).reduce((a, b) => a + b, 0)
  for (let i = 0; i < 4 && plan.scenes < need(plan); i++) {
    plan = planFor(((need(plan) + 1) * SEC_PER_SCENE) / 60)
  }
  return plan
}

/** Estimated runtime from the text alone — before any TTS has been spoken. */
export function estimateSeconds(doc: ExplainerDoc, bundle: LocaleBundle): number {
  let sec = 0
  for (const s of doc.scenes) {
    if (s.kind === 'gate') {
      sec += GATE_SECONDS
      continue
    }
    const n = narrationOf(s, bundle)
    sec += n.length / CHARS_PER_SEC + SCENE_PAD_SECONDS
  }
  return Math.round(sec)
}

function narrationOf(scene: Scene, bundle: LocaleBundle): string {
  const refs = [scene.narrationRef, ...(scene.narrations ?? []).map((n) => n.ref)].filter(Boolean) as string[]
  return refs
    .map((r) => bundle.narration[r]?.script ?? '')
    .join(' ')
    .trim()
}

/**
 * Check a whole lesson against the arc. Scene-level checks (`checkScene`) say
 * whether each scene is well-FORMED; this says whether the lesson TEACHES.
 */
export function checkDoc(doc: ExplainerDoc, bundle: LocaleBundle): Finding[] {
  const out: Finding[] = []
  const plan = planFor(doc.meta.targetMinutes ?? DEFAULT_MINUTES)

  if (doc.scenes.length < plan.scenes) {
    out.push({
      level: 'error',
      code: 'too-short',
      message: `bài đặt mục tiêu ${plan.minutes} phút nhưng chỉ có ${doc.scenes.length} scene — cần ~${plan.scenes}. Với chừng này scene thì học sinh không kịp nhìn thứ gì.`,
      fix: `Viết ~${plan.scenes} scene, đi đủ 8 giai đoạn: ${PHASES.map((p) => p.vi).join(' → ')}`,
    })
  }

  // does the lesson actually RUN as long as it claims? Estimated from the
  // narration text — a model that writes twelve scenes of one sentence each has
  // hit the scene count and missed the point.
  const est = estimateSeconds(doc, bundle)
  const target = plan.minutes * 60
  if (est < target * 0.7) {
    out.push({
      level: 'error',
      code: 'runs-short',
      message: `bài chỉ chạy khoảng ${Math.round(est / 60)} phút, mục tiêu là ${plan.minutes} phút — lời giảng quá ngắn, bài sẽ vụt qua`,
      fix: `Viết lời giảng dài hơn: nói với học sinh, chỉ vào thứ đang hiện, hỏi han, chờ. Cần thêm ~${Math.round((target - est) * CHARS_PER_SEC)} ký tự lời giảng.`,
    })
  } else if (est > target * 1.4) {
    out.push({
      level: 'warn',
      code: 'runs-long',
      message: `bài chạy khoảng ${Math.round(est / 60)} phút, dài hơn mục tiêu ${plan.minutes} phút`,
      fix: `Cắt bớt lời giảng hoặc bỏ scene phụ.`,
    })
  }

  // every scene must declare its phase — otherwise nobody, including the model,
  // knows what job the scene is doing
  const missing = doc.scenes.filter((s) => !s.phase)
  if (missing.length) {
    out.push({
      level: 'error',
      code: 'no-phase',
      message: `${missing.length} scene không khai "phase" (${missing
        .slice(0, 4)
        .map((s) => s.id)
        .join(', ')}…) — không biết chúng đang làm việc gì trong bài`,
      fix: `Mỗi scene đặt phase: ${ORDER.join(' | ')}`,
    })
    return out // the rest of the arc checks need phases
  }

  // counts per phase — SCALED to the target duration
  for (const p of PHASES) {
    const inPhase = doc.scenes.filter((s) => s.phase === p.id)
    const need = plan.min[p.id]
    if (inPhase.length < need) {
      out.push({
        level: 'error',
        code: 'phase-thin',
        message: `giai đoạn "${p.vi}" (${p.id}) cần ≥${need} scene cho bài ${plan.minutes} phút, đang có ${inPhase.length}. ${p.why}`,
        fix: `Thêm ${need - inPhase.length} scene phase="${p.id}", dùng template: ${p.templates.join(' / ')}`,
      })
    }
    if (p.gate) {
      const notGate = inPhase.filter((s) => s.kind !== 'gate')
      for (const s of notGate) {
        out.push({
          level: 'error',
          code: 'phase-not-gate',
          message: `scene "${s.id}" ở giai đoạn "${p.vi}" nhưng kind="exposition" — giai đoạn này học sinh phải LÀM, không phải xem`,
          fix: `Đổi kind="gate" và thêm gate.activity`,
        })
      }
    }
  }

  // order: phases may repeat, but must never go backwards. A rule BEFORE the
  // teaching is the single most common way a generated lesson stops teaching.
  let high = -1
  for (const s of doc.scenes) {
    const i = ORDER.indexOf(s.phase as Phase)
    if (i < 0) continue
    if (i < high) {
      const back = PHASES[i]!
      out.push({
        level: 'error',
        code: 'phase-out-of-order',
        message: `scene "${s.id}" quay lại giai đoạn "${back.vi}" sau khi bài đã đi qua "${PHASES[high]!.vi}" — bài học đi lùi`,
        fix: `Xếp scene theo đúng thứ tự: ${PHASES.map((p) => p.id).join(' → ')}`,
      })
      break
    }
    high = Math.max(high, i)
  }

  // pace: an exposition scene with no narration is on screen for a heartbeat
  for (const s of doc.scenes) {
    if (s.kind !== 'exposition') continue
    const n = narrationOf(s, bundle)
    if (!n) {
      out.push({
        level: 'error',
        code: 'no-narration',
        message: `scene "${s.id}" không có lời giảng — nó sẽ vụt qua trước khi học sinh kịp nhìn`,
        fix: `Thêm narrationRef + narration script (≥${MIN_NARRATION_CHARS} ký tự), có [[cue:...]] để buộc hiệu ứng vào lời`,
      })
    } else if (n.length < MIN_NARRATION_CHARS) {
      out.push({
        level: 'warn',
        code: 'narration-thin',
        message: `scene "${s.id}" chỉ có ${n.length} ký tự lời giảng — quá nhanh`,
        fix: `Viết dài hơn: nói với học sinh, chỉ vào thứ đang hiện, hỏi han. ≥${MIN_NARRATION_CHARS} ký tự.`,
      })
    }
  }

  return out
}

/* ══════════════════════════════════ richness ═══════════════════════════════
 * The arc makes a lesson TEACH. This makes it use the engine it is written for.
 *
 * A model that has only ever seen slide decks writes a slide deck: the same kit
 * four times, standing still, one template, two identical multiple-choice
 * questions. Every scene passes every check, and the lesson is inert — because a
 * manipulative that never MOVES is just a picture, and the entire reason it
 * exists is that it can count, pair up, split and highlight ON A NARRATION CUE,
 * in front of the child, while the teacher is saying the words.
 *
 * These minimums are deliberately not style advice. Each one names a capability
 * the engine has and the lesson failed to use.
 */
export const RICHNESS = {
  /** distinct templates — one template repeated is a deck, not a lesson */
  templates: 6,
  /** distinct manipulative kinds — the same kit four times teaches one way of seeing */
  kits: 3,
  /** distinct question types across the gates — same question twice tests recall of the FORM */
  quizTypes: 2,
  /** beats per exposition scene — visuals must move WITH the voice, not sit still */
  beatsPerScene: 2,
} as const

function quizTypeOf(scene: Scene): string | null {
  const q = scene.gate?.activity?.quiz as { type?: string } | undefined
  return q?.type ?? null
}

export function checkRichness(doc: ExplainerDoc, bundle: LocaleBundle): Finding[] {
  const out: Finding[] = []
  const expo = doc.scenes.filter((s) => s.kind === 'exposition')

  const templates = new Set(doc.scenes.map((s) => s.layout.template))
  if (templates.size < RICHNESS.templates) {
    out.push({
      level: 'error',
      code: 'few-templates',
      message: `chỉ dùng ${templates.size} template (${[...templates].join(', ')}) — bài đang là một xấp slide giống nhau`,
      fix: `Dùng ≥${RICHNESS.templates} template khác nhau. Mỗi ý cần một CÁCH NHÌN khác: compare để lộ khác biệt, sequence cho các bước, flow cho rẽ nhánh, data cho số liệu, worked-example cho bài mẫu.`,
    })
  }

  // ── the big one: kits that never move ────────────────────────────────────
  // A manipulative with no `actions` is a static picture. Its verbs are what
  // make it a manipulative: they fire on a narration cue, so the child watches
  // the eight stars pair up WHILE the teacher says "two, four, six, eight".
  const kits = new Set<string>()
  for (const s of expo) {
    for (const el of s.elements) {
      if (el.type !== 'manipulative') continue
      const c = (el.content ?? {}) as { kind?: string; actions?: unknown[] }
      if (c.kind) kits.add(c.kind)
      const kit = c.kind ? getManipulative(c.kind) : undefined
      const verbs = kit ? Object.keys(kit.verbs) : []
      if (!c.actions?.length && verbs.length) {
        out.push({
          level: 'error',
          code: 'kit-static',
          elementId: el.id,
          message: `"${el.id}" (${c.kind}) đứng im — không có actions. Kit này BIẾT LÀM: ${verbs.join(', ')}. Để im thì nó chỉ là một tấm ảnh, và bài mất đúng thứ khiến explainer khác PowerPoint.`,
          fix: `Thêm actions, mỗi verb buộc vào một cue của lời giảng: "actions":[{"verb":"${verbs[0]}","at":"@c2","args":{…}}] — để học sinh THẤY nó xảy ra trong lúc cô đang nói.`,
        })
      }
    }
  }
  if (kits.size < RICHNESS.kits && kits.size > 0) {
    out.push({
      level: 'error',
      code: 'few-kits',
      message: `chỉ dùng ${kits.size} loại manipulative (${[...kits].join(', ')}) — cùng một cách nhìn lặp lại`,
      fix: `Dùng ≥${RICHNESS.kits} kit khác nhau, mỗi kit cho một cách biểu diễn khác (đếm · ghép đôi · chia nhóm · trục số · mười khung…).`,
    })
  }

  // VISUALS MUST TRACK THE VOICE.
  //
  // The failure this catches: the narration says several distinct things while a
  // single static picture just sits there — the voice is rich, the screen is not,
  // and the lesson feels empty. Each cue in the narration is a new idea; each idea
  // should bring something on screen (a callout revealed, a part highlighted, a
  // bullet, a manip verb). A scene whose voice covers K cues but whose visuals
  // move on almost none of them is a static scene, no matter how many elements it
  // has.
  for (const s of expo) {
    const script = narrationOf(s, bundle)
    const cues = new Set([...script.matchAll(/\[\[cue:([^\]]+)\]\]/g)].map((m) => m[1]))
    if (cues.size < 2) continue // a one-line scene needs no beat-tracking

    // every cue a visual event lands on: a beat's cue, or a manip action's @cue
    const hit = new Set<string>()
    for (const b of s.beats ?? []) if (cues.has(b.cue)) hit.add(b.cue)
    for (const el of s.elements) {
      if (el.type !== 'manipulative') continue
      for (const a of (el.content as { actions?: { at?: string }[] } | undefined)?.actions ?? []) {
        const c = a.at?.replace(/^@/, '')
        if (c && cues.has(c)) hit.add(c)
      }
    }
    // a slide `revealAll`/`revealItem` also counts as motion
    const hasBuild = (s.beats ?? []).some((b) =>
      b.actions.some((a) => a.verb === 'revealAll' || a.verb === 'revealItem'),
    )

    const need = Math.max(2, cues.size - 1) // allow one cue to be pure voice
    if (!hasBuild && hit.size < need) {
      out.push({
        level: 'error',
        code: 'static-scene',
        message: `scene "${s.id}": lời giảng có ${cues.size} ý (cue) nhưng hình chỉ động ${hit.size} lần — slide đứng im trong khi cô nói nhiều thứ`,
        fix:
          `Mỗi cue phải mang MỘT thứ lên màn hình: callout text hiện theo cue (reveal), một phần được nhấn (emphasize), ` +
          `một dòng bullet (revealAll trên list), hoặc một verb của kit (at:"@cN"). ` +
          `Nếu lời giảng nói nhiều ý mà template chỉ có 1 ảnh (title-card), hãy DÙNG bullets/teach có callout, hoặc TÁCH thành nhiều scene.`,
      })
    }
  }

  // gates: variety
  const qTypes = new Set(doc.scenes.map(quizTypeOf).filter(Boolean) as string[])
  if (qTypes.size && qTypes.size < RICHNESS.quizTypes) {
    out.push({
      level: 'error',
      code: 'few-quiz-types',
      message: `mọi câu hỏi đều là "${[...qTypes][0]}" — học sinh học thuộc DẠNG BÀI, không phải khái niệm`,
      fix: `Dùng ≥${RICHNESS.quizTypes} loại: single, boolean, order, match, categorize, numberline, tenframe… hoặc activity.manip để học sinh THAO TÁC thay vì chọn.`,
    })
  }

  // does the lesson ever show structure? (a diagram or a chart)
  const hasStructure = doc.scenes.some((s) =>
    s.elements.some((el) => el.type === 'diagram' || el.type === 'chart' || el.type === 'table'),
  )
  if (!hasStructure) {
    out.push({
      level: 'warn',
      code: 'no-structure',
      message: `bài không có sơ đồ / biểu đồ / bảng nào — engine tự vẽ được cả ba, và chúng là cách duy nhất cho học sinh thấy QUAN HỆ`,
      fix: `Thêm ít nhất một: flow (quy trình rẽ nhánh) hoặc table (so sánh nhiều chiều) hoặc chart (số liệu).`,
    })
  }

  // does the learner ever DO something with their hands?
  const hasManipGate = doc.scenes.some((s) => s.gate?.activity?.manip)
  if (!hasManipGate) {
    out.push({
      level: 'warn',
      code: 'no-manip-gate',
      message: `không gate nào cho học sinh THAO TÁC — mọi bài tập đều là chọn đáp án`,
      fix: `Ít nhất một gate dùng activity.manip: học sinh kéo/đếm/ghép trên chính kit vừa học.`,
    })
  }

  return out
}

/** Everything: the arc AND whether the lesson uses the engine it is written for. */
export function checkLesson(doc: ExplainerDoc, bundle: LocaleBundle): Finding[] {
  return [...checkDoc(doc, bundle), ...checkRichness(doc, bundle)]
}

/** The arc, rendered for the model. Generated — add a phase and it grows. */
export function arcGuide(minutes = DEFAULT_MINUTES): string {
  const plan = planFor(minutes)
  const lines: string[] = []
  const perScene = Math.round((plan.minutes * 60) / plan.scenes)
  lines.push(
    `Bài dài **${plan.minutes} phút** → cần **~${plan.scenes} scene**, trung bình **~${perScene}s mỗi scene**. Số scene suy ra từ thời lượng, không phải con số tuỳ ý.`,
  )
  if (plan.scenes >= MAX_SCENES) {
    lines.push(
      `Bài dài thì scene phải SÂU HƠN, không phải nhiều hơn: mỗi scene nói kỹ hơn, cho học sinh nhìn lâu hơn, kit làm nhiều động tác hơn — chứ đừng chẻ ra thành hàng chục scene vụn.`,
    )
  }
  lines.push(`Lời giảng tiếng Việt nói ~${CHARS_PER_SEC} ký tự/giây; mỗi gate chiếm ~${GATE_SECONDS}s.`)
  lines.push(`Cổng sẽ ƯỚC LƯỢNG thời lượng từ chính lời giảng bạn viết — viết đủ dài, đừng chỉ đủ số scene.`)
  lines.push('')
  lines.push('Bài phải có ĐỦ 8 giai đoạn, ĐÚNG thứ tự.')
  lines.push('Mỗi scene khai `phase`. Bài không nên đi lùi (chốt quy tắc trước khi dạy).')
  lines.push('')
  for (const p of PHASES) {
    lines.push(
      `**${p.id}** — ${p.vi} (≥${plan.min[p.id]} scene${p.gate ? ', PHẢI là gate' : ''}) · template: ${p.templates.join(' / ')}`,
    )
    lines.push(`  ${p.why}`)
  }
  lines.push('')
  lines.push(
    `Mỗi scene exposition PHẢI có lời giảng ≥${MIN_NARRATION_CHARS} ký tự. Không có lời giảng thì scene vụt qua trước khi học sinh kịp nhìn — đó là lý do bài "nhanh quá".`,
  )
  lines.push('')
  lines.push('## Khai thác đúng sức mạnh của engine')
  lines.push('')
  lines.push(
    '**Manipulative KHÔNG được đứng im.** Đây là lỗi nặng nhất. Một kit không có `actions` chỉ là một tấm ảnh — và bài học mất đúng thứ khiến explainer khác PowerPoint. Kit có verb để CHẠY THEO LỜI GIẢNG: học sinh nhìn 8 ngôi sao ghép đôi *trong lúc* cô đang đếm "hai, bốn, sáu, tám".',
  )
  lines.push('')
  lines.push('```json')
  lines.push('{ "id":"kit", "type":"manipulative", "region":"stage",')
  lines.push(
    '  "content": { "kind":"evenodd", "params": { "number":8, "labels":{"even":"{n} là số CHẴN","odd":"{n} là số LẺ"} },',
  )
  lines.push(
    '    "actions": [ {"verb":"setNumber","at":"@c1","args":{"n":8}}, {"verb":"showResult","at":"@c3"} ] } }',
  )
  lines.push('```')
  lines.push('')
  lines.push(`- ≥${RICHNESS.templates} template khác nhau (mỗi ý cần một CÁCH NHÌN khác).`)
  lines.push(
    `- ≥${RICHNESS.kits} loại manipulative khác nhau (cùng một kit lặp lại = một cách nhìn duy nhất).`,
  )
  lines.push(`- ≥${RICHNESS.quizTypes} loại câu hỏi (hỏi cùng một dạng = học sinh học thuộc DẠNG BÀI).`)
  lines.push(
    `- ≥${RICHNESS.beatsPerScene} beat mỗi scene exposition — mỗi câu lời giảng một cue, mỗi cue một hiệu ứng.`,
  )
  lines.push('- Ít nhất một `diagram`/`chart`/`table` — engine tự vẽ, và đó là cách duy nhất thấy QUAN HỆ.')
  lines.push('- Ít nhất một gate dùng `activity.manip` — để học sinh THAO TÁC, không chỉ chọn đáp án.')
  return lines.join('\n')
}
