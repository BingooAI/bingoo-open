'use client'

import type { ArrowEdge, DiagramHotspot } from '@bingoo.ai/core'
import { X } from 'lucide-react'
import { useState } from 'react'
import { cn } from './lib/cn'
import { stagger, tile } from './lib/interactive'

export interface ArrowInputProps {
  /** The points arrows connect (id + x/y as 0–100 %). */
  nodes: DiagramHotspot[]
  /** Controlled answer: the arrows drawn so far. */
  edges: ArrowEdge[]
  onChange: (edges: ArrowEdge[]) => void
  /** Arrows carry a direction (from→to). Match the question's `directed`. */
  directed?: boolean
  imageSrc?: string
  /** After checking: the correct arrows + which drawn arrows are right. */
  reveal?: { answer: ArrowEdge[]; marks: Array<{ from: string; to: string; ok: boolean }> }
  disabled?: boolean
  /** A11y label for the "remove arrow" chip buttons. */
  removeLabel?: string
  className?: string
}

const edgeKey = (e: { from: string; to: string }, directed: boolean) =>
  directed ? `${e.from}->${e.to}` : [e.from, e.to].sort().join('-')

/**
 * Draw arrows between points — force diagrams, matching direction, number-line
 * jumps. Tap a node to arm it, tap another to connect; remove an arrow from the
 * chip list. Tap-based → works web + mobile. Grading in `@bingoo.ai/core`. i18n-free.
 */
export function ArrowInput({
  nodes,
  edges,
  onChange,
  directed = true,
  imageSrc,
  reveal,
  disabled,
  removeLabel,
  className,
}: ArrowInputProps) {
  const [armed, setArmed] = useState<string | null>(null)
  const locked = !!reveal || disabled
  const at = (id: string) => nodes.find((n) => n.id === id)
  const has = (from: string, to: string) =>
    edges.some((e) => edgeKey(e, directed) === edgeKey({ from, to }, directed))

  function tapNode(id: string) {
    if (locked) return
    if (armed == null) {
      setArmed(id)
      return
    }
    if (armed === id) {
      setArmed(null)
      return
    }
    if (!has(armed, id)) onChange([...edges, { from: armed, to: id }])
    setArmed(null)
  }
  function remove(i: number) {
    if (locked) return
    onChange(edges.filter((_, idx) => idx !== i))
  }

  // What to draw: learner marks + missing answers when revealed, else live edges.
  const drawn = reveal
    ? reveal.marks.map((m) => ({ ...m, tone: m.ok ? 'ok' : 'bad' }) as const)
    : edges.map((e) => ({ ...e, ok: false, tone: 'live' }) as const)
  const missing = reveal
    ? reveal.answer.filter((a) => !reveal.marks.some((m) => edgeKey(m, directed) === edgeKey(a, directed)))
    : []

  const line = (from: string, to: string, stroke: string, key: string, dashed = false, marker = 'a-head') => {
    const a = at(from)
    const b = at(to)
    if (!a || !b) return null
    // Shorten both ends so the arrow doesn't sit under the node discs.
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const pad = 6
    const ux = (dx / len) * pad
    const uy = (dy / len) * pad
    return (
      <line
        key={key}
        x1={a.x + ux}
        y1={a.y + uy}
        x2={b.x - ux}
        y2={b.y - uy}
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeDasharray={dashed ? '3 2.5' : undefined}
        markerEnd={directed ? `url(#${marker})` : undefined}
      />
    )
  }

  const strokeFor = (tone: string) =>
    tone === 'ok' ? 'var(--color-success)' : tone === 'bad' ? 'var(--color-danger)' : 'var(--color-primary)'

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className={cn(
          tile({ state: 'quiet', size: 'none' }),
          'mx-auto aspect-square w-full max-w-sm overflow-hidden',
        )}
      >
        {imageSrc ? (
          <img src={imageSrc} alt="" className="absolute inset-0 size-full object-contain" />
        ) : null}
        {/* Arrows layer — purely visual; nodes below handle interaction. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
          aria-hidden
        >
          <defs>
            <marker id="a-head" markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" fill="currentColor" className="text-primary" />
            </marker>
            <marker id="a-head-ok" markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" className="fill-success" />
            </marker>
            <marker id="a-head-bad" markerWidth="5" markerHeight="5" refX="3.6" refY="2.5" orient="auto">
              <path d="M0,0 L5,2.5 L0,5 Z" className="fill-danger" />
            </marker>
          </defs>
          {missing.map((m, i) => line(m.from, m.to, 'var(--color-success)', `miss-${i}`, true, 'a-head-ok'))}
          {drawn.map((d, i) =>
            line(
              d.from,
              d.to,
              strokeFor(d.tone),
              `edge-${i}`,
              false,
              d.tone === 'ok' ? 'a-head-ok' : d.tone === 'bad' ? 'a-head-bad' : 'a-head',
            ),
          )}
        </svg>
        {nodes.map((n) => {
          const on = armed === n.id
          return (
            // The centring translate lives on a wrapper so the tile's hover lift
            // (a transform too) cannot fight it and shift the node off its point.
            <div
              key={n.id}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <button
                type="button"
                disabled={locked}
                aria-label={n.label}
                aria-pressed={on}
                onClick={() => tapNode(n.id)}
                className={cn(
                  tile({ state: on ? 'selected' : 'idle', size: 'none' }),
                  'grid place-items-center rounded-full',
                  n.emoji ? 'size-12 text-2xl' : 'size-6',
                )}
              >
                {n.emoji ?? null}
              </button>
            </div>
          )
        })}
      </div>
      {/* Drawn arrows — tap ✕ to remove (accessible + mobile-friendly). */}
      {!reveal && edges.length > 0 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {edges.map((e, i) => (
            <button
              key={`${edgeKey(e, directed)}-${i}`}
              type="button"
              disabled={locked}
              aria-label={removeLabel}
              onClick={() => remove(i)}
              style={stagger(i)}
              className={cn(
                tile({ state: 'selected', size: 'none' }),
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary-soft-foreground motion-safe:animate-fade-up',
              )}
            >
              {(at(e.from)?.emoji ?? at(e.from)?.label ?? e.from) as string}
              <span aria-hidden>{directed ? '→' : '—'}</span>
              {(at(e.to)?.emoji ?? at(e.to)?.label ?? e.to) as string}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
