/**
 * Backdrop.tsx — the layer BEHIND the lesson.
 *
 * A scene rendered on bare cream reads as unfinished, and the instinct to fill
 * the void by scattering a sun and a tree as loose elements is exactly wrong:
 * they carry no teaching job, so they read as random ("why is there suddenly a
 * sun?"). Scenery is ATMOSPHERE — it belongs behind everything, where it frames
 * the content instead of competing with it.
 *
 * Three ways to get one:
 *   • `src` / `srcPortrait` — framed art from the media library. Its `inset`
 *     declares the usable inner panel and the LAYOUT ENGINE confines every slot
 *     to it, so content can never land on the painted foliage.
 *   • `kind: "gradient"` — `from` → `to` (theme token ids or hex) at `angle`.
 *     Cheap, weightless, and it never fights the content for attention.
 *   • any other `kind` — a built-in drawn in SVG from theme tokens.
 *
 * `panel` picks the mode: a card floating ON the backdrop, or the lesson set
 * DIRECTLY on it, full-bleed. That choice runs through `insetOf()` in the engine,
 * so it reflows the layout — it is not a paint job over a fixed composition.
 */
import * as React from 'react';
import type { Background, ThemeTokens, Aspect, Rect } from '@bingoo/explainer';
import { resolveColor } from '../theme/tokens';

/**
 * ONE colour path. `resolveColor` maps a token to `var(--foreground, #2b2724)`,
 * so the lesson follows the app's light/dark theme. This file used to read the
 * doc's raw hex instead — so in dark mode the ELEMENTS turned near-white (via
 * the CSS var) while the PAPER stayed cream (via the hex), and the whole lesson
 * rendered white-on-cream: invisible. The two systems must never disagree.
 */
const c = (theme: ThemeTokens, id: string | undefined, fb: string) =>
  id ? resolveColor(theme, id, id) : fb;

export function Backdrop({
  bg,
  theme,
  aspect,
  canvas,
  frame,
}: {
  bg: Background | null;
  theme: ThemeTokens;
  aspect: Aspect;
  canvas: { w: number; h: number };
  frame: Rect;
}) {
  // A page shows many Stages at once; a hard-coded <defs> id would make every
  // SVG on the page share (and clobber) one gradient. useId keeps them distinct.
  const uid = React.useId().replace(/:/g, '');
  const paper = c(theme, 'paper', '#f7f2e9');
  const kind = bg?.kind ?? 'paper';
  const src = aspect === '9:16' ? (bg?.srcPortrait ?? bg?.src) : bg?.src;
  const wantsPanel = bg?.panel ?? !src; // framed art already contains its panel

  // the card = the frame, grown back out by the safe gutter (and nothing more)
  const g = Math.min(frame.w, frame.h) * 0.03;
  const pad = { x: frame.x - g, y: frame.y - g, w: frame.w + 2 * g, h: frame.h + 2 * g };

  return (
    <g aria-hidden>
      <rect x={0} y={0} width={canvas.w} height={canvas.h} fill={paper} />

      {src ? (
        <image
          href={src}
          x={0}
          y={0}
          width={canvas.w}
          height={canvas.h}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : kind === 'gradient' ? (
        <Gradient bg={bg!} theme={theme} canvas={canvas} uid={uid} />
      ) : kind === 'meadow' ? (
        <Meadow theme={theme} canvas={canvas} />
      ) : kind === 'sky' ? (
        <Sky theme={theme} canvas={canvas} uid={uid} />
      ) : kind === 'grid' ? (
        <GridPaper theme={theme} canvas={canvas} />
      ) : null}

      {wantsPanel && kind !== 'none' ? (
        // The card sits ON the scenery — it must NOT swallow it. Its bounds are
        // the frame plus the safe gutter the layout already reserved, and no
        // more; the backdrop stays visible all the way round.
        <rect
          x={pad.x}
          y={pad.y}
          width={pad.w}
          height={pad.h}
          rx={Math.min(pad.w, pad.h) * 0.045}
          fill={c(theme, 'cloudFill', '#fffdf8')}
          stroke={c(theme, 'faint', '#e5ddd0')}
          strokeWidth={2}
          opacity={0.97}
        />
      ) : null}
    </g>
  );
}

/* ------------------------------------------------------------------ built-ins */

/** `angle` in degrees, 0 = top→bottom, 90 = left→right. */
function Gradient({
  bg,
  theme,
  canvas,
  uid,
}: {
  bg: Background;
  theme: ThemeTokens;
  canvas: { w: number; h: number };
  uid: string;
}) {
  const rad = ((bg.angle ?? 0) - 90) * (Math.PI / 180);
  const x1 = 0.5 - Math.cos(rad) / 2;
  const y1 = 0.5 - Math.sin(rad) / 2;
  const x2 = 0.5 + Math.cos(rad) / 2;
  const y2 = 0.5 + Math.sin(rad) / 2;
  const id = `expl-grad-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0%" stopColor={c(theme, bg.from, '#e8f0f7')} />
          <stop offset="100%" stopColor={c(theme, bg.to, '#f7f2e9')} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={canvas.w} height={canvas.h} fill={`url(#${id})`} />
    </>
  );
}

function Meadow({ theme, canvas }: { theme: ThemeTokens; canvas: { w: number; h: number } }) {
  const { w, h } = canvas;
  const gy = h * 0.78;
  return (
    <>
      <rect x={0} y={0} width={w} height={gy} fill={c(theme, 'cloudFill', '#f2f8ee')} />
      <path
        d={`M0 ${gy} Q ${w * 0.25} ${gy - h * 0.05} ${w * 0.5} ${gy} T ${w} ${gy} L ${w} ${h} L 0 ${h} Z`}
        fill={c(theme, 'leaf', '#bcd9a6')}
      />
      <path
        d={`M0 ${h * 0.93} Q ${w * 0.4} ${h * 0.88} ${w} ${h * 0.94} L ${w} ${h} L 0 ${h} Z`}
        fill={c(theme, 'leafDeep', '#6fae5a')}
        opacity={0.5}
      />
    </>
  );
}

function Sky({
  theme,
  canvas,
  uid,
}: {
  theme: ThemeTokens;
  canvas: { w: number; h: number };
  uid: string;
}) {
  const { w, h } = canvas;
  const id = `expl-sky-${uid}`;
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c(theme, 'accent2', '#3f83bf')} stopOpacity={0.18} />
          <stop offset="100%" stopColor={c(theme, 'paper', '#f7f2e9')} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill={`url(#${id})`} />
    </>
  );
}

function GridPaper({ theme, canvas }: { theme: ThemeTokens; canvas: { w: number; h: number } }) {
  const { w, h } = canvas;
  const step = 50;
  const stroke = c(theme, 'faint', '#d8cfc2');
  const lines: React.ReactElement[] = [];
  for (let x = step; x < w; x += step)
    lines.push(
      <line
        key={`v${x}`}
        x1={x}
        y1={0}
        x2={x}
        y2={h}
        stroke={stroke}
        strokeWidth={1}
        opacity={0.35}
      />,
    );
  for (let y = step; y < h; y += step)
    lines.push(
      <line
        key={`h${y}`}
        x1={0}
        y1={y}
        x2={w}
        y2={y}
        stroke={stroke}
        strokeWidth={1}
        opacity={0.35}
      />,
    );
  return <>{lines}</>;
}
