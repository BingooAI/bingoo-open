/**
 * TrackTimeline.tsx — the Bingoo-style track timeline. A time ruler, a draggable
 * playhead, scene bands, a narration track, and object clips packed into rows.
 * Drag a clip body to move when it happens; drag its edges to trim start/end;
 * click to select; each drag is one undo. All edits flow through clipOps → the
 * engine, so the preview stays exact.
 */
'use client';
import * as React from 'react';
import { useMemo, useRef, useState } from 'react';
import { useSnap, useStore } from '../store/ctx';
import { CLIP_COLOR, type Clip } from './clips';
import { moveClipStartOps, moveClipEndOps, setCueMarkOps } from './clipOps';
import { Thumb } from './Thumb';
import type { CapCtx } from './ExplainerStudio';

export function TrackTimeline({ cap }: { cap: CapCtx }) {
  const store = useStore();
  const { doc, bundles, ui } = useSnap();
  const { project, gt, setGt } = cap;
  const [zoom, setZoom] = useState(1);
  const PPS = 96 * zoom;
  const GUTTER = 92; // fixed left column for lane labels; content starts after it
  const px = (sec: number) => GUTTER + sec * PPS; // seconds → left px (past the gutter)
  const dur = Math.max(6, project.duration);
  const width = GUTTER + dur * PPS + 40;
  const laneRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ clip: Clip; mode: 'move' | 'l' | 'r'; startX: number } | null>(null);
  const fxDrag = useRef<{ clip: Clip; cue: string } | null>(null);
  const [snapWord, setSnapWord] = useState<{ x: number; word: string } | null>(null);

  // word timings (global) per scene → snap effects onto spoken words
  const wordsByScene = useMemo(() => {
    const m = new Map<string, { t: number; word: string }[]>();
    for (const n of project.narration) {
      const arr = m.get(n.sceneId) ?? [];
      for (const w of n.words) arr.push({ t: n.start + w.start, word: w.word });
      m.set(n.sceneId, arr);
    }
    return m;
  }, [project]);
  const allWords = useMemo(() => [...wordsByScene.values()].flat(), [wordsByScene]);
  // every spoken word laid out at its real timestamp → align visuals to speech
  const sortedWords = useMemo(() => [...allWords].sort((a, b) => a.t - b.t), [allWords]);

  const xToSec = (clientX: number) => {
    const r = laneRef.current!.getBoundingClientRect();
    return Math.max(0, (clientX - r.left + laneRef.current!.scrollLeft - GUTTER) / PPS);
  };
  const seekAt = (clientX: number) => setGt(xToSec(clientX));

  // Both of these attach WINDOW listeners rather than relying on the container's
  // onPointerMove: the clip element re-renders on every dispatch mid-drag, which
  // drops any setPointerCapture and leaves the move events going nowhere. That is
  // exactly why clips and animation dots "couldn't be dragged".
  const attachDrag = () => {
    const mv = (ev: PointerEvent) => onMove(ev as unknown as React.PointerEvent);
    const up = () => {
      onUp();
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const startDrag = (e: React.PointerEvent, clip: Clip, mode: 'move' | 'l' | 'r') => {
    e.stopPropagation();
    drag.current = { clip, mode, startX: e.clientX };
    store.setUI({ selection: clip.elId, activeSceneId: clip.sceneId });
    attachDrag();
  };
  const onFxDown = (e: React.PointerEvent, c: Clip, cue: string) => {
    e.stopPropagation();
    fxDrag.current = { clip: c, cue };
    store.setUI({ selection: c.elId, activeSceneId: c.sceneId });
    attachDrag();
  };
  // drag a narration clip to change WHEN its voice line starts (its `at`).
  // Uses WINDOW listeners (like the playhead knob) — NOT React onPointerMove +
  // pointer-capture, because the clip re-renders mid-drag and drops the capture,
  // which made the line "stick" at the start. Window listeners survive re-render.
  const onNarrDown = (
    e: React.PointerEvent,
    n: { ref: string; sceneId: string; at: number; start: number },
  ) => {
    e.stopPropagation();
    const { ref, sceneId } = n;
    const grab = xToSec(e.clientX) - n.start;
    const downX = e.clientX;
    let moved = false,
      converted = false;
    const mv = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - downX) > 3) moved = true;
      if (!ref || !moved) return;
      if (!converted) {
        const scene = store.getSnapshot().doc.scenes.find((s) => s.id === sceneId);
        if (scene?.narrationRef === ref && !(scene.narrations ?? []).some((s) => s.ref === ref))
          store.dispatch({ t: 'scene.setNarrationRef', sceneId, narrationRef: undefined });
        converted = true;
      }
      setNarrAt(sceneId, ref, xToSec(ev.clientX) - grab);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      if (moved) store.endCoalesce();
      else if (ref) cap.openNarr(sceneId, ref);
      else cap.addNarr(sceneId, 0);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const setNarrAt = (sceneId: string, ref: string, newAt: number) => {
    const scene = store.getSnapshot().doc.scenes.find((s) => s.id === sceneId); // LIVE state, never stale
    if (!scene) return;
    const at = +Math.max(0, Math.min(newAt, Math.max(0, project.duration - 0.2))).toFixed(2);
    const cur = scene.narrations ?? [];
    const narrations = cur.some((s) => s.ref === ref)
      ? cur.map((s) => (s.ref === ref ? { ...s, at } : s))
      : [...cur, { ref, at }];
    store.dispatch({ t: 'scene.setNarrations', sceneId, narrations }, `narrat:${ref}`);
  };
  // drag a sound-effect clip to change WHEN it fires — window listeners too.
  const onSfxDown = (
    e: React.PointerEvent,
    s: { elId: string; sceneId: string; start: number },
  ) => {
    e.stopPropagation();
    store.setUI({ selection: s.elId, activeSceneId: s.sceneId });
    const grab = xToSec(e.clientX) - s.start;
    const downX = e.clientX;
    let moved = false;
    const mv = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - downX) > 3) moved = true;
      if (moved) setSfxAt(s.sceneId, s.elId, xToSec(ev.clientX) - grab);
    };
    const up = () => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      if (moved) store.endCoalesce();
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const setSfxAt = (sceneId: string, elId: string, newAt: number) => {
    const el = doc.scenes.find((s) => s.id === sceneId)?.elements.find((x) => x.id === elId);
    if (!el) return;
    const c = (el.content ?? {}) as Record<string, unknown>;
    const at = +Math.max(0, Math.min(newAt, Math.max(0, project.duration - 0.1))).toFixed(2);
    store.dispatch({ t: 'el.setContent', sceneId, elId, content: { ...c, at } }, `sfxat:${elId}`);
  };
  const onMove = (e: React.PointerEvent) => {
    if (fxDrag.current) {
      const c = fxDrag.current.clip;
      const words = wordsByScene.get(c.sceneId) ?? [];
      const gtHere = xToSec(e.clientX);
      let target = gtHere,
        word = '',
        best = Infinity;
      for (const w of words) {
        const dd = Math.abs(w.t - gtHere);
        if (dd < best) {
          best = dd;
          target = w.t;
          word = w.word;
        }
      }
      const local = Math.max(0, Math.min(target - c.sceneStart, c.sceneEnd - c.sceneStart));
      store.batch(setCueMarkOps(doc, bundles, c.sceneId, fxDrag.current.cue, local));
      setSnapWord(word ? { x: target * PPS, word } : null);
      return;
    }
    const d = drag.current;
    if (!d) return;
    const deltaSec = (e.clientX - d.startX) / PPS;
    const c = d.clip;
    if (d.mode === 'l') {
      store.batch(moveClipStartOps(doc, bundles, c, c.start + deltaSec));
    } else if (d.mode === 'r') {
      store.batch(moveClipEndOps(doc, bundles, c, c.end + deltaSec));
    } else {
      const newStart = c.start + deltaSec;
      const ops = moveClipStartOps(doc, bundles, c, newStart);
      if (c.exitCue)
        ops.push(
          ...setCueMarkOps(
            doc,
            bundles,
            c.sceneId,
            c.exitCue,
            newStart + (c.end - c.start) - c.sceneStart,
          ),
        );
      store.batch(ops);
    }
  };
  const onUp = () => {
    if (drag.current || fxDrag.current) store.endCoalesce();
    drag.current = null;
    fxDrag.current = null;
    setSnapWord(null);
  };

  const selectClip = (c: Clip) => {
    store.setUI({ selection: c.elId, activeSceneId: c.sceneId });
    setGt(c.start + 0.05);
  };

  // drag the scene-end handle to hold the scene longer (or shorter, down to its
  // content/voice length). Sets scene.hold; the engine takes the max, so you can
  // never cut off the narration or an animation.
  const startEndDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
    const sid = project.sceneBounds[0]?.id;
    if (!sid) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
    const mv = (ev: PointerEvent) =>
      store.dispatch(
        {
          t: 'scene.setHold',
          sceneId: sid,
          hold: Math.max(0.5, Math.min(300, +xToSec(ev.clientX).toFixed(2))),
        },
        `hold:${sid}`,
      );
    const up = () => {
      store.endCoalesce();
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="cc-tl">
      <div className="cc-tl-toolbar">
        <span className="cc-tl-title">Timeline</span>
        <span className="cc-kbd-hint">
          Space phát · Delete xoá · ⌘Z hoàn tác · kéo clip để chỉnh giờ
        </span>
        <span className="cc-flex" />
        <button
          className="cc-btn ghost"
          disabled={!ui.selection}
          onClick={() =>
            ui.selection &&
            (store.dispatch({ t: 'el.remove', sceneId: ui.activeSceneId, elId: ui.selection }),
            store.setUI({ selection: null }))
          }
        >
          🗑 Xoá
        </button>
        <div className="cc-zoom">
          <button onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(3, z + 0.2))}>＋</button>
        </div>
      </div>

      <div className="cc-tl-scroll">
        <div className="cc-tl-inner" style={{ width }} ref={laneRef} onPointerUp={onUp}>
          {/* ruler */}
          <div className="cc-ruler" onPointerDown={(e) => seekAt(e.clientX)}>
            <span className="cc-lane-tag" style={{ background: 'var(--cc-panel2)' }}>
              ⏱ Thời gian
            </span>
            {Array.from({ length: Math.ceil(dur) + 1 }, (_, s) => (
              <div key={s} className="cc-tick" style={{ left: px(s) }}>
                {s}s
              </div>
            ))}
            {project.sceneBounds.map((b) => (
              <div key={b.id} className="cc-scene-mark" style={{ left: px(b.start) }} title={b.id}>
                <span className={b.kind === 'gate' ? 'gate' : ''}>{b.id}</span>
              </div>
            ))}
          </div>

          {/* word lane — every spoken word at its timestamp; the one under the
              playhead is highlighted, so you can line objects/effects up to the
              exact word. Click a word to jump the playhead to it. */}
          {sortedWords.length > 0 && (
            <div className="cc-wordlane">
              <span className="cc-lane-tag">💬 Chữ nói</span>
              {sortedWords.map((w, i) => {
                const next = sortedWords[i + 1];
                const on = gt >= w.t - 1e-3 && (!next || gt < next.t);
                return (
                  <span
                    key={i}
                    className={on ? 'cc-wl-word on' : 'cc-wl-word'}
                    style={{ left: px(w.t) }}
                    title="Bấm để tua tới chữ này"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setGt(w.t + 0.001);
                    }}
                  >
                    {w.word}
                  </span>
                );
              })}
            </div>
          )}

          {/* narration track + word ticks (drop targets for effects) */}
          <div className="cc-narrtrack">
            <span className="cc-lane-tag">🎙 Lời giảng</span>
            {project.narration.map((n, i) => (
              <div
                key={n.ref || `empty-${n.sceneId}-${i}`}
                className={n.ref ? 'cc-narrclip movable' : 'cc-narrclip'}
                style={{ left: px(n.start), width: Math.max(88, (n.end - n.start) * PPS) }}
                title={
                  n.ref
                    ? 'Nắm tay cầm ⠿ để kéo đổi thời điểm · bấm chữ để sửa lời'
                    : 'Bấm để thêm lời giảng'
                }
              >
                {n.ref ? (
                  <span
                    className="cc-narr-grip"
                    title="Kéo để đổi thời điểm"
                    onPointerDown={(e) => onNarrDown(e, n)}
                  >
                    ⠿
                  </span>
                ) : null}
                <span
                  className="cc-narr-txt"
                  onPointerDown={n.ref ? undefined : (e) => onNarrDown(e, n)}
                  onClick={() => n.ref && cap.openNarr(n.sceneId, n.ref)}
                >
                  {n.ref ? (n.hasAudio ? '🔊' : '🎙') : '🎙'} {n.text || '＋ Thêm lời giảng'}
                </span>
              </div>
            ))}
            {allWords.map((w, i) => (
              <div key={i} className="cc-word-tick" style={{ left: px(w.t) }} title={w.word} />
            ))}
          </div>

          {/* interaction (gate) track */}
          {project.gates.length > 0 && (
            <div className="cc-gatetrack">
              <span className="cc-lane-tag">❓ Hỏi</span>
              {project.gates.map((g) => {
                const sel = ui.activeSceneId === g.sceneId && !ui.selection;
                return (
                  <div
                    key={g.sceneId}
                    className={sel ? 'cc-gateclip sel' : 'cc-gateclip'}
                    style={{ left: px(g.start), width: Math.max(90, (g.end - g.start) * PPS) }}
                    title={g.prompt}
                    onClick={() => {
                      store.setUI({ activeSceneId: g.sceneId, selection: null });
                      setGt(g.start + 0.02);
                    }}
                  >
                    <span>❓ {gateKindLabel(g.kind)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* sound-effect track */}
          {project.sfx.length > 0 && (
            <div className="cc-sfxtrack">
              <span className="cc-lane-tag">🔊 Tiếng</span>
              {project.sfx.map((s) => (
                <div
                  key={s.elId}
                  className={ui.selection === s.elId ? 'cc-sfxclip sel' : 'cc-sfxclip'}
                  style={{ left: px(s.start), width: Math.max(70, (s.end - s.start) * PPS) }}
                  title="Kéo để đổi thời điểm phát · phím Delete để xoá"
                  onPointerDown={(e) => onSfxDown(e, s)}
                >
                  <span>
                    {s.hasAudio ? '🔊' : '🔈'} {s.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* object tracks */}
          <div className="cc-tracks">
            {project.tracks.map((track) => (
              <div key={track.row} className="cc-track">
                {track.row === 0 && <span className="cc-lane-tag">🎬 Đối tượng</span>}
                {track.clips.map((c) => {
                  const selected = c.elId === ui.selection && c.sceneId === ui.activeSceneId;
                  const left = px(c.start);
                  const w = Math.max(30, (c.end - c.start) * PPS);
                  return (
                    <div
                      key={c.key}
                      className={selected ? 'cc-clip sel' : 'cc-clip'}
                      style={{ left, width: w, background: CLIP_COLOR[c.type] ?? '#64748b' }}
                      onPointerDown={(e) => (selectClip(c), startDrag(e, c, 'move'))}
                    >
                      <span className="cc-clip-thumb">
                        <Thumb type={c.type} name={c.name} stroke="#fff" box={20} />
                      </span>
                      <span className="cc-clip-label">{c.name}</span>
                      {c.fx.map((f, i) => (
                        <span
                          key={i}
                          className="cc-clip-fx"
                          style={{ left: Math.max(2, (f.t - c.start) * PPS) }}
                          title={`${f.label} — kéo để gắn vào từ`}
                          onPointerDown={(e) => onFxDown(e, c, f.cue)}
                        />
                      ))}
                      <span className="cc-handle l" onPointerDown={(e) => startDrag(e, c, 'l')} />
                      <span className="cc-handle r" onPointerDown={(e) => startDrag(e, c, 'r')} />
                    </div>
                  );
                })}
              </div>
            ))}
            {project.tracks.length === 0 && (
              <div className="cc-track">
                <div className="cc-empty-track">Thêm đối tượng từ panel trái để tạo clip.</div>
              </div>
            )}
          </div>

          {/* snap-to-word tooltip while dragging an effect */}
          {snapWord && (
            <div className="cc-snapword" style={{ left: GUTTER + snapWord.x }}>
              “{snapWord.word}”
            </div>
          )}

          {/* scene-end handle — drag to lengthen/shorten how long the scene holds */}
          <div
            className="cc-endhandle"
            style={{ left: px(project.duration) }}
            title="Kéo để kéo dài / rút ngắn thời lượng cảnh"
            onPointerDown={startEndDrag}
          >
            <div className="cc-endhandle-grip">⇤⇥</div>
          </div>

          {/* playhead */}
          <div className="cc-playhead" style={{ left: px(gt) }}>
            <div
              className="cc-playhead-knob"
              onPointerDown={(e) => {
                try {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                } catch {
                  /* ignore */
                }
                const mv = (ev: PointerEvent) => setGt(xToSec(ev.clientX));
                const up = () => {
                  window.removeEventListener('pointermove', mv);
                  window.removeEventListener('pointerup', up);
                };
                window.addEventListener('pointermove', mv);
                window.addEventListener('pointerup', up);
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function gateKindLabel(k: string): string {
  return (
    (
      {
        select: 'Chọn đáp án',
        'predict-check': 'Dự đoán',
        sequence: 'Sắp thứ tự',
        hotspot: 'Chạm vùng',
        input: 'Nhập',
        manipulate: 'Thao tác',
      } as Record<string, string>
    )[k] ?? k
  );
}
