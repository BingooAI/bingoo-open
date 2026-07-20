// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * effects.ts — friendly animation presets (the studio layer over engine verbs).
 *
 * Creators pick a named effect ("Hiện dần", "Trượt từ trái", "Nhấn mạnh"…);
 * this module translates it to a `VisualAction` and — crucially — auto-manages
 * the beat + cue + per-locale mark behind the scenes, so nobody ever types a
 * cue string or picks a verb. Adding an effect "at the playhead" just works.
 */
import type {
  ExplainerDoc,
  LocaleBundle,
  Scene,
  VisualAction,
  ManipulativeContent,
} from '@bingoo.ai/explainer'
import type { EditOp } from './store/ops'

export type EffectGroup = 'in' | 'emph' | 'out'
export type Effect = {
  id: string
  label: string
  icon: string
  group: EffectGroup
  make: (target: string) => VisualAction
  forStick?: boolean
}

export const EFFECT_GROUPS: { id: EffectGroup; label: string }[] = [
  { id: 'in', label: 'Xuất hiện' },
  { id: 'emph', label: 'Nhấn mạnh' },
  { id: 'out', label: 'Biến mất' },
]

export const EFFECTS: Effect[] = [
  {
    id: 'fade',
    label: 'Hiện dần',
    icon: '◐',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t }),
  },
  {
    id: 'pop',
    label: 'Bật lên',
    icon: '◎',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t, from: 'down' }),
  },
  {
    id: 'slideL',
    label: 'Trượt từ trái',
    icon: '→',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t, from: 'left' }),
  },
  {
    id: 'slideR',
    label: 'Trượt từ phải',
    icon: '←',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t, from: 'right' }),
  },
  {
    id: 'slideU',
    label: 'Rơi xuống',
    icon: '↓',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t, from: 'up' }),
  },
  {
    id: 'slideD',
    label: 'Bay lên',
    icon: '↑',
    group: 'in',
    make: (t) => ({ verb: 'reveal', target: t, from: 'down' }),
  },
  {
    id: 'draw',
    label: 'Tự vẽ nét',
    icon: '✎',
    group: 'in',
    make: (t) => ({ verb: 'drawOn', target: t }),
  },
  {
    id: 'pulse',
    label: 'Nhấn (nảy)',
    icon: '❍',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'pulse' }),
  },
  {
    id: 'scaleUp',
    label: 'Phóng to',
    icon: '⤢',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'scaleUp' }),
  },
  {
    id: 'shake',
    label: 'Rung lắc',
    icon: '↔',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'shake' }),
  },
  {
    id: 'spin',
    label: 'Xoay vòng',
    icon: '↻',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'spin' }),
  },
  {
    id: 'flash',
    label: 'Nhấp nháy',
    icon: '✦',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'flash' }),
  },
  {
    id: 'tada',
    label: 'Ta-da!',
    icon: '✰',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'tada' }),
  },
  {
    id: 'wobble',
    label: 'Lắc lư',
    icon: '≈',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'wobble' }),
  },
  {
    id: 'jello',
    label: 'Rung thạch',
    icon: '◇',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'jello' }),
  },
  {
    id: 'glow',
    label: 'Toả sáng',
    icon: '✷',
    group: 'emph',
    make: (t) => ({ verb: 'emphasize', target: t, style: 'glow' }),
  },
  {
    id: 'point',
    label: 'Chỉ tay',
    icon: '☞',
    group: 'emph',
    forStick: true,
    make: (t) => ({ verb: 'point', target: t }),
  },
  {
    id: 'buildIn',
    label: 'Hiện từng dòng',
    icon: '☰',
    group: 'in',
    make: (t) => ({ verb: 'revealAll', target: t }),
  },
  {
    id: 'fadeOut',
    label: 'Mờ dần',
    icon: '◑',
    group: 'out',
    make: (t) => ({ verb: 'exit', target: t, to: 'fade' }),
  },
  {
    id: 'exitL',
    label: 'Ra bên trái',
    icon: '⇤',
    group: 'out',
    make: (t) => ({ verb: 'exit', target: t, to: 'left' }),
  },
  {
    id: 'exitR',
    label: 'Ra bên phải',
    icon: '⇥',
    group: 'out',
    make: (t) => ({ verb: 'exit', target: t, to: 'right' }),
  },
]

/** Human label for an existing action (for chips / effect lists). */
export function effectLabel(a: VisualAction): string {
  switch (a.verb) {
    case 'reveal':
      return a.from
        ? { left: 'Trượt từ trái', right: 'Trượt từ phải', up: 'Rơi xuống', down: 'Bật lên' }[a.from]
        : 'Hiện dần'
    case 'drawOn':
      return 'Tự vẽ nét'
    case 'emphasize':
      return (
        (
          {
            pulse: 'Nhấn (nảy)',
            glow: 'Toả sáng',
            scaleUp: 'Phóng to',
            shake: 'Rung lắc',
            spin: 'Xoay vòng',
            flash: 'Nhấp nháy',
            tada: 'Ta-da!',
            wobble: 'Lắc lư',
            jello: 'Rung thạch',
            bounce: 'Nảy',
          } as Record<string, string>
        )[a.style] ?? 'Nhấn mạnh'
      )
    case 'move':
      return `Đổi dáng → ${a.toPose}`
    case 'exit':
      return a.to && a.to !== 'fade' ? `Ra ${a.to}` : 'Mờ dần'
    case 'point':
      return 'Chỉ tay'
    case 'sfx':
      return `Âm thanh: ${a.sound}`
    case 'revealNode':
      return `Hiện node ${a.node}`
    case 'connect':
      return `Nối ${a.edge}`
    case 'highlightPath':
      return 'Tô sáng tuyến'
    case 'walk':
      return `Lia tới ${a.to}`
    // slide "build" — bring a list/table/chart in a row at a time
    case 'revealItem':
      return `Hiện dòng ${a.index + 1}`
    case 'revealAll':
      return 'Hiện lần lượt từng dòng'
  }
}

export function actionTarget(a: VisualAction): string | null {
  if ('target' in a) return a.target
  if ('diagram' in a) return a.diagram
  return null
}

let fxCounter = 0
function newCue(scene: Scene): string {
  fxCounter++
  const existing = new Set((scene.beats ?? []).map((b) => b.cue))
  let c = `fx_${(scene.beats?.length ?? 0) + fxCounter}`
  while (existing.has(c)) c = `fx_${(scene.beats?.length ?? 0) + ++fxCounter}`
  return c
}

/**
 * Build the ops to add `effect` to element `elId` at time `tSec` — creating a
 * narration ref, cue and per-locale marks as needed, or attaching to a beat
 * that already sits near `tSec`. Returns an op batch for the store.
 */
export function buildAddEffectOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  sceneId: string,
  elId: string,
  effect: Effect,
  tSec: number,
): EditOp[] {
  const scene = doc.scenes.find((s) => s.id === sceneId)
  if (!scene) return []
  const action = effect.make(elId)
  const ops: EditOp[] = []

  let narrId = scene.narrationRef
  if (!narrId) {
    narrId = `n_${scene.id}`
    ops.push({ t: 'scene.setNarrationRef', sceneId, narrationRef: narrId })
  }

  const marksByCue = new Map(
    (bundles[doc.meta.defaultLocale]?.narration[narrId]?.marks ?? []).map((m) => [m.cue, m.t] as const),
  )
  // reuse a beat whose cue is marked within 0.18s of tSec
  const near = (scene.beats ?? []).find((b) => {
    const mt = marksByCue.get(b.cue)
    return mt !== undefined && Math.abs(mt - tSec) < 0.18
  })

  if (near) {
    ops.push({
      t: 'beat.setActions',
      sceneId,
      beatId: near.id,
      actions: [...near.actions, action],
    })
    return ops
  }

  const cue = newCue(scene)
  const beatId = `beat_${cue}`
  ops.push({ t: 'beat.add', sceneId, beat: { id: beatId, cue, actions: [action] } })
  // stamp the mark at tSec in every locale so timing is shared
  for (const loc of doc.locales) {
    const cur = bundles[loc]?.narration[narrId]?.marks ?? []
    ops.push({
      t: 'narr.setMarks',
      locale: loc,
      narrId,
      marks: [...cur.filter((m) => m.cue !== cue), { cue, t: +tSec.toFixed(2) }].sort((a, b) => a.t - b.t),
    })
  }
  return ops
}

/**
 * Schedule a manipulative VERB (add/split/jump…) at `tSec` — the manipulative's
 * own animation, bound to a narration cue like the reference editor's "khi đọc…".
 * Ensures a narrationRef + cue + per-locale mark, then appends the ManipAction.
 */
export function buildScheduleVerbOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  sceneId: string,
  elId: string,
  verb: string,
  args: unknown,
  tSec: number,
): EditOp[] {
  const scene = doc.scenes.find((s) => s.id === sceneId)
  const el = scene?.elements.find((e) => e.id === elId)
  if (!scene || !el) return []
  const ops: EditOp[] = []
  let narrId = scene.narrationRef
  if (!narrId) {
    narrId = `n_${scene.id}`
    ops.push({ t: 'scene.setNarrationRef', sceneId, narrationRef: narrId })
  }
  const cue = newCue(scene)
  for (const loc of doc.locales) {
    const cur = bundles[loc]?.narration[narrId]?.marks ?? []
    ops.push({
      t: 'narr.setMarks',
      locale: loc,
      narrId,
      marks: [...cur.filter((m) => m.cue !== cue), { cue, t: +tSec.toFixed(2) }].sort((a, b) => a.t - b.t),
    })
  }
  const content = (el.content ?? {}) as ManipulativeContent
  const actions = [...(content.actions ?? []), { verb, at: `@${cue}`, args }]
  ops.push({ t: 'el.setContent', sceneId, elId, content: { ...content, actions } })
  return ops
}

/** All (beat, actionIndex, action) effects currently on an element. */
export function effectsOn(
  scene: Scene,
  elId: string,
): { beatId: string; idx: number; action: VisualAction; cue: string }[] {
  const out: { beatId: string; idx: number; action: VisualAction; cue: string }[] = []
  for (const b of scene.beats ?? []) {
    b.actions.forEach((a, idx) => {
      if (actionTarget(a) === elId) out.push({ beatId: b.id, idx, action: a, cue: b.cue })
    })
  }
  return out
}
