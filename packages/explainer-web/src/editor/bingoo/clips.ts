// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * clips.ts — turns the cue/beat document into a CLIP model for a Bingoo-style
 * track timeline. Each object becomes a clip on the GLOBAL timeline: it starts
 * when it first appears (its entrance effect's mark) and ends at its exit (or
 * scene end). Clips are packed into non-overlapping rows (tracks) like a real
 * video editor. All timing derives from the engine — nothing is invented.
 */
import type { ExplainerDoc, LocaleBundle, Aspect } from '@bingoo.ai/explainer'
import { buildProgram, type Program } from '@bingoo.ai/explainer'
import { effectsOn, effectLabel } from '../effects'

export type ClipFx = { t: number; label: string; cue: string; beatId: string; idx: number }
export type Clip = {
  key: string
  sceneId: string
  elId: string
  name: string
  type: string
  start: number // global seconds
  end: number
  sceneStart: number
  sceneEnd: number
  entranceCue: string | null
  exitCue: string | null
  fx: ClipFx[]
}
export type Track = { row: number; clips: Clip[] }
export type NarrClip = {
  sceneId: string
  ref: string
  at: number
  start: number
  end: number
  text: string
  hasAudio: boolean
  words: { word: string; start: number; end: number }[]
}

export type GateClip = {
  sceneId: string
  start: number
  end: number
  kind: string
  prompt: string
}
export type SfxClip = {
  elId: string
  sceneId: string
  kind: string
  label: string
  at: number
  start: number
  end: number
  hasAudio: boolean
}
export type Project = {
  program: Program
  duration: number
  gateStarts: number[]
  sceneBounds: { id: string; start: number; end: number; kind: string }[]
  tracks: Track[]
  narration: NarrClip[]
  gates: GateClip[]
  sfx: SfxClip[]
}

const ENTRANCE = new Set(['reveal', 'drawOn', 'revealNode'])

export function buildProject(doc: ExplainerDoc, bundle: LocaleBundle, aspect: Aspect): Project {
  const program = buildProgram(doc, bundle, aspect)
  const clips: Clip[] = []
  const narration: NarrClip[] = []
  const gates: GateClip[] = []
  const sfx: SfxClip[] = []
  const sceneBounds = program.slots.map((s) => ({
    id: s.scene.id,
    start: s.start,
    end: s.end,
    kind: s.scene.kind,
  }))

  for (const slot of program.slots) {
    const scene = slot.scene
    if (scene.kind === 'gate' && scene.gate) {
      gates.push({
        sceneId: scene.id,
        start: slot.start,
        end: slot.end,
        kind: scene.gate.kind,
        prompt: scene.gate.prompt,
      })
    }
    const markOf = new Map(slot.marks.map((m) => [m.cue, m.t] as const))
    // narration clips — ONE PER SEGMENT (a scene can hold many voice lines).
    // Each starts at its own `at`; empty scenes get a placeholder (ref "") so
    // there's always a "＋ Thêm lời giảng" affordance to click.
    if (slot.narrations.length === 0) {
      narration.push({
        sceneId: scene.id,
        ref: '',
        at: 0,
        start: slot.start,
        end: slot.end,
        text: '',
        hasAudio: false,
        words: [],
      })
    } else {
      for (const seg of slot.narrations) {
        const text = seg.narration.script
          .replace(/\[\[cue:[^\]]+\]\]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
        const w = seg.narration.words ?? []
        const segDur = w.length ? w[w.length - 1]!.end : Math.min(3, slot.end - slot.start - seg.at)
        narration.push({
          sceneId: scene.id,
          ref: seg.ref,
          at: seg.at,
          start: slot.start + seg.at,
          end: slot.start + seg.at + Math.max(0.6, segDur),
          text,
          hasAudio: !!seg.narration.audioUrl,
          words: w,
        })
      }
    }

    for (const el of scene.elements) {
      if (el.type === 'audio') {
        const c = (el.content ?? {}) as {
          kind?: string
          label?: string
          src?: string
          at?: number
          duration?: number
        }
        const at = c.at ?? 0
        sfx.push({
          elId: el.id,
          sceneId: scene.id,
          kind: c.kind ?? 'sfx',
          label: c.label ?? 'Âm thanh',
          at,
          start: slot.start + at,
          end: slot.start + at + Math.max(0.3, c.duration ?? 0.6),
          hasAudio: !!c.src,
        })
        continue
      }
      const fxRaw = effectsOn(scene, el.id)
      const fx: ClipFx[] = fxRaw.map((f) => ({
        t: slot.start + (markOf.get(f.cue) ?? 0),
        label: effectLabel(f.action),
        cue: f.cue,
        beatId: f.beatId,
        idx: f.idx,
      }))
      const entrances = fxRaw.filter((f) => ENTRANCE.has(f.action.verb))
      const exits = fxRaw.filter((f) => f.action.verb === 'exit')
      const entranceCue = entrances[0]?.cue ?? null
      const exitCue = exits[0]?.cue ?? null
      const startLocal = entrances.length ? Math.min(...entrances.map((f) => markOf.get(f.cue) ?? 0)) : 0
      const endLocal = exits.length
        ? Math.max(...exits.map((f) => markOf.get(f.cue) ?? slot.end - slot.start))
        : slot.end - slot.start
      clips.push({
        key: `${scene.id}:${el.id}`,
        sceneId: scene.id,
        elId: el.id,
        name: clipName(el, bundle),
        type: el.type,
        start: slot.start + startLocal,
        end: slot.start + Math.max(endLocal, startLocal + 0.3),
        sceneStart: slot.start,
        sceneEnd: slot.end,
        entranceCue,
        exitCue,
        fx,
      })
    }
  }

  return {
    program,
    duration: program.duration,
    gateStarts: program.gateStarts,
    sceneBounds,
    tracks: pack(clips),
    narration,
    gates,
    sfx,
  }
}

/** Greedy row-packing so clips that overlap in time stack on separate rows. */
function pack(clips: Clip[]): Track[] {
  const sorted = [...clips].sort((a, b) => a.start - b.start || a.sceneStart - b.sceneStart)
  const rows: Clip[][] = []
  for (const c of sorted) {
    let placed = false
    for (const row of rows) {
      if (row[row.length - 1]!.end <= c.start + 0.001) {
        row.push(c)
        placed = true
        break
      }
    }
    if (!placed) rows.push([c])
  }
  return rows.map((clips, row) => ({ row, clips }))
}

function clipName(el: { id: string; type: string; content?: unknown }, bundle: LocaleBundle): string {
  if (el.type === 'text') return bundle.strings[el.id]?.slice(0, 20) || 'Chữ'
  if (el.type === 'shape') return String((el.content as { shape?: string })?.shape ?? 'Hình')
  if (el.type === 'manipulative') return String((el.content as { kind?: string })?.kind ?? 'Tương tác')
  if (el.type === 'stick') return 'Nhân vật'
  if (el.type === 'diagram') return 'Sơ đồ'
  if (el.type === 'stroke') return 'Nét vẽ'
  return el.type
}

export const CLIP_COLOR: Record<string, string> = {
  text: '#3b82f6',
  shape: '#22c55e',
  stick: '#a855f7',
  diagram: '#f59e0b',
  stroke: '#ec4899',
  manipulative: '#ef4444',
  image: '#14b8a6',
}
