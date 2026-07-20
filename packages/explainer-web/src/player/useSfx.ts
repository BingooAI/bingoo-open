/**
 * useSfx — fire scene sound-effects as one-shots when the playhead crosses each
 * effect's time. Seeking backward re-arms them. Shared by the learner Player and
 * the editor preview so SFX are audible in both. `items` are the active scene's
 * audio elements with a scene-local time `at` and a `src` (data URL / path).
 */
'use client';
import { useEffect, useRef } from 'react';

export type SfxHit = { id: string; at: number; src?: string };

export function useSfx(items: SfxHit[], tScene: number, playing: boolean, muted: boolean) {
  const fired = useRef<Set<string>>(new Set());
  const prevT = useRef(0);
  useEffect(() => {
    const pt = prevT.current;
    prevT.current = tScene;
    if (tScene < pt - 0.05) fired.current.clear(); // seeked back → allow re-trigger
    if (!playing || muted) return;
    for (const it of items) {
      if (it.at > pt - 1e-6 && it.at <= tScene && !fired.current.has(it.id)) {
        fired.current.add(it.id);
        if (it.src) {
          try {
            const a = new Audio(it.src);
            a.play().catch(() => {});
          } catch {
            /* ignore */
          }
        }
      }
    }
  }, [tScene, playing, muted, items]);
}
