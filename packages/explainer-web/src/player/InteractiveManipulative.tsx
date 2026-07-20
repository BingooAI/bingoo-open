/**
 * InteractiveManipulative.tsx — the learner-driven sandbox for one manipulative.
 *
 * The baked player renders a manipulative as a pure function of narration time;
 * here the LEARNER drives it: pressing a verb button, tapping, or dragging a
 * handle runs that verb live on a real rAF clock (or edits params directly). It
 * reuses the exact same pure pieces — `kit.verbs` (baked clips) + `kit.render`
 * (pure) + the shared Prims renderer — so what you manipulate looks and animates
 * identically to what plays. The engine's purity is untouched: this is a thin
 * stateful shell that feeds hand-built ManipState snapshots to `render`.
 */
'use client';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ThemeTokens, Aspect } from '@bingoo/explainer';
import { getManipulative, getInteractions } from '@bingoo/manipulatives';
import type { ManipState, VerbClip, RenderCtx, ActionDesc } from '@bingoo/manipulatives';
import { Prims, computeFit, type Fit } from '../elements/prims';

type Anim = { clip: VerbClip<unknown>; startClock: number };

const BOX: Record<Aspect, { w: number; h: number }> = {
  '16:9': { w: 1000, h: 562 },
  '9:16': { w: 562, h: 1000 },
};

export function InteractiveManipulative({
  kind,
  theme,
  aspect = '16:9',
  initialParams,
  onParams,
  variant = 'sandbox',
  hideHint = false,
  extra,
}: {
  kind: string;
  theme: ThemeTokens;
  aspect?: Aspect;
  initialParams?: unknown;
  onParams?: (params: unknown) => void;
  /** "sandbox" = own aspect box + hint (playground); "stage" = fills parent,
   *  controls overlaid at the bottom (embedded inline in a lesson). */
  variant?: 'sandbox' | 'stage';
  hideHint?: boolean;
  /** extra control(s) appended to the button row (e.g. a "Kiểm tra" button). */
  extra?: React.ReactNode;
}) {
  const kit = useMemo(() => getManipulative(kind), [kind]);
  const inter = useMemo(() => getInteractions(kind), [kind]);
  const box = BOX[aspect];
  const ctx: RenderCtx = useMemo(() => ({ aspect, box }), [aspect, box.w, box.h]);

  const paramsRef = useRef<unknown>(null);
  const kindRef = useRef<string | null>(null);
  const animRef = useRef<Anim | null>(null);
  const clockRef = useRef(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);
  const pressedRef = useRef(false);
  const fitRef = useRef<Fit | null>(null);
  const reportedRef = useRef<unknown>(undefined);
  const onParamsRef = useRef(onParams);
  onParamsRef.current = onParams;
  const [, force] = useState(0);

  // single rAF clock: advances time, commits finished animations, repaints
  useEffect(() => {
    let raf = 0;
    let t0 = 0;
    const tick = (now: number) => {
      if (!t0) t0 = now;
      clockRef.current = (now - t0) / 1000;
      const a = animRef.current;
      if (a && clockRef.current - a.startClock >= a.clip.duration) {
        paramsRef.current = a.clip.after;
        animRef.current = null;
      }
      // report settled params to a controller (interactive gate) on change
      if (paramsRef.current !== reportedRef.current) {
        reportedRef.current = paramsRef.current;
        onParamsRef.current?.(paramsRef.current);
      }
      force((n) => (n + 1) & 0xffff);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!kit) return <div className="sandbox-empty">Không tìm thấy “{kind}”.</div>;

  // lazy init — also RE-init when the kit changes, so a reused component instance
  // never feeds one kit's params into another kit's render (e.g. clock→numberline).
  if (paramsRef.current === null || kindRef.current !== kind) {
    kindRef.current = kind;
    paramsRef.current = kit.normalize(initialParams ?? kit.defaultParams);
    animRef.current = null;
    reportedRef.current = undefined;
  }

  const runVerb = (verb: string, args?: unknown) => {
    // commit any in-flight animation before starting the next
    if (animRef.current) paramsRef.current = animRef.current.clip.after;
    const fn = kit.verbs[verb];
    if (!fn) return;
    const clip = fn(paramsRef.current, args ?? {});
    animRef.current = { clip, startClock: clockRef.current };
  };
  const setParamsDirect = (p: unknown) => {
    paramsRef.current = p;
    animRef.current = null;
  };
  const reset = () => setParamsDirect(kit.normalize(initialParams ?? kit.defaultParams));

  // ---- current render model (animating clip, or settled params) ----
  const a = animRef.current;
  const model = a
    ? kit.render(
        a.clip.before,
        {
          initial: a.clip.before,
          final: a.clip.after,
          schedule: [{ verb: '', args: {}, startT: 0, clip: a.clip }],
          end: a.clip.duration,
        } as ManipState<unknown>,
        Math.min(clockRef.current - a.startClock, a.clip.duration),
        ctx,
      )
    : kit.render(
        paramsRef.current,
        {
          initial: paramsRef.current,
          final: paramsRef.current,
          schedule: [],
          end: 0,
        } as ManipState<unknown>,
        clockRef.current, // idle-animated kits (particles, current flow) keep moving
        ctx,
      );

  // fit content to the box (shrink+center) so no kit's edge labels clip
  fitRef.current = computeFit(model.prims, box);

  // ---- pointer → local box coords (undo the auto-fit transform) ----
  const toBox = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    const f = fitRef.current;
    return f ? { x: (p.x - f.tx) / f.s, y: (p.y - f.ty) / f.s } : { x: p.x, y: p.y };
  };
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); // stop the browser from starting a text selection
    pressedRef.current = true;
    draggingRef.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pressedRef.current || !inter?.onDrag) return;
    e.preventDefault();
    const next = inter.onDrag(paramsRef.current, toBox(e), ctx);
    if (next) {
      draggingRef.current = true;
      setParamsDirect(next);
    }
  };
  const onUp = (e: React.PointerEvent) => {
    pressedRef.current = false;
    if (!draggingRef.current && inter?.onTap) {
      const res = inter.onTap(paramsRef.current, toBox(e), ctx);
      if (res) {
        if (res.params) setParamsDirect(res.params);
        else if (res.verb) runVerb(res.verb, res.args);
      }
    }
    draggingRef.current = false;
  };

  const actions =
    inter?.actions ??
    Object.keys(kit.verbs).map((v) => ({ verb: v, label: v, args: undefined as unknown }));
  const interactive = !!(inter?.onTap || inter?.onDrag);
  const paper = theme.colors.paper ?? '#faf6ef';
  const stage = variant === 'stage';

  // A margin around the box so kits whose labels sit near an edge (clock's
  // digital readout, axis numbers…) are never clipped. Coordinates stay in box
  // space, so pointer→box mapping is unchanged.
  const M = Math.round(Math.min(box.w, box.h) * 0.06);
  const svg = (
    <svg
      ref={svgRef}
      viewBox={`${-M} ${-M} ${box.w + 2 * M} ${box.h + 2 * M}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        background: paper,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: interactive ? 'grab' : 'default',
      }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      role="img"
      aria-label={`manipulative ${kind}`}
    >
      <Prims prims={model.prims} theme={theme} transform={fitRef.current?.transform} />
    </svg>
  );

  return (
    <div className={stage ? 'sandbox stage' : 'sandbox'}>
      {inter?.hint && !hideHint && <div className="sandbox-hint">💡 {inter.hint}</div>}
      {stage ? (
        <div className="sandbox-surface">{svg}</div>
      ) : (
        <div className={aspect === '9:16' ? 'sandbox-stage portrait' : 'sandbox-stage'}>{svg}</div>
      )}
      <div className={stage ? 'sandbox-controls overlay' : 'sandbox-controls'}>
        {actions.map((act: ActionDesc, i: number) => (
          <button
            key={i}
            className="sandbox-btn"
            onClick={() => runVerb(act.verb, (act as { args?: unknown }).args)}
          >
            {act.label}
          </button>
        ))}
        {extra}
        <button className="sandbox-btn reset" onClick={reset}>
          ↺ Đặt lại
        </button>
      </div>
    </div>
  );
}
