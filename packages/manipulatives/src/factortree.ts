// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * factortree.ts — FactorTree (cây thừa số nguyên tố). Prime factorization as a
 * splitting tree for upper primary / middle school (ages 10–14): the number n
 * sits at the root; each split [a,b] breaks the current leftmost composite
 * leaf into a × b (only accepted when a·b really equals that leaf and both
 * are > 1, so the product of the leaves is ALWAYS n). Prime leaves get a
 * circle, composite leaves an inviting dashed ring, and the bottom equation
 * "n = 2 × 2 × 3 × 3" is computed from the sorted leaves.
 * verbs: split(a,b) · splitBy(d) · circlePrimes · showProduct · reset(n).
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK, fmt, lerp, clamp01 } from './util'

export type FactorTreeP = {
  n: number
  splits: [number, number][] // applied in order to the leftmost composite leaf
  circled: boolean
  showProduct: boolean
}

const DEFAULT: FactorTreeP = { n: 36, splits: [], circled: false, showProduct: false }

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : d
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false
  return true
}

/* ------------------------------------------------------------------- tree */

type TNode = { v: number; kids: [TNode, TNode] | null }

/** First composite leaf in left-to-right leaf order (the split target). */
function leftComposite(nd: TNode): TNode | null {
  if (!nd.kids) return isPrime(nd.v) ? null : nd
  return leftComposite(nd.kids[0]) ?? leftComposite(nd.kids[1])
}

/** Build the tree purely from n + splits (invalid entries are skipped). */
function build(n: number, splits: [number, number][]): TNode {
  const root: TNode = { v: n, kids: null }
  for (const [a, b] of splits) {
    const leaf = leftComposite(root)
    if (!leaf || a < 2 || b < 2 || a * b !== leaf.v) continue
    leaf.kids = [
      { v: a, kids: null },
      { v: b, kids: null },
    ]
  }
  return root
}

function leavesOf(nd: TNode, out: number[] = []): number[] {
  if (!nd.kids) out.push(nd.v)
  else {
    leavesOf(nd.kids[0], out)
    leavesOf(nd.kids[1], out)
  }
  return out
}

function normalize(raw: unknown): FactorTreeP {
  const r = (raw ?? {}) as Partial<FactorTreeP>
  let n = Math.floor(num(r.n, 36))
  if (!(n >= 2) || n > 9999) n = 36
  // validate splits sequentially: each must factor the current leftmost composite leaf
  const clean: [number, number][] = []
  const root: TNode = { v: n, kids: null }
  const rawSplits = Array.isArray(r.splits) ? r.splits : []
  for (const s of rawSplits.slice(0, 32)) {
    const a = Math.floor(num((s as unknown[])?.[0]))
    const b = Math.floor(num((s as unknown[])?.[1]))
    const leaf = leftComposite(root)
    if (!leaf || a < 2 || b < 2 || a * b !== leaf.v) continue // invalid → ignored
    leaf.kids = [
      { v: a, kids: null },
      { v: b, kids: null },
    ]
    clean.push([a, b])
  }
  return { n, splits: clean, circled: !!r.circled, showProduct: !!r.showProduct }
}

const verbs: Manipulative<FactorTreeP>['verbs'] = {
  split(p, args): VerbClip<FactorTreeP> {
    const a = Math.floor(num(args?.a))
    const b = Math.floor(num(args?.b))
    const leaf = leftComposite(build(p.n, p.splits))
    if (!leaf || a < 2 || b < 2 || a * b !== leaf.v) return tween(p, p, 0.3, 'easeOutCubic') // invalid → no-op
    return tween(p, { ...p, splits: [...p.splits, [a, b] as [number, number]] }, 0.6, 'easeOutBack')
  },
  /** Split the leftmost composite leaf L by divisor d → [d, L/d]. */
  splitBy(p, args): VerbClip<FactorTreeP> {
    const d = Math.floor(num(args?.d ?? args))
    const leaf = leftComposite(build(p.n, p.splits))
    if (!leaf || d < 2 || leaf.v % d !== 0 || leaf.v / d < 2) return tween(p, p, 0.3, 'easeOutCubic')
    return tween(p, { ...p, splits: [...p.splits, [d, leaf.v / d] as [number, number]] }, 0.6, 'easeOutBack')
  },
  circlePrimes(p): VerbClip<FactorTreeP> {
    return tween(p, { ...p, circled: true }, 0.5, 'easeOutBack')
  },
  showProduct(p): VerbClip<FactorTreeP> {
    return tween(p, { ...p, showProduct: true }, 0.5, 'easeOutCubic')
  },
  reset(p, args): VerbClip<FactorTreeP> {
    let n = Math.floor(num(args?.n ?? args, 0))
    if (!(n >= 2) || n > 9999) n = p.n
    return tween(p, { n, splits: [], circled: false, showProduct: false }, 0.4, 'easeInCubic')
  },
}

/* ----------------------------------------------------------------- layout */

type LNode = {
  path: string
  v: number
  x: number
  y: number
  leaf: boolean
  prime: boolean
  parent: string | null
}

/** Leaves evenly spaced, internal nodes centered over their leaves. */
function layoutTree(
  root: TNode,
  box: { w: number; h: number },
): { nodes: Map<string, LNode>; levelH: number } {
  let maxDepth = 0
  const leaves: TNode[] = []
  const walk = (nd: TNode, d: number) => {
    maxDepth = Math.max(maxDepth, d)
    if (!nd.kids) leaves.push(nd)
    else {
      walk(nd.kids[0], d + 1)
      walk(nd.kids[1], d + 1)
    }
  }
  walk(root, 0)
  const xOf = new Map<TNode, number>()
  leaves.forEach((lf, i) => xOf.set(lf, box.w * 0.07 + ((i + 0.5) / leaves.length) * box.w * 0.86))
  const topY = box.h * 0.12
  const levelH = (box.h * 0.74 - topY) / Math.max(1, maxDepth)
  const nodes = new Map<string, LNode>()
  const assign = (nd: TNode, path: string, d: number, parent: string | null): number => {
    const x = nd.kids
      ? (assign(nd.kids[0], path + 'L', d + 1, path) + assign(nd.kids[1], path + 'R', d + 1, path)) / 2
      : xOf.get(nd)!
    nodes.set(path, {
      path,
      v: nd.v,
      x,
      y: topY + d * levelH,
      leaf: !nd.kids,
      prime: isPrime(nd.v),
      parent,
    })
    return x
  }
  assign(root, 'r', 0, null)
  return { nodes, levelH }
}

function ringPath(cx: number, cy: number, r: number): string {
  return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
}

function render(_p: FactorTreeP, state: ManipState<FactorTreeP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const u = clamp01(seg.p)
  const tree = build(P.n, P.splits)
  const lay = layoutTree(tree, box)
  const leaves = leavesOf(tree)
  const allPrime = leaves.every(isPrime)
  const splitting =
    (seg.verb === 'split' || seg.verb === 'splitBy') && P.splits.length > seg.from.splits.length
  const resetting = seg.verb === 'reset' && u < 1 && (seg.from.n !== P.n || seg.from.splits.length > 0)
  let fromLay: ReturnType<typeof layoutTree> | null = null
  if (splitting || resetting) fromLay = layoutTree(build(seg.from.n, seg.from.splits), box)

  const rr = Math.min(
    box.h * 0.07,
    box.w * 0.055,
    lay.levelH * 0.33,
    (box.w * 0.86) / (Math.max(1, leaves.length) * 2.4),
  )

  // resolved (possibly mid-animation) position/scale/opacity per node
  type Pos = { x: number; y: number; s: number; op: number }
  const pos = new Map<string, Pos>()
  for (const nd of lay.nodes.values()) {
    let x = nd.x,
      y = nd.y,
      s = 1,
      op = 1
    if (splitting && fromLay) {
      const prev = fromLay.nodes.get(nd.path)
      if (prev) {
        x = lerp(prev.x, nd.x, u)
        y = lerp(prev.y, nd.y, u)
      } else {
        // new child: grows out along its branch from the parent
        const par = fromLay.nodes.get(nd.parent ?? '') ?? lay.nodes.get(nd.parent ?? '')
        if (par) {
          x = lerp(par.x, nd.x, u)
          y = lerp(par.y, nd.y, u)
        }
        s = 0.25 + 0.75 * u
        op = u
      }
    }
    pos.set(nd.path, { x, y, s, op })
  }

  // branches (behind nodes)
  for (const nd of lay.nodes.values()) {
    if (!nd.parent) continue
    const c = pos.get(nd.path)!
    const pp = pos.get(nd.parent)!
    prims.push({
      k: 'line',
      x1: pp.x,
      y1: pp.y + rr * pp.s,
      x2: c.x,
      y2: c.y - rr * c.s,
      color: TOK.ink,
      weight: 'sm',
      opacity: c.op,
      z: 2,
    })
  }

  // nodes
  const circleAnim = seg.verb === 'circlePrimes' ? u : 1
  for (const nd of lay.nodes.values()) {
    const q = pos.get(nd.path)!
    const r = rr * q.s
    prims.push({
      k: 'circle',
      cx: q.x,
      cy: q.y,
      r,
      fill: TOK.paper,
      color: TOK.faint,
      weight: 'sm',
      opacity: q.op * (nd.leaf ? 1 : 0.75),
      z: 3,
    })
    if (nd.leaf && !nd.prime) {
      // composite leaf: faint dashed ring inviting a split
      prims.push({
        k: 'path',
        d: ringPath(q.x, q.y, r * 1.18),
        fill: 'none',
        color: TOK.soft,
        weight: 'sm',
        dash: r * 0.3,
        opacity: 0.9 * q.op,
        z: 4,
      })
    }
    if (nd.leaf && nd.prime && P.circled) {
      const cr = r * 1.18 * (0.3 + 0.7 * circleAnim)
      prims.push({
        k: 'circle',
        cx: q.x,
        cy: q.y,
        r: cr,
        fill: TOK.good,
        opacity: 0.15 * circleAnim * q.op,
        z: 4,
      })
      prims.push({
        k: 'circle',
        cx: q.x,
        cy: q.y,
        r: cr,
        fill: 'none',
        color: TOK.good,
        weight: 'md',
        opacity: circleAnim * q.op,
        z: 4,
      })
    }
    const txt = fmt(nd.v)
    const size = r * (txt.length >= 3 ? 0.72 : txt.length === 2 ? 0.95 : 1.15)
    prims.push({
      k: 'label',
      x: q.x,
      y: q.y,
      text: txt,
      color: nd.leaf ? TOK.ink : TOK.soft,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: q.op,
      z: 5,
    })
  }

  // fading ghosts of the old tree during reset
  if (resetting && fromLay) {
    const gop = (1 - u) * 0.5
    for (const nd of fromLay.nodes.values()) {
      if (lay.nodes.has(nd.path)) continue
      prims.push({
        k: 'circle',
        cx: nd.x,
        cy: nd.y,
        r: rr,
        fill: TOK.paper,
        color: TOK.faint,
        weight: 'sm',
        opacity: gop,
        z: 2,
      })
      prims.push({
        k: 'label',
        x: nd.x,
        y: nd.y,
        text: fmt(nd.v),
        color: TOK.soft,
        size: rr,
        align: 'middle',
        baseline: 'middle',
        opacity: gop,
        z: 2,
      })
    }
  }

  // bottom product equation — computed from the actual leaves (honest even mid-factorization)
  if (P.showProduct) {
    const sorted = [...leaves].sort((a, b) => a - b)
    const eq = sorted.length > 1 ? `${fmt(P.n)} = ${sorted.map(fmt).join(' × ')}` : fmt(P.n)
    const eop = seg.verb === 'showProduct' ? u : 1
    const size = Math.min(box.h * 0.065, (box.w * 1.5) / Math.max(8, eq.length))
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.9,
      text: eq,
      color: allPrime ? TOK.good : TOK.ink,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: eop,
      z: 6,
    })
  }

  return { prims, view: box }
}

export const FactorTree: Manipulative<FactorTreeP> = {
  kind: 'factortree',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
