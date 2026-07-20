// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * clipOps.ts — translate Bingoo-style clip drags into engine ops. Moving a clip
 * shifts its entrance/exit cue marks; trimming sets them absolutely. If a clip
 * has no entrance/exit yet, dragging creates one (a fade in/out) at that time —
 * so the creator never touches a cue string.
 */
import type { ExplainerDoc, LocaleBundle } from '@bingoo.ai/explainer'
import type { EditOp } from '../store/ops'
import type { Clip } from './clips'
import { EFFECTS, buildAddEffectOps } from '../effects'

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

function narrIdOf(doc: ExplainerDoc, sceneId: string): string | undefined {
  return doc.scenes.find((s) => s.id === sceneId)?.narrationRef
}

/** Set one cue's mark to `tLocal` in every locale. */
export function setCueMarkOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  sceneId: string,
  cue: string,
  tLocal: number,
): EditOp[] {
  const narrId = narrIdOf(doc, sceneId)
  if (!narrId) return []
  const ops: EditOp[] = []
  for (const loc of doc.locales) {
    const cur = bundles[loc]?.narration[narrId]?.marks ?? []
    ops.push({
      t: 'narr.setMarks',
      locale: loc,
      narrId,
      marks: [...cur.filter((m) => m.cue !== cue), { cue, t: +tLocal.toFixed(2) }].sort((a, b) => a.t - b.t),
    })
  }
  return ops
}

/** Trim/drag the clip's LEFT edge → object appears at `newStartGlobal`. */
export function moveClipStartOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  clip: Clip,
  newStartGlobal: number,
): EditOp[] {
  const dur = clip.sceneEnd - clip.sceneStart
  const local = clamp(newStartGlobal - clip.sceneStart, 0, Math.max(0, clip.end - clip.sceneStart - 0.3))
  if (clip.entranceCue) return setCueMarkOps(doc, bundles, clip.sceneId, clip.entranceCue, local)
  const fade = EFFECTS.find((e) => e.id === 'fade')!
  return buildAddEffectOps(doc, bundles, clip.sceneId, clip.elId, fade, clamp(local, 0, dur))
}

/** Trim the clip's RIGHT edge → object leaves at `newEndGlobal`. */
export function moveClipEndOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  clip: Clip,
  newEndGlobal: number,
): EditOp[] {
  const dur = clip.sceneEnd - clip.sceneStart
  const startLocal = clip.start - clip.sceneStart
  const local = clamp(newEndGlobal - clip.sceneStart, startLocal + 0.3, dur)
  if (clip.exitCue) return setCueMarkOps(doc, bundles, clip.sceneId, clip.exitCue, local)
  const fadeOut = EFFECTS.find((e) => e.id === 'fadeOut')!
  return buildAddEffectOps(
    doc,
    bundles,
    clip.sceneId,
    clip.elId,
    fadeOut,
    clamp(local, startLocal + 0.3, dur),
  )
}

/** Drag the whole clip body → shift its entrance (and exit if present) by delta. */
export function moveClipByOps(
  doc: ExplainerDoc,
  bundles: Record<string, LocaleBundle>,
  clip: Clip,
  deltaSec: number,
): EditOp[] {
  const dur = clip.sceneEnd - clip.sceneStart
  const ops: EditOp[] = []
  const startLocal = clip.start - clip.sceneStart
  const endLocal = clip.end - clip.sceneStart
  const maxShift = dur - endLocal
  const minShift = -startLocal
  const d = clamp(deltaSec, minShift, maxShift)
  if (clip.entranceCue)
    ops.push(...setCueMarkOps(doc, bundles, clip.sceneId, clip.entranceCue, startLocal + d))
  else if (Math.abs(d) > 0.01) {
    const fade = EFFECTS.find((e) => e.id === 'fade')!
    ops.push(...buildAddEffectOps(doc, bundles, clip.sceneId, clip.elId, fade, clamp(startLocal + d, 0, dur)))
  }
  if (clip.exitCue) ops.push(...setCueMarkOps(doc, bundles, clip.sceneId, clip.exitCue, endLocal + d))
  return ops
}
