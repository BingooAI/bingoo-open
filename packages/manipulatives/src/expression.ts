// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * expression.ts — algebra expression (kit #7). params: { tree } — an AST of
 * num / var / binary-op nodes. Rendered as an infix token row; verbs highlight,
 * substitute, or fold one step. simplifyStep computes ONE numeric op by code
 * (never a hardcoded result), so the arithmetic is verifiable.
 * verbs: highlightTerm(id) · moveTerm(id) · substitute(id,val) · simplifyStep
 */
import type { Manipulative, ManipModel, ManipState, Prim, RenderCtx, VerbClip } from './types'
import { tween, activeSegment } from './bake'
import { TOK } from './util'

export type ExprNode =
  | { id: string; type: 'num'; value: number }
  | { id: string; type: 'var'; name: string }
  | { id: string; type: 'op'; op: '+' | '-' | '*' | '/'; args: [ExprNode, ExprNode] }

export type ExpressionP = {
  tree: ExprNode
  highlight: string[]
  subst: Record<string, number>
  moved: string | null
}

const DEFAULT_TREE: ExprNode = {
  id: 'r',
  type: 'op',
  op: '+',
  args: [
    { id: 'a', type: 'num', value: 2 },
    {
      id: 'b',
      type: 'op',
      op: '*',
      args: [
        { id: 'c', type: 'num', value: 3 },
        { id: 'x', type: 'var', name: 'x' },
      ],
    },
  ],
}
const DEFAULT: ExpressionP = { tree: DEFAULT_TREE, highlight: [], subst: {}, moved: null }

function normalize(raw: unknown): ExpressionP {
  const r = (raw ?? {}) as Partial<ExpressionP>
  return {
    tree: r.tree ?? DEFAULT_TREE,
    highlight: [...(r.highlight ?? [])],
    subst: { ...(r.subst ?? {}) },
    moved: r.moved ?? null,
  }
}
function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/** Evaluate a node numerically if fully numeric (given substitutions). */
function evalNode(n: ExprNode, subst: Record<string, number>): number | null {
  if (n.type === 'num') return n.value
  if (n.type === 'var') return n.name in subst ? subst[n.name]! : null
  const a = evalNode(n.args[0], subst)
  const b = evalNode(n.args[1], subst)
  if (a === null || b === null) return null
  switch (n.op) {
    case '+':
      return a + b
    case '-':
      return a - b
    case '*':
      return a * b
    case '/':
      return b === 0 ? null : a / b
  }
}

/** Fold the first reducible numeric op → returns a new tree (or same). */
function simplifyOnce(n: ExprNode, subst: Record<string, number>): ExprNode {
  if (n.type !== 'op') return n
  const va = evalNode(n.args[0], subst)
  const vb = evalNode(n.args[1], subst)
  if (va !== null && vb !== null) {
    const r = evalNode(n, subst)!
    return { id: n.id, type: 'num', value: r }
  }
  return { ...n, args: [simplifyOnce(n.args[0], subst), simplifyOnce(n.args[1], subst)] }
}

const verbs: Manipulative<ExpressionP>['verbs'] = {
  highlightTerm(p, args): VerbClip<ExpressionP> {
    const id = String(args?.id ?? args ?? '')
    return tween(p, { ...p, highlight: [id] }, 0.35, 'easeOutCubic')
  },
  moveTerm(p, args): VerbClip<ExpressionP> {
    const id = String(args?.id ?? args ?? '')
    return tween(p, { ...p, moved: id }, 0.5, 'spring')
  },
  substitute(p, args): VerbClip<ExpressionP> {
    const id = String(args?.id ?? '')
    const val = num(args?.val)
    return tween(p, { ...p, subst: { ...p.subst, [id]: val } }, 0.45, 'easeOutBack')
  },
  simplifyStep(p): VerbClip<ExpressionP> {
    return tween(p, { ...p, tree: simplifyOnce(p.tree, p.subst), highlight: [] }, 0.5, 'easeInOutCubic')
  },
}

type Tok = { id: string; text: string; op: boolean }

function flatten(n: ExprNode, subst: Record<string, number>, out: Tok[], top = true) {
  if (n.type === 'num') {
    out.push({ id: n.id, text: String(n.value), op: false })
    return
  }
  if (n.type === 'var') {
    out.push({ id: n.id, text: n.name in subst ? String(subst[n.name]) : n.name, op: false })
    return
  }
  if (!top) out.push({ id: n.id + '(', text: '(', op: true })
  flatten(n.args[0], subst, out, false)
  out.push({ id: n.id, text: ` ${n.op} `, op: true })
  flatten(n.args[1], subst, out, false)
  if (!top) out.push({ id: n.id + ')', text: ')', op: true })
}

function render(_params: ExpressionP, state: ManipState<ExpressionP>, t: number, ctx: RenderCtx): ManipModel {
  const { box } = ctx
  const seg = activeSegment(state, t)
  const P = seg.to
  const prims: Prim[] = []
  const toks: Tok[] = []
  flatten(P.tree, P.subst, toks)

  const size = box.h * 0.22
  const charW = size * 0.62
  const widths = toks.map((tk) => tk.text.length * charW)
  const total = widths.reduce((s, w) => s + w, 0)
  let x = (box.w - total) / 2
  const y = box.h * 0.5

  toks.forEach((tk, i) => {
    const hi = P.highlight.includes(tk.id)
    const isMoved = P.moved === tk.id
    const dy = isMoved && seg.verb === 'moveTerm' ? -Math.sin(Math.PI * seg.p) * box.h * 0.12 : 0
    const op = seg.verb === 'highlightTerm' && hi ? 0.4 + 0.6 * seg.p : 1
    if (hi) {
      prims.push({
        k: 'rect',
        x: x - charW * 0.15,
        y: y - size * 0.7,
        w: widths[i]! + charW * 0.3,
        h: size * 1.4,
        fill: TOK.warn,
        opacity: 0.25 * op,
        rx: 8,
        z: 1,
      })
    }
    prims.push({
      k: 'label',
      x: x + widths[i]! / 2,
      y: y + dy,
      text: tk.text,
      color: hi ? TOK.accent : tk.op ? TOK.soft : TOK.ink,
      size,
      align: 'middle',
      baseline: 'middle',
      opacity: op,
      z: 3,
    })
    x += widths[i]!
  })

  const val = evalNode(P.tree, P.subst)
  if (val !== null)
    prims.push({
      k: 'label',
      x: box.w / 2,
      y: box.h * 0.85,
      text: `= ${val}`,
      color: TOK.good,
      size: size * 0.7,
      align: 'middle',
      baseline: 'middle',
      z: 3,
    })

  return { prims, view: box }
}

export const Expression: Manipulative<ExpressionP> = {
  kind: 'expression',
  defaultParams: DEFAULT,
  normalize,
  render,
  verbs,
}
