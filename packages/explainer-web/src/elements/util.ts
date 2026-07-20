/**
 * elements/util.ts — shared helpers for the web SVG renderer.
 * Each element draws in a LOCAL box [0..rect.w × 0..rect.h]; this computes the
 * group transform that places that box at the element's laid-out rect plus its
 * per-frame pose offset/scale (spec §2 — pose is a function of t).
 */
import type { RenderItem } from '@bingoo/explainer';

export type ItemXform = { transform: string; opacity: number };

export function itemTransform(item: RenderItem): ItemXform {
  const { rect, pose } = item;
  const px = pose.x ?? 0;
  const py = pose.y ?? 0;
  const baseScale = pose.scale ?? 1;
  const emph = pose.emphasis ?? 0;
  const s = baseScale * (1 + emph * 0.06); // emphasis = gentle scale bump
  const rot = pose.rot ?? 0; // sway — pivot at bottom-center so it rocks like a plant
  const cx = rect.w / 2;
  const cy = rect.h / 2;
  const rotXform = rot
    ? `translate(${cx} ${rect.h}) rotate(${rot}) translate(${-cx} ${-rect.h}) `
    : '';
  const transform =
    `translate(${rect.x + px} ${rect.y + py}) ` +
    rotXform +
    `translate(${cx} ${cy}) scale(${s}) translate(${-cx} ${-cy})`;
  return { transform, opacity: clamp(pose.opacity ?? 1, 0, 1) };
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Naive word-wrap into lines that fit `maxWidth` at an estimated glyph width. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const approxCharW = fontSize * 0.55;
  const maxChars = Math.max(6, Math.floor(maxWidth / approxCharW));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cand;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [text];
}
