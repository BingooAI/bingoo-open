// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * rhymetime.ts — RhymeTime (vần điệu / word families: cat–hat–bat). A rime
 * (e.g. "-at") sits in a central box; onset letters queue on the left and
 * GLIDE in to snap in front of the rime, building one rhyming word per row —
 * the glide shows WHY the words rhyme (same ending, different start). An
 * optional odd-one-out word can be shown and spotted: the X only appears if
 * the word truly does not end with the rime (checked in code, never authored).
 * Preschool / early primary English, ages 4–7.
 * verbs: build · buildAll · highlightRime · showOdd(word) · spotOdd · choose(word).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { lerp, clamp01, TOK } from './util'

export type RhymeP = {
  rime: string
  onsets: string[]
  built: number
  odd: { word: string; present: boolean }
  /** X mark shown on the odd word (only ever true when it truly doesn't rhyme). */
  oddMarked: boolean
  highlightRime: boolean
  /** learner's picked word (grading: does it end with the rime?). */
  choice: string | null
}

const DEFAULT: RhymeP = {
  rime: 'at',
  onsets: ['c', 'h', 'b', 's'],
  built: 0,
  odd: { word: 'dog', present: false },
  oddMarked: false,
  highlightRime: false,
  choice: null,
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}
function str(v: unknown, dflt: string): string {
  return typeof v === 'string' && v.length > 0 ? v : dflt
}

function normalize(raw: unknown): RhymeP {
  const r = (raw ?? {}) as Partial<RhymeP>
  const rime = str(r.rime, DEFAULT.rime)
  let onsets = Array.isArray(r.onsets)
    ? r.onsets.filter((o): o is string => typeof o === 'string' && o.length > 0)
    : []
  if (!onsets.length) onsets = [...DEFAULT.onsets]
  const oddRaw = (r.odd ?? {}) as Partial<RhymeP['odd']>
  const odd = { word: str(oddRaw.word, 'dog'), present: !!oddRaw.present }
  return {
    rime,
    onsets,
    built: Math.max(0, Math.min(onsets.length, Math.floor(num(r.built)))),
    odd,
    // defensive: the mark can never claim a rhyming word is odd
    oddMarked: !!r.oddMarked && odd.present && !odd.word.endsWith(rime),
    highlightRime: !!r.highlightRime,
    choice: typeof r.choice === 'string' ? r.choice : null,
  }
}

const verbs: Manipulative<RhymeP>['verbs'] = {
  build(p): VerbClip<RhymeP> {
    return tween(p, { ...p, built: Math.min(p.onsets.length, p.built + 1) }, 0.6, 'easeOutCubic')
  },
  buildAll(p): VerbClip<RhymeP> {
    return tween(p, { ...p, built: p.onsets.length }, 0.9, 'easeOutCubic')
  },
  highlightRime(p): VerbClip<RhymeP> {
    return tween(p, { ...p, highlightRime: true }, 0.45, 'easeOutBack')
  },
  showOdd(p, args): VerbClip<RhymeP> {
    const word =
      typeof args?.word === 'string' && args.word
        ? args.word
        : typeof args === 'string' && args
          ? args
          : p.odd.word
    return tween(p, { ...p, odd: { word, present: true }, oddMarked: false }, 0.5, 'easeOutBack')
  },
  spotOdd(p): VerbClip<RhymeP> {
    // REAL logic: only mark when the word genuinely does not end with the rime
    const trulyOdd = p.odd.present && !p.odd.word.endsWith(p.rime)
    return tween(p, { ...p, oddMarked: trulyOdd }, 0.5, 'easeOutCubic')
  },
  choose(p, args): VerbClip<RhymeP> {
    const word =
      typeof args?.word === 'string' && args.word
        ? args.word
        : typeof args === 'string' && args
          ? args
          : p.choice
    return tween(p, { ...p, choice: word ?? null }, 0.35, 'easeOutBack')
  },
}

function render(_params: RhymeP, state: ManipState<RhymeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const nOn = Math.max(1, P.onsets.length)
  const building = seg.verb === 'build' || seg.verb === 'buildAll'

  /* left onset queue */
  const tile = Math.min(box.h * 0.1, box.w * 0.1)
  const queueX = box.w * 0.12
  const queueY0 = box.h * 0.2
  const queueStep = Math.min(tile * 1.35, (box.h * 0.68) / nOn)
  const queuePos = (slot: number) => ({ x: queueX, y: queueY0 + slot * queueStep })

  /* central rime box */
  const rimeSize = Math.min(box.h * 0.075, box.w * 0.085)
  const rimeText = '-' + P.rime
  const rimeW = rimeText.length * rimeSize * 0.62 + rimeSize
  const rimeCx = box.w * 0.55,
    rimeCy = box.h * 0.15
  const hiP = seg.verb === 'highlightRime' ? seg.p : P.highlightRime ? 1 : 0
  prims.push({
    k: 'rect',
    x: rimeCx - rimeW / 2,
    y: rimeCy - rimeSize * 0.95,
    w: rimeW,
    h: rimeSize * 1.9,
    fill: P.highlightRime ? TOK.accent : TOK.paper,
    color: TOK.ink,
    weight: 'md',
    rx: rimeSize * 0.35,
    opacity: P.highlightRime ? 0.25 + 0.2 * hiP : 1,
    z: 2,
  })
  if (hiP > 0)
    prims.push({
      k: 'rect',
      x: rimeCx - rimeW / 2 - rimeSize * 0.2,
      y: rimeCy - rimeSize * 1.15,
      w: rimeW + rimeSize * 0.4,
      h: rimeSize * 2.3,
      fill: 'none',
      color: TOK.accent,
      weight: 'md',
      rx: rimeSize * 0.45,
      opacity: hiP,
      z: 6,
    })
  prims.push({
    k: 'label',
    x: rimeCx,
    y: rimeCy,
    text: rimeText,
    color: TOK.ink,
    size: rimeSize,
    align: 'middle',
    baseline: 'middle',
    z: 3,
  })

  /* built word rows */
  const y0 = box.h * 0.34
  const rowStep = Math.min(box.h * 0.15, (box.h * 0.6) / nOn)
  const wordSize = Math.min(rowStep * 0.6, box.w * 0.08)
  const charW = wordSize * 0.62
  const mNew = Math.max(1, P.built - seg.from.built)

  // words in flight or done
  for (let k = 0; k < P.built; k++) {
    const onset = P.onsets[k]!
    const word = onset + P.rime
    const totalW = Math.max(1, word.length) * charW
    const startX = box.w * 0.5 - totalW / 2
    const yk = y0 + (k + 0.5) * rowStep
    let pk = 1
    if (building && seg.p < 1 && k >= seg.from.built) {
      const idx = k - seg.from.built
      pk = mNew > 1 ? clamp01(seg.p * mNew - idx) : seg.p
    }
    const onsetTargetX = startX + (onset.length * charW) / 2
    const q = queuePos(k - seg.from.built) // its queue slot when the verb started
    const ox = lerp(q.x, onsetTargetX, pk)
    const oy = lerp(q.y, yk, pk)
    // ghost tile carries the onset while it glides (fades as it snaps in)
    if (pk < 1)
      prims.push({
        k: 'rect',
        x: ox - tile / 2,
        y: oy - tile / 2,
        w: tile,
        h: tile,
        fill: TOK.accent2,
        color: TOK.ink,
        weight: 'sm',
        rx: tile * 0.2,
        opacity: (1 - pk) * 0.8,
        z: 4,
      })
    prims.push({
      k: 'label',
      x: ox,
      y: oy,
      text: onset,
      color: TOK.ink,
      size: wordSize,
      align: 'middle',
      baseline: 'middle',
      z: 5,
    })
    // the rime part fades in as the onset arrives
    prims.push({
      k: 'label',
      x: startX + onset.length * charW + (P.rime.length * charW) / 2,
      y: yk,
      text: P.rime,
      color: TOK.ink,
      size: wordSize,
      align: 'middle',
      baseline: 'middle',
      opacity: pk,
      z: 5,
    })
    if (P.highlightRime && pk > 0) {
      const ux1 = startX + onset.length * charW
      const ux2 = startX + word.length * charW
      const uw = seg.verb === 'highlightRime' ? seg.p : 1
      prims.push({
        k: 'line',
        x1: ux1,
        y1: yk + wordSize * 0.6,
        x2: ux1 + (ux2 - ux1) * uw,
        y2: yk + wordSize * 0.6,
        color: TOK.accent,
        weight: 'md',
        cap: 'round',
        opacity: pk,
        z: 6,
      })
    }
    // learner's chosen word gets a ring
    if (P.choice === word)
      prims.push({
        k: 'rect',
        x: startX - charW * 0.5,
        y: yk - wordSize * 0.8,
        w: totalW + charW,
        h: wordSize * 1.7,
        fill: 'none',
        color: TOK.accent2,
        weight: 'md',
        rx: wordSize * 0.35,
        z: 6,
      })
  }

  // remaining queue tiles slide up as earlier onsets leave
  const gp = building ? seg.p : 1
  for (let i = P.built; i < nOn; i++) {
    const from = queuePos(i - seg.from.built)
    const to = queuePos(i - P.built)
    const x = lerp(from.x, to.x, gp),
      y = lerp(from.y, to.y, gp)
    prims.push({
      k: 'rect',
      x: x - tile / 2,
      y: y - tile / 2,
      w: tile,
      h: tile,
      fill: TOK.accent2,
      color: TOK.ink,
      weight: 'sm',
      rx: tile * 0.2,
      z: 3,
    })
    prims.push({
      k: 'label',
      x,
      y,
      text: P.onsets[i]!,
      color: TOK.ink,
      size: tile * 0.55,
      align: 'middle',
      baseline: 'middle',
      z: 4,
    })
  }

  /* odd one out */
  if (P.odd.present) {
    const os = Math.min(box.h * 0.055, box.w * 0.055)
    const ow = Math.max(1, P.odd.word.length) * os * 0.62 + os
    const ocx = box.w * 0.85,
      ocy = box.h * 0.5
    const appearing = seg.verb === 'showOdd' && !seg.from.odd.present
    const ap = appearing ? seg.p : 1
    const wob = seg.verb === 'showOdd' ? Math.sin(seg.p * Math.PI * 4) * box.w * 0.015 * (1 - seg.p) : 0
    const x = ocx + wob
    prims.push({
      k: 'rect',
      x: x - ow / 2,
      y: ocy - os * 0.95,
      w: ow,
      h: os * 1.9,
      fill: TOK.paper,
      color: TOK.ink,
      weight: 'md',
      rx: os * 0.35,
      opacity: ap,
      z: 3,
    })
    prims.push({
      k: 'label',
      x,
      y: ocy,
      text: P.odd.word,
      color: TOK.ink,
      size: os,
      align: 'middle',
      baseline: 'middle',
      opacity: ap,
      z: 4,
    })
    if (P.choice === P.odd.word)
      prims.push({
        k: 'rect',
        x: x - ow / 2 - os * 0.25,
        y: ocy - os * 1.2,
        w: ow + os * 0.5,
        h: os * 2.4,
        fill: 'none',
        color: TOK.accent2,
        weight: 'md',
        rx: os * 0.45,
        opacity: ap,
        z: 6,
      })
    if (P.oddMarked) {
      // X draws on — it visibly does NOT share the rime
      const mp = seg.verb === 'spotOdd' ? seg.p : 1
      const x1 = x - ow / 2,
        x2 = x + ow / 2,
        yT = ocy - os * 0.95,
        yB = ocy + os * 0.95
      prims.push({
        k: 'line',
        x1,
        y1: yT,
        x2: lerp(x1, x2, mp),
        y2: lerp(yT, yB, mp),
        color: TOK.warn,
        weight: 'lg',
        cap: 'round',
        z: 7,
      })
      if (mp > 0.5) {
        const mp2 = (mp - 0.5) * 2
        prims.push({
          k: 'line',
          x1: x2,
          y1: yT,
          x2: lerp(x2, x1, mp2),
          y2: lerp(yT, yB, mp2),
          color: TOK.warn,
          weight: 'lg',
          cap: 'round',
          z: 7,
        })
      }
    }
  }

  return { prims, view: box }
}

export const RhymeTime: Manipulative<RhymeP> = {
  kind: 'rhymetime',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
