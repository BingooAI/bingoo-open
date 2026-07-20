// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * ops.ts — EditOp command layer (editor-spec §3.1). Every mutation to the
 * document/bundles is a pure `EditOp` with `apply(state, op) → { state, inverse }`.
 * The inverse is the backbone of undo/redo/version/audit (editor-spec §1.2).
 *
 * Nothing here mutates in place — all updates are structural-shared copies.
 */
import type {
  ExplainerDoc,
  LocaleBundle,
  Scene,
  Element,
  Beat,
  StyleTokens,
  Place,
  Ambient,
  GateSpec,
  LayoutSpec,
  Background,
  Pose,
  VisualAction,
  Mark,
  Rect,
  Aspect,
  WordTiming,
} from '@bingoo.ai/explainer'

export type EditState = { doc: ExplainerDoc; bundles: Record<string, LocaleBundle> }

export type EditOp =
  // meta / theme
  | { t: 'meta.setTitle'; title: string }
  | { t: 'meta.setTags'; tags: string[] }
  | { t: 'doc.setMusic'; music?: { src: string; volume?: number } }
  | { t: 'doc.setBackground'; background?: Background }
  | { t: 'theme.setRegister'; register: string }
  // scene
  | { t: 'scene.add'; scene: Scene; at: number }
  | { t: 'scene.remove'; sceneId: string }
  | { t: 'scene.reorder'; from: number; to: number }
  | { t: 'scene.setTemplate'; sceneId: string; template: LayoutSpec['template'] }
  | { t: 'scene.setRegions'; sceneId: string; regions: Record<string, string[]> }
  | { t: 'scene.setNarrationRef'; sceneId: string; narrationRef?: string }
  | { t: 'scene.setHold'; sceneId: string; hold?: number }
  | { t: 'scene.setNarrations'; sceneId: string; narrations: { ref: string; at: number }[] }
  | { t: 'scene.setBackground'; sceneId: string; background?: Background }
  // element
  | { t: 'el.add'; sceneId: string; element: Element; at?: number }
  | { t: 'el.remove'; sceneId: string; elId: string }
  | { t: 'el.setStyle'; sceneId: string; elId: string; style: StyleTokens }
  | { t: 'el.setPlace'; sceneId: string; elId: string; place?: Place }
  | { t: 'el.setRegion'; sceneId: string; elId: string; region?: string }
  | {
      t: 'el.setFlow'
      sceneId: string
      elId: string
      flow?: { order?: number; grow?: number; align?: string }
    }
  | { t: 'el.setContent'; sceneId: string; elId: string; content: unknown }
  | { t: 'el.setAmbient'; sceneId: string; elId: string; ambient?: Ambient }
  | { t: 'el.setZ'; sceneId: string; elId: string; z: number }
  | { t: 'el.setPose'; sceneId: string; elId: string; pose: string; value: Pose }
  | { t: 'el.setPoses'; sceneId: string; elId: string; poses: Record<string, Pose> }
  | { t: 'override.set'; sceneId: string; aspect: Aspect; elId: string; rect?: Rect }
  // beat
  | { t: 'beat.add'; sceneId: string; beat: Beat; at?: number }
  | { t: 'beat.remove'; sceneId: string; beatId: string }
  | { t: 'beat.reorder'; sceneId: string; from: number; to: number }
  | { t: 'beat.setActions'; sceneId: string; beatId: string; actions: VisualAction[] }
  | { t: 'beat.setCue'; sceneId: string; beatId: string; cue: string }
  | { t: 'beat.setHold'; sceneId: string; beatId: string; hold?: number }
  // narration / strings (locale bundle)
  | { t: 'narr.setScript'; locale: string; narrId: string; script: string }
  | { t: 'narr.setMarks'; locale: string; narrId: string; marks: Mark[] }
  | { t: 'narr.setAudio'; locale: string; narrId: string; audioUrl?: string; words?: WordTiming[] }
  | { t: 'str.set'; locale: string; elId: string; text: string }
  // gate
  | { t: 'gate.set'; sceneId: string; gate: GateSpec }
  // locales
  | { t: 'locale.add'; locale: string }
  | { t: 'locale.remove'; locale: string }

/* ------------------------------------------------------------- immutable helpers */

function replaceScene(doc: ExplainerDoc, sceneId: string, fn: (s: Scene) => Scene): ExplainerDoc {
  return { ...doc, scenes: doc.scenes.map((s) => (s.id === sceneId ? fn(s) : s)) }
}
function replaceEl(scene: Scene, elId: string, fn: (e: Element) => Element): Scene {
  return { ...scene, elements: scene.elements.map((e) => (e.id === elId ? fn(e) : e)) }
}
export function getScene(doc: ExplainerDoc, id: string): Scene | undefined {
  return doc.scenes.find((s) => s.id === id)
}
export function getEl(doc: ExplainerDoc, sceneId: string, elId: string): Element | undefined {
  return getScene(doc, sceneId)?.elements.find((e) => e.id === elId)
}
export function getBeat(doc: ExplainerDoc, sceneId: string, beatId: string): Beat | undefined {
  return getScene(doc, sceneId)?.beats?.find((b) => b.id === beatId)
}

const insert = <T>(arr: T[], item: T, at: number) => {
  const c = [...arr]
  c.splice(Math.max(0, Math.min(at, c.length)), 0, item)
  return c
}
const move = <T>(arr: T[], from: number, to: number) => {
  const c = [...arr]
  const [it] = c.splice(from, 1)
  c.splice(to, 0, it!)
  return c
}

/* ------------------------------------------------------------------------ apply */

export function applyOp(state: EditState, op: EditOp): { state: EditState; inverse: EditOp } {
  const { doc, bundles } = state
  switch (op.t) {
    case 'meta.setTitle': {
      const inverse: EditOp = { t: 'meta.setTitle', title: doc.meta.title }
      return {
        state: { doc: { ...doc, meta: { ...doc.meta, title: op.title } }, bundles },
        inverse,
      }
    }
    case 'doc.setMusic': {
      const inverse: EditOp = { t: 'doc.setMusic', music: doc.music }
      return { state: { doc: { ...doc, music: op.music }, bundles }, inverse }
    }
    case 'doc.setBackground': {
      const inverse: EditOp = { t: 'doc.setBackground', background: doc.background }
      return { state: { doc: { ...doc, background: op.background }, bundles }, inverse }
    }
    case 'meta.setTags': {
      const inverse: EditOp = { t: 'meta.setTags', tags: doc.meta.tags ?? [] }
      return { state: { doc: { ...doc, meta: { ...doc.meta, tags: op.tags } }, bundles }, inverse }
    }
    case 'theme.setRegister': {
      const inverse: EditOp = { t: 'theme.setRegister', register: doc.theme.register }
      return {
        state: { doc: { ...doc, theme: { ...doc.theme, register: op.register } }, bundles },
        inverse,
      }
    }

    case 'scene.add': {
      const inverse: EditOp = { t: 'scene.remove', sceneId: op.scene.id }
      return {
        state: { doc: { ...doc, scenes: insert(doc.scenes, op.scene, op.at) }, bundles },
        inverse,
      }
    }
    case 'scene.remove': {
      const idx = doc.scenes.findIndex((s) => s.id === op.sceneId)
      const scene = doc.scenes[idx]!
      const inverse: EditOp = { t: 'scene.add', scene, at: idx }
      return {
        state: { doc: { ...doc, scenes: doc.scenes.filter((s) => s.id !== op.sceneId) }, bundles },
        inverse,
      }
    }
    case 'scene.reorder': {
      const inverse: EditOp = { t: 'scene.reorder', from: op.to, to: op.from }
      return {
        state: { doc: { ...doc, scenes: move(doc.scenes, op.from, op.to) }, bundles },
        inverse,
      }
    }
    case 'scene.setTemplate': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = {
        t: 'scene.setTemplate',
        sceneId: op.sceneId,
        template: s.layout.template,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({
            ...sc,
            layout: { ...sc.layout, template: op.template },
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'scene.setBackground': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = {
        t: 'scene.setBackground',
        sceneId: op.sceneId,
        background: s.background,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({ ...sc, background: op.background })),
          bundles,
        },
        inverse,
      }
    }
    case 'scene.setRegions': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = {
        t: 'scene.setRegions',
        sceneId: op.sceneId,
        regions: s.layout.regions,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({
            ...sc,
            layout: { ...sc.layout, regions: op.regions },
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'scene.setNarrationRef': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = {
        t: 'scene.setNarrationRef',
        sceneId: op.sceneId,
        narrationRef: s.narrationRef,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({ ...sc, narrationRef: op.narrationRef })),
          bundles,
        },
        inverse,
      }
    }
    case 'scene.setHold': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = { t: 'scene.setHold', sceneId: op.sceneId, hold: s.hold }
      return {
        state: { doc: replaceScene(doc, op.sceneId, (sc) => ({ ...sc, hold: op.hold })), bundles },
        inverse,
      }
    }
    case 'scene.setNarrations': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = {
        t: 'scene.setNarrations',
        sceneId: op.sceneId,
        narrations: s.narrations ?? [],
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({ ...sc, narrations: op.narrations })),
          bundles,
        },
        inverse,
      }
    }

    case 'el.add': {
      const inverse: EditOp = { t: 'el.remove', sceneId: op.sceneId, elId: op.element.id }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            elements:
              op.at === undefined ? [...s.elements, op.element] : insert(s.elements, op.element, op.at),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'el.remove': {
      const s = getScene(doc, op.sceneId)!
      const at = s.elements.findIndex((e) => e.id === op.elId)
      const element = s.elements[at]!
      const inverse: EditOp = { t: 'el.add', sceneId: op.sceneId, element, at }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({
            ...sc,
            elements: sc.elements.filter((e) => e.id !== op.elId),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setStyle': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setStyle',
        sceneId: op.sceneId,
        elId: op.elId,
        style: e.style ?? {},
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, style: op.style })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setPlace': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setPlace',
        sceneId: op.sceneId,
        elId: op.elId,
        place: e.place,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, place: op.place })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setRegion': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setRegion',
        sceneId: op.sceneId,
        elId: op.elId,
        region: e.region,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, region: op.region })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setFlow': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = { t: 'el.setFlow', sceneId: op.sceneId, elId: op.elId, flow: e.flow }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, flow: op.flow })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setContent': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setContent',
        sceneId: op.sceneId,
        elId: op.elId,
        content: e.content,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, content: op.content })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setAmbient': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setAmbient',
        sceneId: op.sceneId,
        elId: op.elId,
        ambient: e.ambient,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, ambient: op.ambient })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setZ': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = { t: 'el.setZ', sceneId: op.sceneId, elId: op.elId, z: e.z ?? 0 }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => replaceEl(s, op.elId, (el) => ({ ...el, z: op.z }))),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setPose': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const prev = e.poses?.[op.pose]
      const inverse: EditOp = prev
        ? { t: 'el.setPose', sceneId: op.sceneId, elId: op.elId, pose: op.pose, value: prev }
        : { t: 'el.setPoses', sceneId: op.sceneId, elId: op.elId, poses: e.poses ?? {} }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({
              ...el,
              poses: { ...(el.poses ?? {}), [op.pose]: op.value },
            })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'el.setPoses': {
      const e = getEl(doc, op.sceneId, op.elId)!
      const inverse: EditOp = {
        t: 'el.setPoses',
        sceneId: op.sceneId,
        elId: op.elId,
        poses: e.poses ?? {},
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) =>
            replaceEl(s, op.elId, (el) => ({ ...el, poses: op.poses })),
          ),
          bundles,
        },
        inverse,
      }
    }
    case 'override.set': {
      const s = getScene(doc, op.sceneId)!
      const cur = s.layout.overrides?.[op.aspect]?.[op.elId]
      const inverse: EditOp = {
        t: 'override.set',
        sceneId: op.sceneId,
        aspect: op.aspect,
        elId: op.elId,
        rect: cur,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => {
            const ov = { ...(sc.layout.overrides ?? {}) }
            const forAspect = { ...(ov[op.aspect] ?? {}) }
            if (op.rect) forAspect[op.elId] = op.rect
            else delete forAspect[op.elId]
            ov[op.aspect] = forAspect
            return { ...sc, layout: { ...sc.layout, overrides: ov } }
          }),
          bundles,
        },
        inverse,
      }
    }

    case 'beat.add': {
      const inverse: EditOp = { t: 'beat.remove', sceneId: op.sceneId, beatId: op.beat.id }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            beats:
              op.at === undefined ? [...(s.beats ?? []), op.beat] : insert(s.beats ?? [], op.beat, op.at),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'beat.remove': {
      const s = getScene(doc, op.sceneId)!
      const at = (s.beats ?? []).findIndex((b) => b.id === op.beatId)
      const beat = (s.beats ?? [])[at]!
      const inverse: EditOp = { t: 'beat.add', sceneId: op.sceneId, beat, at }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (sc) => ({
            ...sc,
            beats: (sc.beats ?? []).filter((b) => b.id !== op.beatId),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'beat.reorder': {
      const inverse: EditOp = { t: 'beat.reorder', sceneId: op.sceneId, from: op.to, to: op.from }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            beats: move(s.beats ?? [], op.from, op.to),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'beat.setActions': {
      const b = getBeat(doc, op.sceneId, op.beatId)!
      const inverse: EditOp = {
        t: 'beat.setActions',
        sceneId: op.sceneId,
        beatId: op.beatId,
        actions: b.actions,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            beats: (s.beats ?? []).map((bb) => (bb.id === op.beatId ? { ...bb, actions: op.actions } : bb)),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'beat.setCue': {
      const b = getBeat(doc, op.sceneId, op.beatId)!
      const inverse: EditOp = {
        t: 'beat.setCue',
        sceneId: op.sceneId,
        beatId: op.beatId,
        cue: b.cue,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            beats: (s.beats ?? []).map((bb) => (bb.id === op.beatId ? { ...bb, cue: op.cue } : bb)),
          })),
          bundles,
        },
        inverse,
      }
    }
    case 'beat.setHold': {
      const b = getBeat(doc, op.sceneId, op.beatId)!
      const inverse: EditOp = {
        t: 'beat.setHold',
        sceneId: op.sceneId,
        beatId: op.beatId,
        hold: b.hold,
      }
      return {
        state: {
          doc: replaceScene(doc, op.sceneId, (s) => ({
            ...s,
            beats: (s.beats ?? []).map((bb) => (bb.id === op.beatId ? { ...bb, hold: op.hold } : bb)),
          })),
          bundles,
        },
        inverse,
      }
    }

    case 'narr.setScript': {
      const b = bundles[op.locale]
      if (!b) throw new Error(`locale bundle not found: ${op.locale}`)
      const cur = b.narration[op.narrId]
      const inverse: EditOp = {
        t: 'narr.setScript',
        locale: op.locale,
        narrId: op.narrId,
        script: cur?.script ?? '',
      }
      const narration = {
        ...b.narration,
        [op.narrId]: { ...(cur ?? { voice: 'mock', marks: [] }), script: op.script },
      }
      return { state: { doc, bundles: { ...bundles, [op.locale]: { ...b, narration } } }, inverse }
    }
    case 'narr.setMarks': {
      const b = bundles[op.locale]
      if (!b) throw new Error(`locale bundle not found: ${op.locale}`)
      const cur = b.narration[op.narrId]
      const inverse: EditOp = {
        t: 'narr.setMarks',
        locale: op.locale,
        narrId: op.narrId,
        marks: cur?.marks ?? [],
      }
      const narration = {
        ...b.narration,
        [op.narrId]: { ...(cur ?? { voice: 'mock', script: '' }), marks: op.marks },
      }
      return { state: { doc, bundles: { ...bundles, [op.locale]: { ...b, narration } } }, inverse }
    }
    case 'str.set': {
      const b = bundles[op.locale]
      if (!b) throw new Error(`locale bundle not found: ${op.locale}`)
      const inverse: EditOp = {
        t: 'str.set',
        locale: op.locale,
        elId: op.elId,
        text: b.strings[op.elId] ?? '',
      }
      return {
        state: {
          doc,
          bundles: {
            ...bundles,
            [op.locale]: { ...b, strings: { ...b.strings, [op.elId]: op.text } },
          },
        },
        inverse,
      }
    }
    case 'narr.setAudio': {
      const b = bundles[op.locale]
      if (!b) throw new Error(`locale bundle not found: ${op.locale}`)
      const cur = b.narration[op.narrId]
      const inverse: EditOp = {
        t: 'narr.setAudio',
        locale: op.locale,
        narrId: op.narrId,
        audioUrl: cur?.audioUrl,
        words: cur?.words,
      }
      const narration = {
        ...b.narration,
        [op.narrId]: {
          ...(cur ?? { voice: 'mock', script: '', marks: [] }),
          audioUrl: op.audioUrl,
          words: op.words,
        },
      }
      return { state: { doc, bundles: { ...bundles, [op.locale]: { ...b, narration } } }, inverse }
    }

    case 'gate.set': {
      const s = getScene(doc, op.sceneId)!
      const inverse: EditOp = { t: 'gate.set', sceneId: op.sceneId, gate: s.gate! }
      return {
        state: { doc: replaceScene(doc, op.sceneId, (sc) => ({ ...sc, gate: op.gate })), bundles },
        inverse,
      }
    }

    case 'locale.add': {
      const inverse: EditOp = { t: 'locale.remove', locale: op.locale }
      const newBundle: LocaleBundle = { locale: op.locale, strings: {}, narration: {} }
      return {
        state: {
          doc: { ...doc, locales: [...doc.locales, op.locale] },
          bundles: { ...bundles, [op.locale]: newBundle },
        },
        inverse,
      }
    }
    case 'locale.remove': {
      const removed = bundles[op.locale]
      const inverse: EditOp = { t: 'locale.add', locale: op.locale }
      const rest = { ...bundles }
      delete rest[op.locale]
      // (restore of strings on undo is best-effort; add re-creates an empty bundle)
      void removed
      return {
        state: {
          doc: { ...doc, locales: doc.locales.filter((l) => l !== op.locale) },
          bundles: rest,
        },
        inverse,
      }
    }
  }
}

/** Apply many ops as a transaction; returns combined inverse (reverse order). */
export function applyBatch(state: EditState, ops: EditOp[]): { state: EditState; inverse: EditOp[] } {
  let cur = state
  const inverses: EditOp[] = []
  for (const op of ops) {
    const r = applyOp(cur, op)
    cur = r.state
    inverses.unshift(r.inverse)
  }
  return { state: cur, inverse: inverses }
}
