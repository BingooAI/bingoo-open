/**
 * split.ts — inserting an interaction SPLITS the scene at the playhead:
 * [ first half ] · [ INTERACTION ] · [ second half ]. Beats/marks before the
 * cut stay; those after move to the second-half scene (rebased). Objects
 * revealed before the cut simply have no reveal beat in the second half, so the
 * engine shows them from its start (persistence) — no extra flags needed.
 *
 * Falls back to a plain insert-after when the scene isn't a splittable
 * exposition, has generated audio (can't cut an mp3), or the playhead sits at a
 * boundary.
 */
import type { ExplainerDoc, LocaleBundle, Scene, GateSpec } from '@bingoo.ai/explainer'
import type { EditOp } from '../store/ops'

function hasAudio(doc: ExplainerDoc, bundles: Record<string, LocaleBundle>, narrId?: string): boolean {
  if (!narrId) return false
  return doc.locales.some((l) => !!bundles[l]?.narration[narrId]?.audioUrl)
}

/** Build ops to insert `gate` at `tsLocal` within the scene `sceneId`. */
export function insertGateOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  sceneId: string,
  tsLocal: number,
  gate: GateSpec,
  gateId: string,
  x2id: string,
): { ops: EditOp[]; split: boolean; gateId: string } {
  const idx = doc.scenes.findIndex((s) => s.id === sceneId)
  const X = doc.scenes[idx]
  const gateScene: Scene = {
    id: gateId,
    kind: 'gate',
    layout: { template: 'focus', regions: {} },
    elements: [],
    gate,
  }
  if (!X)
    return {
      ops: [{ t: 'scene.add', scene: gateScene, at: doc.scenes.length }],
      split: false,
      gateId,
    }

  const dloc = doc.meta.defaultLocale
  const marks = (X.narrationRef ? bundles[dloc]?.narration[X.narrationRef]?.marks : undefined) ?? []
  const markOf = new Map(marks.map((m) => [m.cue, m.t] as const))
  const beats = X.beats ?? []
  const bt = (b: { cue: string }) => markOf.get(b.cue) ?? 0
  const before = beats.filter((b) => bt(b) < tsLocal)
  const after = beats.filter((b) => bt(b) >= tsLocal)

  const splittable =
    X.kind === 'exposition' &&
    after.length > 0 &&
    before.length > 0 &&
    !hasAudio(doc, bundles, X.narrationRef)
  if (!splittable) {
    // plain insert: before the scene if we're at its very start, else after it
    const at = tsLocal <= 0.2 ? idx : idx + 1
    return { ops: [{ t: 'scene.add', scene: gateScene, at }], split: false, gateId }
  }

  const x2narr = X.narrationRef ? `${X.narrationRef}__${x2id}` : undefined
  const nAll = X.narrations ?? []
  const X1: Scene = { ...X, beats: before, narrations: nAll.filter((s) => s.at < tsLocal) }
  const X2: Scene = {
    ...(JSON.parse(JSON.stringify(X)) as Scene),
    id: x2id,
    beats: after,
    narrationRef: x2narr,
    narrations: nAll
      .filter((s) => s.at >= tsLocal)
      .map((s) => ({ ref: s.ref, at: +(s.at - tsLocal).toFixed(2) })),
  }

  const ops: EditOp[] = [
    { t: 'scene.remove', sceneId: X.id },
    { t: 'scene.add', scene: X1, at: idx },
    { t: 'scene.add', scene: gateScene, at: idx + 1 },
    { t: 'scene.add', scene: X2, at: idx + 2 },
  ]

  if (X.narrationRef && x2narr) {
    const beforeCues = new Set(before.map((b) => b.cue))
    const afterCues = new Set(after.map((b) => b.cue))
    for (const loc of doc.locales) {
      const n = bundles[loc]?.narration[X.narrationRef]
      if (!n) continue
      ops.push({
        t: 'narr.setMarks',
        locale: loc,
        narrId: X.narrationRef,
        marks: n.marks.filter((m) => beforeCues.has(m.cue)),
      })
      ops.push({ t: 'narr.setScript', locale: loc, narrId: x2narr, script: n.script })
      ops.push({
        t: 'narr.setMarks',
        locale: loc,
        narrId: x2narr,
        marks: n.marks
          .filter((m) => afterCues.has(m.cue))
          .map((m) => ({ cue: m.cue, t: +(m.t - tsLocal).toFixed(2) })),
      })
    }
  }
  return { ops, split: true, gateId }
}
