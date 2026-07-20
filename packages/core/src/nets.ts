/**
 * Nets — the flat shapes that fold up into a solid.
 *
 * A net is pure 2D data (grid units, y grows DOWN, like the page) so both the web and
 * the native renderer can draw it with nothing but polygons and circles. Every net says
 * which solid it folds into; `solid: null` means it folds into NOTHING — those are the
 * distractors the books lean on (a 2×3 block of squares looks like a cube net, but it
 * cannot close up).
 */
import type { Solid3DName } from './solid3d';

export type NetPoint = [number, number];
export interface NetCircle {
  cx: number;
  cy: number;
  r: number;
}
export interface NetDef {
  id: string;
  /** The solid this net folds into — or null when it folds into nothing (a distractor). */
  solid: Solid3DName | null;
  polys: NetPoint[][];
  circles?: NetCircle[];
}

/** An axis-aligned rectangle, as a polygon. */
const rect = (x: number, y: number, w: number, h: number): NetPoint[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const sq = (x: number, y: number, s = 1) => rect(x, y, s, s);
/** Equilateral triangle sitting on the segment (x1,y1)–(x2,y2), apex on the `up` side. */
const tri = (x1: number, y1: number, x2: number, y2: number, up: boolean): NetPoint[] => {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const h = (len * Math.sqrt(3)) / 2;
  // normal to the base
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const s = up ? 1 : -1; // y grows DOWN, so "up" subtracts
  return [
    [x1, y1],
    [x2, y2],
    [mx - s * nx * h, my - s * ny * h],
  ];
};
/** Regular n-gon, flat-topped, centred at (cx, cy). */
const ngon = (cx: number, cy: number, r: number, n: number): NetPoint[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)] as NetPoint;
  });
/** A pie sector — how a cone's curved surface unrolls. */
const sector = (cx: number, cy: number, r: number, fromDeg: number, toDeg: number): NetPoint[] => {
  const pts: NetPoint[] = [[cx, cy]];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
  }
  return pts;
};

/** Tetrahedron: one big triangle cut into four by its midpoints. */
function tetraNet(): NetPoint[][] {
  const A: NetPoint = [0, 3];
  const B: NetPoint = [3, 3];
  const C: NetPoint = [1.5, 3 - 2.598];
  const mid = (p: NetPoint, q: NetPoint): NetPoint => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
  const ab = mid(A, B);
  const bc = mid(B, C);
  const ca = mid(C, A);
  return [
    [A, ab, ca],
    [ab, B, bc],
    [ca, bc, C],
    [ab, bc, ca],
  ];
}

export const NET_LIBRARY: Record<string, NetDef> = {
  /* ------------------------------- cube ------------------------------- */
  // 1-4-1: a column of four with a flap either side. The classic.
  'cube-cross': {
    id: 'cube-cross',
    solid: 'cube',
    polys: [sq(1, 0), sq(1, 1), sq(1, 2), sq(1, 3), sq(0, 1), sq(2, 1)],
  },
  // 1-4-1 laid out along a row instead.
  'cube-tee': {
    id: 'cube-tee',
    solid: 'cube',
    polys: [sq(0, 1), sq(1, 1), sq(2, 1), sq(3, 1), sq(1, 0), sq(1, 2)],
  },
  // Six squares, but a 2×3 block cannot close up — the classic trap.
  'cube-block': {
    id: 'cube-block',
    solid: null,
    polys: [sq(0, 0), sq(1, 0), sq(2, 0), sq(0, 1), sq(1, 1), sq(2, 1)],
  },
  // Six in a row: it wraps round after four and overlaps itself.
  'cube-strip': {
    id: 'cube-strip',
    solid: null,
    polys: [sq(0, 0), sq(1, 0), sq(2, 0), sq(3, 0), sq(4, 0), sq(5, 0)],
  },

  /* ------------------------------ cuboid ------------------------------ */
  'cuboid-cross': {
    id: 'cuboid-cross',
    solid: 'cuboid',
    polys: [
      rect(0, 1, 1, 1),
      rect(1, 1, 1.5, 1),
      rect(2.5, 1, 1, 1),
      rect(3.5, 1, 1.5, 1),
      rect(1, 0, 1.5, 1),
      rect(1, 2, 1.5, 1),
    ],
  },

  /* -------------------------- square pyramid -------------------------- */
  'pyramid-net': {
    id: 'pyramid-net',
    solid: 'pyramid',
    polys: [
      sq(1, 1),
      tri(1, 1, 2, 1, true), // top
      tri(1, 2, 2, 2, false), // bottom
      [
        [1, 1],
        [1, 2],
        [1 - 0.87, 1.5],
      ],
      [
        [2, 1],
        [2, 2],
        [2 + 0.87, 1.5],
      ],
    ],
  },

  /* ------------------------ triangular prism -------------------------- */
  'triprism-net': {
    id: 'triprism-net',
    solid: 'triprism',
    polys: [
      rect(0, 1, 1, 1.4),
      rect(1, 1, 1, 1.4),
      rect(2, 1, 1, 1.4),
      tri(1, 1, 2, 1, true),
      tri(1, 2.4, 2, 2.4, false),
    ],
  },

  /* ------------------------ hexagonal prism --------------------------- */
  'hexprism-net': {
    id: 'hexprism-net',
    solid: 'hexprism',
    polys: [
      ...Array.from({ length: 6 }, (_, i) => rect(i, 1.2, 1, 1.2)),
      ngon(1.5, 0.6, 0.6, 6),
      ngon(1.5, 3, 0.6, 6),
    ],
  },

  /* ---------------------------- tetrahedron --------------------------- */
  'tetra-net': { id: 'tetra-net', solid: 'tetrahedron', polys: tetraNet() },

  /* ------------------------------ cylinder ---------------------------- */
  'cylinder-net': {
    id: 'cylinder-net',
    solid: 'cylinder',
    // The side unrolls into a rectangle exactly as long as the rim (2πr).
    polys: [rect(0.5, 1, 3.14, 1.4)],
    circles: [
      { cx: 2.07, cy: 0.5, r: 0.5 },
      { cx: 2.07, cy: 2.9, r: 0.5 },
    ],
  },

  /* -------------------------------- cone ------------------------------ */
  'cone-net': {
    id: 'cone-net',
    solid: 'cone',
    // The curved surface unrolls into a sector; its arc is the base's rim.
    polys: [sector(2.6, 1.6, 1.5, -60, 60)],
    circles: [{ cx: 0.7, cy: 1.6, r: 0.5 }],
  },
};

export const NET_IDS = Object.keys(NET_LIBRARY);

export function getNet(id: string): NetDef | undefined {
  return NET_LIBRARY[id];
}

/** The bounding box of a net — renderers use it to fit the net into their viewBox. */
export function netBounds(net: NetDef): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of net.polys)
    for (const [x, y] of poly) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  for (const c of net.circles ?? []) {
    minX = Math.min(minX, c.cx - c.r);
    minY = Math.min(minY, c.cy - c.r);
    maxX = Math.max(maxX, c.cx + c.r);
    maxY = Math.max(maxY, c.cy + c.r);
  }
  return { minX, minY, maxX, maxY };
}
