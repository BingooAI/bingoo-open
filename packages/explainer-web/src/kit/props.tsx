/**
 * kit/props.tsx — the reusable whiteboard prop library ("kho") (spec §8, FR-C-06).
 *
 * Each prop draws in its own local box [0..w × 0..h] and is a pure function of
 * (size, style, t, seed): the same props compose into many scenes, and several
 * animate INTERNALLY as a function of `t` (sun rays shimmer, water ripples,
 * bird flaps, star twinkles) — deterministic and seekable like everything else.
 *
 * Ground-anchored props (tree, mountain, house…) draw their base at y=h so the
 * layout's ground placement lands them exactly on the horizon.
 */
import * as React from 'react';

export type PropCtx = {
  w: number;
  h: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  t: number; // scene-local time for internal animation
  seed: number;
  draw?: number; // drawProgress (undefined = fully drawn)
  fillOpacity: number;
};

type Prop = (c: PropCtx) => React.ReactNode;

function dash(draw?: number) {
  return draw !== undefined
    ? { pathLength: 1, strokeDasharray: 1, strokeDashoffset: 1 - draw }
    : {};
}
const base = (c: PropCtx) => ({
  stroke: c.stroke,
  strokeWidth: c.strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

/* ------------------------------------------------------------------- sky */

const sun: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.3;
  const spin = c.t * 6; // slow ray rotation
  const pulse = 1 + Math.sin(c.t * 1.6 + c.seed) * 0.06;
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + (spin * Math.PI) / 180;
    const r0 = r * 1.35;
    const r1 = r * (1.7 + (i % 2 === 0 ? 0.12 : 0)) * pulse;
    return (
      <line
        key={i}
        x1={cx + Math.cos(a) * r0}
        y1={cy + Math.sin(a) * r0}
        x2={cx + Math.cos(a) * r1}
        y2={cy + Math.sin(a) * r1}
        {...base(c)}
      />
    );
  });
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
        {...dash(c.draw)}
      />
      {rays}
    </g>
  );
};

const moon: Prop = (c) => {
  const { w, h } = c;
  const r = Math.min(w, h) * 0.36;
  return (
    <g>
      <circle cx={w / 2} cy={h / 2} r={r} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} />
      <circle
        cx={w / 2 + r * 0.35}
        cy={h / 2 - r * 0.15}
        r={r * 0.85}
        fill={'#f7f2e9'}
        stroke="none"
      />
    </g>
  );
};

const cloud: Prop = (c) => {
  const { w, h } = c;
  // puffy cloud from stacked arcs; gentle internal bob per puff
  const bob = Math.sin(c.t * 1.1 + c.seed) * h * 0.02;
  const d = `M ${w * 0.16} ${h * 0.72}
    C ${w * 0.02} ${h * 0.72}, ${w * 0.02} ${h * 0.42}, ${w * 0.2} ${h * 0.42}
    C ${w * 0.22} ${h * 0.2}, ${w * 0.5} ${h * 0.16}, ${w * 0.56} ${h * 0.38}
    C ${w * 0.7} ${h * 0.24}, ${w * 0.92} ${h * 0.32}, ${w * 0.86} ${h * 0.54}
    C ${w * 0.99} ${h * 0.56}, ${w * 0.98} ${h * 0.72}, ${w * 0.84} ${h * 0.72} Z`;
  return (
    <g transform={`translate(0 ${bob})`}>
      <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />
    </g>
  );
};

const raincloud: Prop = (c) => {
  const { w, h } = c;
  const rain = Array.from({ length: 5 }, (_, i) => {
    const x = w * (0.28 + i * 0.12);
    const p = (c.t * 1.6 + i * 0.3) % 1;
    const y0 = h * 0.72 + p * h * 0.2;
    return (
      <line
        key={i}
        x1={x}
        y1={y0}
        x2={x - w * 0.02}
        y2={y0 + h * 0.12}
        {...base(c)}
        opacity={0.8}
      />
    );
  });
  return (
    <g>
      {cloud({ ...c, h: h * 0.72 })}
      {rain}
    </g>
  );
};

const star: Prop = (c) => {
  const { w, h } = c;
  const r = Math.min(w, h) * 0.42;
  const cx = w / 2;
  const cy = h / 2;
  const tw = 0.6 + 0.4 * Math.abs(Math.sin(c.t * 2 + c.seed));
  const pts = Array.from({ length: 10 }, (_, i) => {
    const rad = i % 2 === 0 ? r : r * 0.42;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return `${cx + Math.cos(a) * rad},${cy + Math.sin(a) * rad}`;
  }).join(' ');
  return <polygon points={pts} fill={c.fill} fillOpacity={c.fillOpacity * tw} {...base(c)} />;
};

const bird: Prop = (c) => {
  const { w, h } = c;
  const flap = Math.sin(c.t * 5 + c.seed) * h * 0.14;
  const cx = w / 2;
  const cy = h / 2;
  const wing = w * 0.34;
  return (
    <path
      d={`M ${cx - wing} ${cy + flap} Q ${cx - wing * 0.35} ${cy - h * 0.14} ${cx} ${cy}
          Q ${cx + wing * 0.35} ${cy - h * 0.14} ${cx + wing} ${cy + flap}`}
      fill="none"
      {...base(c)}
    />
  );
};

const vapor: Prop = (c) => {
  const { w, h } = c;
  const d = `M ${w * 0.5} ${h * 0.94}
    C ${w * 0.16} ${h * 0.78}, ${w * 0.84} ${h * 0.58}, ${w * 0.5} ${h * 0.42}
    C ${w * 0.18} ${h * 0.26}, ${w * 0.82} ${h * 0.2}, ${w * 0.5} ${h * 0.08}`;
  const ah = Math.min(w, h) * 0.1;
  const headOp = c.draw !== undefined ? Math.max(0, (c.draw - 0.8) / 0.2) : 1;
  return (
    <g>
      <path d={d} fill="none" {...base(c)} {...dash(c.draw)} />
      <path
        d={`M ${w * 0.5 - ah} ${h * 0.08 + ah} L ${w * 0.5} ${h * 0.06} L ${w * 0.5 + ah} ${h * 0.08 + ah}`}
        fill="none"
        {...base(c)}
        opacity={headOp}
      />
    </g>
  );
};

const droplet: Prop = (c) => {
  const { w, h } = c;
  const d = `M ${w * 0.5} ${h * 0.1}
    C ${w * 0.9} ${h * 0.5}, ${w * 0.78} ${h * 0.9}, ${w * 0.5} ${h * 0.9}
    C ${w * 0.22} ${h * 0.9}, ${w * 0.1} ${h * 0.5}, ${w * 0.5} ${h * 0.1} Z`;
  return <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />;
};

/* ---------------------------------------------------------------- ground */

// shared: rippling water body used by lake & puddle
function water(c: PropCtx, topFrac: number) {
  const { w, h } = c;
  const yTop = h * topFrac;
  const d = `M ${w * 0.03} ${yTop}
    C ${w * 0.18} ${yTop - h * 0.06}, ${w * 0.33} ${yTop + h * 0.06}, ${w * 0.5} ${yTop}
    C ${w * 0.67} ${yTop - h * 0.06}, ${w * 0.82} ${yTop + h * 0.06}, ${w * 0.97} ${yTop}
    C ${w * 1.02} ${h * 0.94}, ${w * 0.7} ${h}, ${w * 0.5} ${h}
    C ${w * 0.3} ${h}, ${w * -0.02} ${h * 0.94}, ${w * 0.03} ${yTop} Z`;
  const rip = (yf: number, xf: number, ph: number) => {
    const shift = Math.sin(c.t * 1.5 + ph) * w * 0.03;
    return (
      <path
        d={`M ${w * xf + shift} ${h * yf} q ${w * 0.06} ${h * 0.05} ${w * 0.12} 0`}
        stroke={c.stroke}
        strokeWidth={c.strokeWidth * 0.5}
        fill="none"
        strokeLinecap="round"
        opacity={0.5 * c.fillOpacity}
      />
    );
  };
  return (
    <g>
      <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />
      {rip(topFrac + 0.22, 0.2, c.seed)}
      {rip(topFrac + 0.34, 0.56, c.seed + 2)}
    </g>
  );
}
const puddle: Prop = (c) => water(c, 0.42);
const lake: Prop = (c) => water(c, 0.3);

const mountain: Prop = (c) => {
  const { w, h } = c;
  const d = `M 0 ${h}
    L ${w * 0.28} ${h * 0.22} L ${w * 0.42} ${h * 0.52} L ${w * 0.58} ${h * 0.1}
    L ${w} ${h} Z`;
  const snow = `M ${w * 0.22} ${h * 0.34} L ${w * 0.28} ${h * 0.22} L ${w * 0.34} ${h * 0.34}
    M ${w * 0.5} ${h * 0.26} L ${w * 0.58} ${h * 0.1} L ${w * 0.66} ${h * 0.28}`;
  return (
    <g>
      <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />
      <path
        d={snow}
        fill="none"
        stroke={c.stroke}
        strokeWidth={c.strokeWidth * 0.7}
        opacity={0.7 * c.fillOpacity}
      />
    </g>
  );
};

const hill: Prop = (c) => {
  const { w, h } = c;
  const d = `M 0 ${h} Q ${w * 0.5} ${-h * 0.15} ${w} ${h} Z`;
  return <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />;
};

const tree: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  const trunkTop = h * 0.5;
  return (
    <g>
      <path
        d={`M ${cx} ${h} L ${cx} ${trunkTop}`}
        fill="none"
        {...base(c)}
        strokeWidth={c.strokeWidth * 1.4}
      />
      <ellipse
        cx={cx}
        cy={h * 0.34}
        rx={w * 0.42}
        ry={h * 0.34}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
        {...dash(c.draw)}
      />
    </g>
  );
};

const pine: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  const tri = (yTop: number, yBot: number, halfW: number) =>
    `M ${cx} ${yTop} L ${cx - halfW} ${yBot} L ${cx + halfW} ${yBot} Z`;
  return (
    <g>
      <path
        d={`M ${cx} ${h} L ${cx} ${h * 0.82}`}
        fill="none"
        {...base(c)}
        strokeWidth={c.strokeWidth * 1.3}
      />
      <path
        d={tri(h * 0.06, h * 0.44, w * 0.34)}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
        {...dash(c.draw)}
      />
      <path
        d={tri(h * 0.3, h * 0.66, w * 0.42)}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
      />
      <path
        d={tri(h * 0.54, h * 0.86, w * 0.5)}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
      />
    </g>
  );
};

const bush: Prop = (c) => {
  const { w, h } = c;
  const d = `M ${w * 0.1} ${h}
    C ${w * 0.0} ${h * 0.5}, ${w * 0.25} ${h * 0.35}, ${w * 0.38} ${h * 0.55}
    C ${w * 0.44} ${h * 0.25}, ${w * 0.7} ${h * 0.3}, ${w * 0.68} ${h * 0.58}
    C ${w * 0.86} ${h * 0.42}, ${w} ${h * 0.6}, ${w * 0.9} ${h} Z`;
  return <path d={d} fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)} {...dash(c.draw)} />;
};

const flower: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  const headY = h * 0.24;
  const petals = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return (
      <ellipse
        key={i}
        cx={cx + Math.cos(a) * w * 0.24}
        cy={headY + Math.sin(a) * w * 0.24}
        rx={w * 0.16}
        ry={w * 0.1}
        transform={`rotate(${(a * 180) / Math.PI} ${cx + Math.cos(a) * w * 0.24} ${headY + Math.sin(a) * w * 0.24})`}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        stroke={c.stroke}
        strokeWidth={c.strokeWidth * 0.6}
      />
    );
  });
  return (
    <g>
      <path
        d={`M ${cx} ${h} L ${cx} ${headY}`}
        fill="none"
        stroke={c.stroke}
        strokeWidth={c.strokeWidth * 0.9}
        strokeLinecap="round"
      />
      {petals}
      <circle cx={cx} cy={headY} r={w * 0.12} fill={c.stroke} />
    </g>
  );
};

const grass: Prop = (c) => {
  const { w, h } = c;
  const blades = Array.from({ length: 5 }, (_, i) => {
    const x = w * (0.12 + i * 0.19);
    const sway = Math.sin(c.t * 1.6 + i + c.seed) * w * 0.05;
    return (
      <path
        key={i}
        d={`M ${x} ${h} Q ${x + sway} ${h * 0.4} ${x + sway * 1.6} ${h * 0.08}`}
        fill="none"
        {...base(c)}
      />
    );
  });
  return <g>{blades}</g>;
};

const house: Prop = (c) => {
  const { w, h } = c;
  return (
    <g>
      <rect
        x={w * 0.16}
        y={h * 0.44}
        width={w * 0.68}
        height={h * 0.56}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
        {...dash(c.draw)}
      />
      <path
        d={`M ${w * 0.1} ${h * 0.46} L ${w * 0.5} ${h * 0.08} L ${w * 0.9} ${h * 0.46} Z`}
        fill={c.fill}
        fillOpacity={c.fillOpacity}
        {...base(c)}
      />
      <rect x={w * 0.42} y={h * 0.64} width={w * 0.18} height={h * 0.36} fill="none" {...base(c)} />
    </g>
  );
};

/* --------------------------------------------------------------- generic */

const thermometer: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  // mercury rises with heat over time
  const level = 0.3 + 0.5 * Math.min(1, c.t / 4);
  return (
    <g>
      <rect
        x={cx - w * 0.14}
        y={h * 0.06}
        width={w * 0.28}
        height={h * 0.72}
        rx={w * 0.14}
        fill="#fff"
        {...base(c)}
      />
      <rect
        x={cx - w * 0.07}
        y={h * (0.78 - level * 0.66)}
        width={w * 0.14}
        height={h * level * 0.66}
        rx={w * 0.07}
        fill={c.stroke}
        stroke="none"
      />
      <circle cx={cx} cy={h * 0.86} r={w * 0.22} fill={c.stroke} {...base(c)} />
    </g>
  );
};

const box: Prop = (c) => (
  <rect
    x={c.w * 0.04}
    y={c.h * 0.06}
    width={c.w * 0.92}
    height={c.h * 0.88}
    rx={Math.min(c.w, c.h) * 0.1}
    fill={c.fill}
    fillOpacity={c.fillOpacity}
    {...base(c)}
    {...dash(c.draw)}
  />
);
const circle: Prop = (c) => (
  <circle
    cx={c.w / 2}
    cy={c.h / 2}
    r={Math.min(c.w, c.h) * 0.42}
    fill={c.fill}
    fillOpacity={c.fillOpacity}
    {...base(c)}
    {...dash(c.draw)}
  />
);
const arrow: Prop = (c) => {
  const { w, h } = c;
  const cy = h / 2;
  return (
    <path
      d={`M ${w * 0.12} ${cy} L ${w * 0.82} ${cy} M ${w * 0.66} ${cy - h * 0.22} L ${w * 0.86} ${cy} L ${w * 0.66} ${cy + h * 0.22}`}
      fill="none"
      {...base(c)}
      {...dash(c.draw)}
    />
  );
};
const arrowUp: Prop = (c) => {
  const { w, h } = c;
  const cx = w / 2;
  return (
    <path
      d={`M ${cx} ${h * 0.88} L ${cx} ${h * 0.14} M ${cx - w * 0.28} ${h * 0.4} L ${cx} ${h * 0.14} L ${cx + w * 0.28} ${h * 0.4}`}
      fill="none"
      {...base(c)}
      {...dash(c.draw)}
    />
  );
};
const wave: Prop = (c) => {
  const { w, h } = c;
  const y = h * 0.5;
  const d = `M ${w * 0.04} ${y} q ${w * 0.12} -${h * 0.4} ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0 t ${w * 0.24} 0`;
  return <path d={d} fill="none" {...base(c)} {...dash(c.draw)} />;
};

// flowchart blocks
const diamond: Prop = (c) => (
  <polygon
    points={`${c.w / 2},${c.h * 0.08} ${c.w * 0.92},${c.h / 2} ${c.w / 2},${c.h * 0.92} ${c.w * 0.08},${c.h / 2}`}
    fill={c.fill}
    fillOpacity={c.fillOpacity}
    {...base(c)}
    {...dash(c.draw)}
  />
);
const pill: Prop = (c) => (
  <rect
    x={c.w * 0.04}
    y={c.h * 0.14}
    width={c.w * 0.92}
    height={c.h * 0.72}
    rx={c.h * 0.36}
    fill={c.fill}
    fillOpacity={c.fillOpacity}
    {...base(c)}
    {...dash(c.draw)}
  />
);
const parallelogram: Prop = (c) => {
  const s = c.w * 0.18;
  return (
    <polygon
      points={`${s},${c.h * 0.15} ${c.w * 0.95},${c.h * 0.15} ${c.w * 0.95 - s},${c.h * 0.85} ${c.w * 0.05},${c.h * 0.85}`}
      fill={c.fill}
      fillOpacity={c.fillOpacity}
      {...base(c)}
      {...dash(c.draw)}
    />
  );
};
const hexagon: Prop = (c) => (
  <polygon
    points={`${c.w * 0.22},${c.h * 0.14} ${c.w * 0.78},${c.h * 0.14} ${c.w * 0.97},${c.h / 2} ${c.w * 0.78},${c.h * 0.86} ${c.w * 0.22},${c.h * 0.86} ${c.w * 0.03},${c.h / 2}`}
    fill={c.fill}
    fillOpacity={c.fillOpacity}
    {...base(c)}
    {...dash(c.draw)}
  />
);
const cylinder: Prop = (c) => {
  const x = c.w * 0.14,
    ww = c.w * 0.72,
    top = c.h * 0.16,
    bot = c.h * 0.84,
    ry = c.h * 0.11;
  return (
    <g fill={c.fill} fillOpacity={c.fillOpacity} {...base(c)}>
      <path
        d={`M ${x} ${top} L ${x} ${bot} A ${ww / 2} ${ry} 0 0 0 ${x + ww} ${bot} L ${x + ww} ${top}`}
      />
      <ellipse cx={x + ww / 2} cy={top} rx={ww / 2} ry={ry} />
    </g>
  );
};

export const PROPS: Record<string, Prop> = {
  sun,
  sunNoon: sun,
  moon,
  cloud,
  raincloud,
  star,
  bird,
  vapor,
  droplet,
  puddle,
  lake,
  mountain,
  hill,
  tree,
  pine,
  bush,
  flower,
  grass,
  house,
  thermometer,
  box,
  rect: box,
  circle,
  arrow,
  arrowUp,
  wave,
  diamond,
  pill,
  parallelogram,
  hexagon,
  cylinder,
};

/* --- imported SVG art (auto-cropped, normalized, recolored to currentColor) --- */
import { SVG_ASSETS, type SvgAsset } from './svgAssets';

function svgProp(a: SvgAsset): Prop {
  return (c) => (
    <g
      transform={`scale(${c.w / a.viewW} ${c.h / 100})`}
      style={{ color: c.stroke }}
      dangerouslySetInnerHTML={{ __html: a.markup }}
    />
  );
}
for (const [id, a] of Object.entries(SVG_ASSETS)) PROPS[id] = svgProp(a);

export function getProp(shape: string | undefined): Prop {
  return (shape && PROPS[shape]) || box;
}
