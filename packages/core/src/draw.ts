/**
 * Drawing / tracing / coloring engine — the shared, pure-TS core of the
 * preschool canvas batch (§R2: no UI, no platform APIs). Both platforms render
 * SVG over the SAME normalized 0–100 viewBox, so geometry, stroke scoring and
 * exports behave identically on web and native.
 *
 * Content (letter glyphs, coloring pictures) is Zod-schema data — authorable by
 * designers or an LLM (see AUTHORABLE_SCHEMAS) and validated before render.
 */

import { z } from 'zod';
import { clamp } from './utils';

/* --------------------------------- Strokes -------------------------------- */

/** A point in the normalized 0–100 canvas space. */
export type DrawPoint = readonly [number, number];

/** One freehand stroke: a polyline + paint attributes. */
export interface DrawStroke {
  points: DrawPoint[];
  color: string;
  /** Stroke width in viewBox units. */
  width: number;
}

const dist = (a: DrawPoint, b: DrawPoint): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/**
 * Append a pointer sample to a stroke-in-progress, skipping samples closer than
 * `minStep` (noise + memory control). Returns the same array when skipped.
 */
export function appendPoint(points: DrawPoint[], next: DrawPoint, minStep = 1): DrawPoint[] {
  const last = points[points.length - 1];
  if (last && dist(last, next) < minStep) return points;
  return [...points, next];
}

/**
 * Serialize a polyline to a smooth SVG path (`d`): quadratic curves through
 * midpoints — the standard freehand-smoothing trick, cheap and platform-free.
 */
export function pointsToSvgPath(points: DrawPoint[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points as [DrawPoint, ...DrawPoint[]];
  if (rest.length === 0) {
    // A dot: tiny move+line so round line-caps render it.
    return `M ${first[0]} ${first[1]} L ${first[0] + 0.01} ${first[1]}`;
  }
  let d = `M ${first[0]} ${first[1]}`;
  let prev = first;
  for (const p of rest) {
    const mx = (prev[0] + p[0]) / 2;
    const my = (prev[1] + p[1]) / 2;
    d += ` Q ${prev[0]} ${prev[1]} ${mx} ${my}`;
    prev = p;
  }
  d += ` L ${prev[0]} ${prev[1]}`;
  return d;
}

/** Resample a polyline to evenly-spaced points (`step` apart) for scoring. */
export function resamplePolyline(points: DrawPoint[], step = 2): DrawPoint[] {
  if (points.length < 2) return [...points];
  const out: DrawPoint[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]!;
    const b = points[i]!;
    let segment = dist(a, b);
    while (carry + segment >= step) {
      const t = (step - carry) / segment;
      const p: DrawPoint = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      out.push(p);
      segment = dist(p, b);
      a = p;
      carry = 0;
    }
    carry += segment;
  }
  return out;
}

/* ------------------------------ Tracing glyphs ----------------------------- */

const PointSchema = z
  .tuple([z.number().min(0).max(100), z.number().min(0).max(100)])
  .describe('An [x, y] point in the normalized 0–100 canvas space.');

/** One guide stroke of a glyph, in writing order. */
export const GlyphStroke = z.object({
  points: z
    .array(PointSchema)
    .min(2)
    .describe('The stroke polyline, in writing direction (start → end).'),
});

/**
 * A traceable glyph (letter, digit, shape): ordered guide strokes in a 0–100
 * viewBox. Authorable content (designer/LLM) — validated before render.
 */
export const TracingGlyph = z.object({
  id: z.string().min(1),
  /** The character or shape name this glyph teaches (display data). */
  label: z.string().min(1).describe('The character/shape being traced, e.g. "A".'),
  strokes: z.array(GlyphStroke).min(1).describe('Guide strokes in writing order.'),
});

export type GlyphStroke = z.infer<typeof GlyphStroke>;
export type TracingGlyph = z.infer<typeof TracingGlyph>;

export function safeParseTracingGlyph(data: unknown) {
  return TracingGlyph.safeParse(data);
}

export function tracingGlyphJsonSchema(): unknown {
  return z.toJSONSchema(TracingGlyph);
}

export interface StrokeScore {
  /** 0–1: fraction of the guide covered by the drawing (within tolerance). */
  coverage: number;
  /** Drawn stroke starts near the guide's start (writing direction). */
  hitStart: boolean;
  /** Drawn stroke ends near the guide's end. */
  hitEnd: boolean;
  passed: boolean;
}

/**
 * Score a traced stroke against its guide: resample both, then check how much
 * of the guide is covered within `tolerance`, plus start/end proximity (writing
 * direction). Pure math — identical verdicts on web and native.
 */
export function scoreTracedStroke(
  guide: DrawPoint[],
  drawn: DrawPoint[],
  tolerance = 8,
  passCoverage = 0.85,
): StrokeScore {
  if (drawn.length < 2 || guide.length < 2)
    return { coverage: 0, hitStart: false, hitEnd: false, passed: false };
  const g = resamplePolyline(guide, 2);
  const d = resamplePolyline(drawn, 2);
  let covered = 0;
  for (const gp of g) {
    let best = Infinity;
    for (const dp of d) {
      const dd = dist(gp, dp);
      if (dd < best) best = dd;
      if (best <= tolerance) break;
    }
    if (best <= tolerance) covered++;
  }
  const coverage = covered / g.length;
  const endTol = tolerance * 1.6;
  const hitStart = dist(g[0]!, d[0]!) <= endTol;
  const hitEnd = dist(g[g.length - 1]!, d[d.length - 1]!) <= endTol;
  return { coverage, hitStart, hitEnd, passed: coverage >= passCoverage && hitStart && hitEnd };
}

/* ------------------------------ Coloring pictures -------------------------- */

/** One fillable region of a coloring picture. */
export const ColoringRegion = z.object({
  id: z.string().min(1),
  /** SVG path data (`d`) in the 0–100 viewBox. */
  path: z.string().min(1).describe('SVG path data (d attribute) for this region, 0–100 viewBox.'),
  /** Reference color for màu-theo-mẫu mode (omit for free coloring). */
  targetColor: z.string().optional().describe('Expected fill (hex) when coloring by reference.'),
  label: z.string().optional().describe('Accessible name of the region, e.g. "thân cá".'),
});

/**
 * A coloring picture: tappable regions + a decorative outline drawn on top.
 * Authorable content (designer/LLM) — validated before render.
 */
export const ColoringPicture = z
  .object({
    id: z.string().min(1),
    title: z.string().optional().describe('Picture title (display data).'),
    regions: z
      .array(ColoringRegion)
      .min(1)
      .describe('Fillable regions. Region ids must be unique.'),
    /** Outline path drawn above the fills (the "line art"). */
    outline: z.string().optional().describe('SVG path data for the black line art, drawn on top.'),
  })
  .superRefine((pic, ctx) => {
    const seen = new Set<string>();
    for (const r of pic.regions) {
      if (seen.has(r.id))
        ctx.addIssue({
          code: 'custom',
          path: ['regions'],
          message: `duplicate region id "${r.id}"`,
        });
      seen.add(r.id);
    }
  });

export type ColoringRegion = z.infer<typeof ColoringRegion>;
export type ColoringPicture = z.infer<typeof ColoringPicture>;

export function safeParseColoringPicture(data: unknown) {
  return ColoringPicture.safeParse(data);
}

export function coloringPictureJsonSchema(): unknown {
  return z.toJSONSchema(ColoringPicture);
}

/** Score màu-theo-mẫu: correct fills / regions that define a target. 0–1. */
export function coloringScore(picture: ColoringPicture, fills: Record<string, string>): number {
  const targets = picture.regions.filter((r) => r.targetColor);
  if (targets.length === 0) return 0;
  let hit = 0;
  for (const r of targets) {
    if ((fills[r.id] ?? '').toLowerCase() === r.targetColor!.toLowerCase()) hit++;
  }
  return clamp(hit / targets.length, 0, 1);
}

/* --------------------------------- Export ---------------------------------- */

const SVG_OPEN = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`;

/** Serialize freehand strokes to a standalone SVG string (share/save via app). */
export function strokesToSvg(strokes: DrawStroke[], background = '#ffffff'): string {
  const body = strokes
    .map(
      (s) =>
        `<path d="${pointsToSvgPath(s.points)}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join('');
  return `${SVG_OPEN}<rect width="100" height="100" fill="${background}"/>${body}</svg>`;
}

/** Serialize a colored picture (fills + line art) to a standalone SVG string. */
export function coloringToSvg(
  picture: ColoringPicture,
  fills: Record<string, string>,
  background = '#ffffff',
): string {
  const regions = picture.regions
    .map((r) => `<path d="${r.path}" fill="${fills[r.id] ?? 'none'}"/>`)
    .join('');
  const outline = picture.outline
    ? `<path d="${picture.outline}" fill="none" stroke="#12131a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  return `${SVG_OPEN}<rect width="100" height="100" fill="${background}"/>${regions}${outline}</svg>`;
}
