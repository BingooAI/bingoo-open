/**
 * PreviewStage.tsx — the interactive preview for the Bingoo editor. Renders the
 * engine RenderModel and overlays selection/drag handles + INLINE text editing
 * on double-click, so the creator edits directly on the canvas (no side panel
 * needed). Every manipulation emits an op → the engine stays the source of truth.
 */
'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import type { RenderModel, ConnectorContent } from '@bingoo/explainer';
import type { Aspect, Place, ThemeTokens } from '@bingoo/explainer';
import { Stage } from '../../elements/Stage';
import { GateHost } from '../../player/GateHost';
import { HotspotEditor } from './HotspotEditor';
import { useSnap, useStore, genId } from '../store/ctx';
import { dragState } from './dragState';

export function PreviewStage({
  model,
  theme,
  aspect,
}: {
  model: RenderModel;
  theme: ThemeTokens;
  aspect: Aspect;
}) {
  const store = useStore();
  const { doc, bundles, ui } = useSnap();
  const { w: W, h: H } = model.canvas;
  const scene = doc.scenes.find((s) => s.id === model.sceneId);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{
    id: string;
    place?: Place;
    mode: 'move' | 'resize' | 'rotate';
    cx: number;
    cy: number;
    ox?: number;
    oy?: number;
  } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [connLine, setConnLine] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [connTarget, setConnTarget] = useState<string | null>(null);

  const elById = (id: string) =>
    doc.scenes.find((s) => s.id === model.sceneId)?.elements.find((e) => e.id === id);
  const toLogical = (e: React.PointerEvent | React.MouseEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const hit = (x: number, y: number) => {
    for (let i = model.items.length - 1; i >= 0; i--) {
      const it = model.items[i]!;
      // connectors are lines — hit-test by distance to the segment, not the bbox,
      // so clicking empty space near a diagonal arrow doesn't select the arrow.
      if (it.type === 'connector') {
        if (nearConnector(x, y, it.content as ConnectorContent)) return it.id;
        continue;
      }
      const rc = it.rect;
      if (x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h) return it.id;
    }
    return null;
  };

  const onDown = (e: React.PointerEvent) => {
    if (editing) return;
    const p = toLogical(e);
    const id = hit(p.x, p.y);
    // "draw flow" mode: click one shape, then another → arrow between them
    if (ui.connecting) {
      const el = id ? elById(id) : undefined;
      if (el && el.type !== 'connector') {
        if (!ui.connectFrom) store.setUI({ connectFrom: id });
        else if (ui.connectFrom !== id) {
          const cid = genId('conn');
          store.dispatch({
            t: 'el.add',
            sceneId: model.sceneId,
            element: {
              id: cid,
              type: 'connector',
              content: { from: ui.connectFrom, to: id, arrow: true },
              place: { at: 'free', x: 0.5, y: 0.5, size: 1 },
              z: -1,
              style: { color: 'ink', weight: 'md' },
            },
          });
          store.setUI({ connectFrom: null, selection: cid }); // keep connecting → chain more
        }
      } else if (!id) store.setUI({ connectFrom: null }); // click empty → reset pick
      return;
    }
    store.setUI({ selection: id });
    if (!id) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const item = model.items.find((it) => it.id === id)!;
    const cx = item.rect.x + item.rect.w / 2,
      cy = item.rect.y + item.rect.h / 2;
    drag.current = {
      id,
      place: elById(id)?.place,
      mode: 'move',
      cx,
      cy,
      ox: cx - p.x,
      oy: cy - p.y,
    };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toLogical(e);
    const item = model.items.find((it) => it.id === d.id);
    if (!item) return;
    // A slot-positioned element ignores `place`; dragging it did nothing. Detach
    // it from its slot on first drag so the free placement takes effect. One
    // dispatch, coalesced under the same drag key, so it's a single undo.
    const el = elById(d.id);
    if (el?.region) {
      store.dispatch(
        { t: 'el.setRegion', sceneId: model.sceneId, elId: d.id, region: undefined },
        `drag:${d.id}`,
      );
    }
    if (d.mode === 'move') {
      const base: Place = d.place ?? {
        at: 'free',
        x: 0.5,
        y: 0.5,
        size: item.rect.h / H,
        w: item.rect.w / W,
      };
      // free 2-axis drag for every object (grab offset keeps the cursor on the
      // same spot). Ground-anchored props become free once you move them, so
      // nothing is locked to the horizontal any more.
      store.dispatch(
        {
          t: 'el.setPlace',
          sceneId: model.sceneId,
          elId: d.id,
          place: {
            ...base,
            at: 'free',
            x: cl((p.x + (d.ox ?? 0)) / W),
            y: cl((p.y + (d.oy ?? 0)) / H),
          },
        },
        `drag:${d.id}`,
      );
    } else if (d.mode === 'resize') {
      const base: Place = d.place ?? {
        at: 'free',
        x: d.cx / W,
        y: d.cy / H,
        size: item.rect.h / H,
        w: item.rect.w / W,
      };
      store.dispatch(
        {
          t: 'el.setPlace',
          sceneId: model.sceneId,
          elId: d.id,
          place: {
            ...base,
            size: cl((Math.abs(p.y - d.cy) * 2) / H, 0.03, 1),
            ...(base.w !== undefined ? { w: cl((Math.abs(p.x - d.cx) * 2) / W, 0.05, 1) } : {}),
          },
        },
        `resize:${d.id}`,
      );
    } else if (d.mode === 'rotate') {
      const base: Place | undefined = d.place;
      if (base) {
        let deg = (Math.atan2(p.x - d.cx, -(p.y - (item.rect.y + item.rect.h))) * 180) / Math.PI;
        if (Math.abs(deg % 45) < 4) deg = Math.round(deg / 45) * 45;
        store.dispatch(
          {
            t: 'el.setPlace',
            sceneId: model.sceneId,
            elId: d.id,
            place: { ...base, rotate: Math.round(deg) },
          },
          `rot:${d.id}`,
        );
      }
    }
  };
  const onUp = () => {
    if (drag.current) store.endCoalesce();
    drag.current = null;
  };

  const onDbl = (e: React.MouseEvent) => {
    const p = toLogical(e);
    const id = hit(p.x, p.y);
    const el = id ? elById(id) : undefined;
    // double-click a TEXT or a SHAPE → edit its label inline (shapes render the
    // label centered, from bundle.strings[id]); double-click a stick → its label too
    if (el && (el.type === 'text' || el.type === 'shape')) {
      store.setUI({ selection: id });
      setEditing(id!);
    } else if (el && el.type === 'image') {
      // double-click a picture → open the media library picker (the button in
      // the inspector still works; this is the expected gesture)
      store.setUI({ selection: id, pickImageFor: id });
    }
  };

  const startHandle = (
    e: React.PointerEvent,
    id: string,
    mode: 'resize' | 'rotate',
    item: RenderModel['items'][number],
  ) => {
    e.stopPropagation();
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    drag.current = {
      id,
      place: elById(id)?.place,
      mode,
      cx: item.rect.x + item.rect.w / 2,
      cy: item.rect.y + item.rect.h / 2,
    };
  };
  // drag from an anchor dot on the selected shape to ANOTHER shape → connector.
  // Window listeners so it survives re-render (same reliable pattern elsewhere).
  const onConnDown = (e: React.PointerEvent, fromId: string, sx: number, sy: number) => {
    e.stopPropagation();
    setConnLine({ x1: sx, y1: sy, x2: sx, y2: sy });
    const toLog = (ev: PointerEvent) => {
      const r = svgRef.current!.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const mv = (ev: PointerEvent) => {
      const p = toLog(ev);
      const tid = hit(p.x, p.y);
      const tgt = tid && tid !== fromId ? elById(tid) : undefined;
      setConnTarget(tgt && tgt.type !== 'connector' ? tid : null);
      setConnLine({ x1: sx, y1: sy, x2: p.x, y2: p.y });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      setConnLine(null);
      setConnTarget(null);
      const p = toLog(ev);
      const targetId = hit(p.x, p.y);
      const target = targetId ? elById(targetId) : undefined;
      if (targetId && targetId !== fromId && target && target.type !== 'connector') {
        const cid = genId('conn');
        store.dispatch({
          t: 'el.add',
          sceneId: model.sceneId,
          element: {
            id: cid,
            type: 'connector',
            content: { from: fromId, to: targetId, arrow: true },
            place: { at: 'free', x: 0.5, y: 0.5, size: 1 },
            z: -1,
            style: { color: 'ink', weight: 'md' },
          },
        });
        store.setUI({ selection: cid });
      }
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  // drag the connector's midpoint handle to bend it (author bend = offset of the
  // control point from the chord midpoint). Follows the shapes when they move.
  const onConnBend = (
    e: React.PointerEvent,
    elId: string,
    chordMidX: number,
    chordMidY: number,
  ) => {
    e.stopPropagation();
    const toLog = (ev: PointerEvent) => {
      const r = svgRef.current!.getBoundingClientRect();
      return { x: ((ev.clientX - r.left) / r.width) * W, y: ((ev.clientY - r.top) / r.height) * H };
    };
    const mv = (ev: PointerEvent) => {
      const p = toLog(ev);
      const cur = (elById(elId)?.content ?? {}) as Record<string, unknown>;
      store.dispatch(
        {
          t: 'el.setContent',
          sceneId: model.sceneId,
          elId,
          content: {
            ...cur,
            bendX: +(2 * (p.x - chordMidX)).toFixed(1),
            bendY: +(2 * (p.y - chordMidY)).toFixed(1),
          },
        },
        `bend:${elId}`,
      );
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      store.endCoalesce();
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  // drop a dragged media tile onto the canvas → add it at the drop point
  const onDragOver = (e: React.DragEvent) => {
    if (dragState.make) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const mk = dragState.make;
    dragState.make = null;
    if (!mk || !svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const x = cl((e.clientX - r.left) / r.width),
      y = cl((e.clientY - r.top) / r.height);
    const id = genId('el');
    const { el, text } = mk(id);
    const place: Place = { ...(el.place ?? { at: 'free', size: 0.2 }), at: 'free', x, y };
    store.dispatch({ t: 'el.add', sceneId: model.sceneId, element: { ...el, place } });
    if (text !== undefined)
      store.dispatch({ t: 'str.set', locale: ui.activeLocale, elId: id, text });
    store.setUI({ selection: id });
  };

  const sel = model.items.find((it) => it.id === ui.selection);
  const editEl = editing ? model.items.find((it) => it.id === editing) : undefined;
  const editVal = editing ? (bundles[ui.activeLocale]?.strings[editing] ?? '') : '';

  return (
    <div
      className={aspect === '9:16' ? 'cc-stage portrait' : 'cc-stage landscape'}
      style={{ position: 'relative' }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <Stage
        model={model}
        theme={theme}
        skipIds={editing && editEl?.type === 'text' ? new Set([editing]) : undefined}
      />
      {model.items.length === 0 && scene?.kind !== 'gate' && (
        <div className="cc-stage-empty">
          <div className="cc-stage-empty-ic">🎨</div>
          <div>Cảnh trống — thêm chữ, hình, nhân vật… từ panel bên trái</div>
        </div>
      )}
      {ui.connecting && (
        <div className="cc-connect-bar">
          🔗 {ui.connectFrom ? 'Bấm hình thứ HAI để nối' : 'Bấm hình thứ NHẤT'} · bấm nền trống để
          bỏ chọn
        </div>
      )}
      <svg
        ref={svgRef}
        className="cc-overlay"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onDoubleClick={onDbl}
        style={ui.connecting ? { cursor: 'crosshair' } : undefined}
      >
        {ui.connecting &&
          ui.connectFrom &&
          (() => {
            const f = model.items.find((it) => it.id === ui.connectFrom);
            return f ? (
              <rect
                x={f.rect.x - 5}
                y={f.rect.y - 5}
                width={f.rect.w + 10}
                height={f.rect.h + 10}
                rx={8}
                fill="none"
                stroke="#22c55e"
                strokeWidth={4}
                strokeDasharray="9 6"
              />
            ) : null;
          })()}
        {sel &&
          !editing &&
          !ui.connecting &&
          sel.type === 'connector' &&
          (() => {
            const c = sel.content as ConnectorContent;
            const mx = 0.25 * c.x1 + 0.5 * c.cx + 0.25 * c.x2,
              my = 0.25 * c.y1 + 0.5 * c.cy + 0.25 * c.y2;
            const chordMidX = (c.x1 + c.x2) / 2,
              chordMidY = (c.y1 + c.y2) / 2;
            return (
              <g>
                <path
                  d={`M ${c.x1} ${c.y1} Q ${c.cx} ${c.cy} ${c.x2} ${c.y2}`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={9}
                  strokeOpacity={0.3}
                  strokeLinecap="round"
                  pointerEvents="none"
                />
                <circle
                  cx={mx}
                  cy={my}
                  r={13}
                  fill="#fff"
                  stroke="#3b82f6"
                  strokeWidth={3.5}
                  style={{ cursor: 'grab' }}
                  onPointerDown={(e) => onConnBend(e, sel.id, chordMidX, chordMidY)}
                >
                  <title>Kéo để uốn cong</title>
                </circle>
              </g>
            );
          })()}
        {sel && !editing && !ui.connecting && sel.type !== 'connector' && (
          <g>
            <rect
              x={sel.rect.x}
              y={sel.rect.y}
              width={sel.rect.w}
              height={sel.rect.h}
              fill="none"
              stroke="#3b82f6"
              strokeWidth={3}
            />
            <line
              x1={sel.rect.x + sel.rect.w / 2}
              y1={sel.rect.y}
              x2={sel.rect.x + sel.rect.w / 2}
              y2={sel.rect.y - 42}
              stroke="#3b82f6"
              strokeWidth={2.5}
            />
            <circle
              cx={sel.rect.x + sel.rect.w / 2}
              cy={sel.rect.y - 48}
              r={12}
              fill="#fff"
              stroke="#3b82f6"
              strokeWidth={3}
              style={{ cursor: 'grab' }}
              onPointerDown={(e) => startHandle(e, sel.id, 'rotate', sel)}
            />
            {(
              [
                [sel.rect.x, sel.rect.y],
                [sel.rect.x + sel.rect.w, sel.rect.y],
                [sel.rect.x, sel.rect.y + sel.rect.h],
                [sel.rect.x + sel.rect.w, sel.rect.y + sel.rect.h],
              ] as [number, number][]
            ).map(([hx, hy], i) => (
              <rect
                key={i}
                x={hx - 11}
                y={hy - 11}
                width={22}
                height={22}
                rx={5}
                fill="#fff"
                stroke="#3b82f6"
                strokeWidth={3}
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(e) => startHandle(e, sel.id, 'resize', sel)}
              />
            ))}
            {/* connection anchors — drag from a green dot onto another shape to
                draw a flow arrow between them (no mode/button needed). */}
            {(
              [
                [sel.rect.x + sel.rect.w / 2, sel.rect.y],
                [sel.rect.x + sel.rect.w, sel.rect.y + sel.rect.h / 2],
                [sel.rect.x + sel.rect.w / 2, sel.rect.y + sel.rect.h],
                [sel.rect.x, sel.rect.y + sel.rect.h / 2],
              ] as [number, number][]
            ).map(([dx, dy], i) => (
              <circle
                key={'conn' + i}
                cx={dx}
                cy={dy}
                r={11}
                fill="#22c55e"
                stroke="#fff"
                strokeWidth={3}
                style={{ cursor: 'crosshair' }}
                onPointerDown={(e) => onConnDown(e, sel.id, dx, dy)}
              >
                <title>Kéo sang hình khác để nối</title>
              </circle>
            ))}
          </g>
        )}
        {connTarget &&
          (() => {
            const t = model.items.find((it) => it.id === connTarget);
            if (!t) return null;
            const dots: [number, number][] = [
              [t.rect.x + t.rect.w / 2, t.rect.y],
              [t.rect.x + t.rect.w, t.rect.y + t.rect.h / 2],
              [t.rect.x + t.rect.w / 2, t.rect.y + t.rect.h],
              [t.rect.x, t.rect.y + t.rect.h / 2],
            ];
            return (
              <g pointerEvents="none">
                <rect
                  x={t.rect.x - 5}
                  y={t.rect.y - 5}
                  width={t.rect.w + 10}
                  height={t.rect.h + 10}
                  rx={8}
                  fill="rgba(34,197,94,.10)"
                  stroke="#22c55e"
                  strokeWidth={4}
                  strokeDasharray="9 6"
                />
                {dots.map(([dx, dy], i) => (
                  <circle
                    key={i}
                    cx={dx}
                    cy={dy}
                    r={9}
                    fill="#22c55e"
                    stroke="#fff"
                    strokeWidth={2.5}
                  />
                ))}
              </g>
            );
          })()}
        {connLine && (
          <g pointerEvents="none">
            <line
              x1={connLine.x1}
              y1={connLine.y1}
              x2={connLine.x2}
              y2={connLine.y2}
              stroke="#22c55e"
              strokeWidth={3.5}
              strokeDasharray="9 6"
              strokeLinecap="round"
            />
            <circle cx={connLine.x2} cy={connLine.y2} r={7} fill="#22c55e" />
          </g>
        )}
      </svg>
      {/* preview the interaction itself — a gate scene has no drawable elements,
          so without this the canvas renders blank white. Keyed on the spec so
          edits in the Properties panel refresh the live preview immediately. */}
      {scene?.kind === 'gate' &&
        scene.gate &&
        (scene.gate.kind === 'hotspot' ? (
          <HotspotEditor scene={scene} W={W} H={H} />
        ) : (
          <GateHost
            key={JSON.stringify(scene.gate)}
            gate={scene.gate}
            theme={theme}
            aspect={aspect}
            onPass={() => {}}
          />
        ))}
      {editEl && (
        <textarea
          autoFocus
          className="cc-inline-edit"
          value={editVal}
          onChange={(e) =>
            store.dispatch(
              { t: 'str.set', locale: ui.activeLocale, elId: editing!, text: e.target.value },
              `edit:${editing}`,
            )
          }
          onBlur={() => {
            store.endCoalesce();
            setEditing(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          style={{
            position: 'absolute',
            left: `${(editEl.rect.x / W) * 100}%`,
            top: `${(editEl.rect.y / H) * 100}%`,
            width: `${(editEl.rect.w / W) * 100}%`,
            height: `${(editEl.rect.h / H) * 100}%`,
          }}
        />
      )}
    </div>
  );
}

const cl = (v: number, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);

/** true if (px,py) is within ~16px of the connector's quadratic curve. */
function nearConnector(px: number, py: number, c: ConnectorContent): boolean {
  const TOL = 16;
  let prevx = c.x1,
    prevy = c.y1;
  for (let i = 1; i <= 18; i++) {
    const t = i / 18,
      mt = 1 - t;
    const x = mt * mt * c.x1 + 2 * mt * t * c.cx + t * t * c.x2;
    const y = mt * mt * c.y1 + 2 * mt * t * c.cy + t * t * c.y2;
    if (distToSeg(px, py, prevx, prevy, x, y) <= TOL) return true;
    prevx = x;
    prevy = y;
  }
  return false;
}

/** distance from point (px,py) to segment (ax,ay)-(bx,by), in canvas units. */
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const cx = ax + t * dx,
    cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
