/**
 * HotspotEditor.tsx — draw the tap-zones of a "hotspot" gate DIRECTLY on the
 * canvas: drag on empty space to rubber-band a new zone, drag a zone to move it,
 * drag its corner to resize, ✓ to mark it the correct answer, × to delete. All
 * coordinates are 0..1 (aspect-independent); edits flow through gate.set.
 */
'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import type { Scene, GateSpec } from '@bingoo/explainer';
import { useStore } from '../store/ctx';

type Hotspot = NonNullable<GateSpec['hotspots']>[number];
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function HotspotEditor({ scene, W, H }: { scene: Scene; W: number; H: number }) {
  const store = useStore();
  const gate = scene.gate!;
  const hotspots = gate.hotspots ?? [];
  const answer = Array.isArray(gate.answer) ? gate.answer : [gate.answer];
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    mode: 'new' | 'move' | 'resize';
    id?: string;
    sx: number;
    sy: number;
    orig?: Hotspot;
    rect?: { x: number; y: number; w: number; h: number };
  } | null>(null);
  const [rubber, setRubber] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const set = (hs: Hotspot[]) =>
    store.dispatch({ t: 'gate.set', sceneId: scene.id, gate: { ...gate, hotspots: hs } });
  const toLogical = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const cap = (e: React.PointerEvent) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onDown = (e: React.PointerEvent) => {
    const p = toLogical(e);
    drag.current = { mode: 'new', sx: p.x, sy: p.y };
    setRubber({ x: p.x, y: p.y, w: 0, h: 0 });
    cap(e);
  };
  const startMove = (e: React.PointerEvent, h: Hotspot) => {
    e.stopPropagation();
    const p = toLogical(e);
    drag.current = { mode: 'move', id: h.id, sx: p.x, sy: p.y, orig: h };
    cap(e);
  };
  const startResize = (e: React.PointerEvent, h: Hotspot) => {
    e.stopPropagation();
    const p = toLogical(e);
    drag.current = { mode: 'resize', id: h.id, sx: p.x, sy: p.y, orig: h };
    cap(e);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toLogical(e);
    if (d.mode === 'new') {
      d.rect = {
        x: Math.min(d.sx, p.x),
        y: Math.min(d.sy, p.y),
        w: Math.abs(p.x - d.sx),
        h: Math.abs(p.y - d.sy),
      };
      setRubber(d.rect);
    } else if (d.mode === 'move' && d.orig) {
      const dx = p.x - d.sx,
        dy = p.y - d.sy;
      set(
        hotspots.map((h) =>
          h.id === d.id
            ? {
                ...h,
                x: +clamp(d.orig!.x + dx, 0, 1 - h.w).toFixed(3),
                y: +clamp(d.orig!.y + dy, 0, 1 - h.h).toFixed(3),
              }
            : h,
        ),
      );
    } else if (d.mode === 'resize' && d.orig) {
      set(
        hotspots.map((h) =>
          h.id === d.id
            ? {
                ...h,
                w: +clamp(d.orig!.w + (p.x - d.sx), 0.05, 1 - h.x).toFixed(3),
                h: +clamp(d.orig!.h + (p.y - d.sy), 0.05, 1 - h.y).toFixed(3),
              }
            : h,
        ),
      );
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    const rc = d?.rect;
    if (d?.mode === 'new' && rc && rc.w > 0.04 && rc.h > 0.04) {
      const id = `sp${Math.round(rc.x * 999) + hotspots.length}`;
      set([
        ...hotspots,
        {
          id,
          label: `Vùng ${hotspots.length + 1}`,
          x: +rc.x.toFixed(3),
          y: +rc.y.toFixed(3),
          w: +rc.w.toFixed(3),
          h: +rc.h.toFixed(3),
        },
      ]);
    } else if (d?.mode === 'move' || d?.mode === 'resize') store.endCoalesce?.();
    setRubber(null);
  };

  return (
    <div className="cc-hotspot-edit">
      <div className="cc-hotspot-bar">
        ◎ Vẽ vùng chạm — kéo trên khung để tạo vùng · ✓ đánh dấu vùng đúng
      </div>
      <svg
        ref={svgRef}
        className="cc-hotspot-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
      >
        {hotspots.map((h) => {
          const correct = answer.includes(h.id);
          const x = h.x * W,
            y = h.y * H,
            w = h.w * W,
            hh = h.h * H;
          return (
            <g key={h.id}>
              <rect
                x={x}
                y={y}
                width={w}
                height={hh}
                rx={10}
                className={correct ? 'cc-hs correct' : 'cc-hs'}
                onPointerDown={(e) => startMove(e, h)}
              />
              <text x={x + 10} y={y + 26} className="cc-hs-label">
                {h.label}
                {correct ? ' ✓' : ''}
              </text>
              {/* mark-correct toggle (top-left) */}
              <g
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  set(hotspots);
                  store.dispatch({
                    t: 'gate.set',
                    sceneId: scene.id,
                    gate: { ...gate, answer: h.id },
                  });
                }}
              >
                <circle
                  cx={x + w - 46}
                  cy={y + 22}
                  r={15}
                  className={correct ? 'cc-hs-btn on' : 'cc-hs-btn'}
                />
                <text x={x + w - 46} y={y + 28} className="cc-hs-btn-ic">
                  ✓
                </text>
              </g>
              {/* delete (top-right) */}
              <g
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  set(hotspots.filter((z) => z.id !== h.id));
                }}
              >
                <circle cx={x + w - 16} cy={y + 22} r={15} className="cc-hs-btn del" />
                <text x={x + w - 16} y={y + 28} className="cc-hs-btn-ic">
                  ✕
                </text>
              </g>
              {/* resize handle (bottom-right) */}
              <rect
                x={x + w - 16}
                y={y + hh - 16}
                width={20}
                height={20}
                rx={4}
                className="cc-hs-resize"
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => startResize(e, h)}
              />
            </g>
          );
        })}
        {rubber && (
          <rect
            x={rubber.x * W}
            y={rubber.y * H}
            width={rubber.w * W}
            height={rubber.h * H}
            rx={10}
            className="cc-hs rubber"
          />
        )}
      </svg>
    </div>
  );
}
