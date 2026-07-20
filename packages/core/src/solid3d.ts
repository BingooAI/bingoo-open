// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * A tiny 3D engine for the geometry primitives — pure TS, no dependency, so the
 * SAME geometry drives web (SVG) and native (react-native-svg).
 *
 * Beyond drawing, it models the solid's TOPOLOGY the way a textbook does, so a
 * learner can tap a part and be told what it is, and can COUNT parts:
 *
 *   - a `face` is a FLAT face (a cube has 6)
 *   - a `curved` surface is the curved skin of a cylinder/cone/sphere — it is
 *     tessellated into many triangles for drawing, but it is ONE surface, and it
 *     is NOT counted as a face (the textbook's rule)
 *   - an `edge` may be a straight segment (cube) or a whole circle (cylinder rim)
 *   - a `vertex` is a real corner (a cylinder has none; a cone has one apex)
 *
 * Back faces are culled (exact for convex solids), and hidden edges/vertices are
 * flagged so they can be drawn dashed — again, just like the books.
 */

export type Vec3 = [number, number, number]
export const SOLID_NAMES = [
  'cube',
  'cuboid',
  'cylinder',
  'sphere',
  'cone',
  'pyramid',
  'triprism',
  'hexprism',
  'tetrahedron',
] as const
export type Solid3DName = (typeof SOLID_NAMES)[number]
export type SolidPartKind = 'face' | 'curved' | 'edge' | 'vertex'

export interface SolidSurface {
  id: string
  kind: 'face' | 'curved'
}
export interface SolidEdge {
  id: string
  /** Mesh vertex-index pairs. A straight edge has 1; a circular rim has many. */
  segs: Array<[number, number]>
}
export interface SolidCorner {
  id: string
  /** Mesh vertex index. */
  index: number
}

export interface Solid3D {
  vertices: Vec3[]
  /** Mesh faces (tessellated). Winding is normalised to face OUTWARD. */
  faces: number[][]
  /** Which logical surface each mesh face belongs to (same length as `faces`). */
  faceSurface: string[]
  /** Logical surfaces — flat faces + curved skins. */
  surfaces: SolidSurface[]
  /** Logical edges. */
  edges: SolidEdge[]
  /** Logical (real) corners. */
  corners: SolidCorner[]
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const norm = (a: Vec3): Vec3 => {
  const L = Math.hypot(a[0], a[1], a[2]) || 1
  return [a[0] / L, a[1] / L, a[2] / L]
}

function faceNormal(verts: Vec3[], face: number[]): Vec3 {
  const a = verts[face[0]!]!
  const b = verts[face[1]!]!
  const c = verts[face[2]!]!
  return norm(cross(sub(b, a), sub(c, b)))
}
function faceCentroid(verts: Vec3[], face: number[]): Vec3 {
  const s: Vec3 = [0, 0, 0]
  for (const i of face) {
    const v = verts[i]!
    s[0] += v[0]
    s[1] += v[1]
    s[2] += v[2]
  }
  return [s[0] / face.length, s[1] / face.length, s[2] / face.length]
}

/** Wind every face so its normal points OUTWARD (valid: convex, origin-centred). */
function fixWinding(vertices: Vec3[], faces: number[][]) {
  for (const face of faces)
    if (dot(faceNormal(vertices, face), faceCentroid(vertices, face)) < 0) face.reverse()
}

function ring(n: number, y: number, r = 1): Vec3[] {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * 2 * Math.PI
    return [r * Math.cos(t), y, r * Math.sin(t)] as Vec3
  })
}
/** All edges of a polyhedron: each unique vertex pair shared by its faces. */
function polyhedronEdges(faces: number[][]): SolidEdge[] {
  const seen = new Set<string>()
  const out: SolidEdge[] = []
  for (const f of faces)
    for (let k = 0; k < f.length; k++) {
      const a = f[k]!
      const b = f[(k + 1) % f.length]!
      const key = a < b ? `${a}_${b}` : `${b}_${a}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ id: `e${key}`, segs: [[a, b]] })
    }
  return out
}
/** A closed rim through consecutive vertices [start .. start+n-1]. */
function rimEdge(id: string, start: number, n: number): SolidEdge {
  return {
    id,
    segs: Array.from({ length: n }, (_, i) => [start + i, start + ((i + 1) % n)] as [number, number]),
  }
}

/** Solids whose mesh IS their true geometry — only these can be counted part-by-part. */
export function isPolyhedron(name: Solid3DName): boolean {
  return (
    name === 'cube' ||
    name === 'cuboid' ||
    name === 'pyramid' ||
    name === 'triprism' ||
    name === 'hexprism' ||
    name === 'tetrahedron'
  )
}

/** A prism with an n-sided regular base: 2 end faces + n side faces. */
function makePrism(n: number): Solid3D {
  const vertices: Vec3[] = [...ring(n, 1), ...ring(n, -1)]
  const faces: number[][] = [
    Array.from({ length: n }, (_, i) => i), // top
    Array.from({ length: n }, (_, i) => n + i), // bottom
  ]
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    faces.push([i, j, n + j, n + i]) // each side is a REAL flat face here
  }
  fixWinding(vertices, faces)
  return {
    vertices,
    faces,
    faceSurface: faces.map((_, i) => `f${i}`),
    surfaces: faces.map((_, i) => ({ id: `f${i}`, kind: 'face' as const })),
    edges: polyhedronEdges(faces),
    corners: vertices.map((_, i) => ({ id: `v${i}`, index: i })),
  }
}

/** Build a solid: mesh + textbook topology. */
export function makeSolid(name: Solid3DName, segments = 24): Solid3D {
  switch (name) {
    case 'cube':
    case 'cuboid': {
      const x = name === 'cube' ? 1 : 1.5
      const vertices: Vec3[] = [
        [-x, -1, -1],
        [x, -1, -1],
        [x, 1, -1],
        [-x, 1, -1],
        [-x, -1, 1],
        [x, -1, 1],
        [x, 1, 1],
        [-x, 1, 1],
      ]
      const faces = [
        [4, 5, 6, 7],
        [1, 0, 3, 2],
        [5, 1, 2, 6],
        [0, 4, 7, 3],
        [7, 6, 2, 3],
        [0, 1, 5, 4],
      ]
      fixWinding(vertices, faces)
      const surfaces: SolidSurface[] = faces.map((_, i) => ({ id: `f${i}`, kind: 'face' }))
      return {
        vertices,
        faces,
        faceSurface: surfaces.map((s) => s.id),
        surfaces,
        edges: polyhedronEdges(faces),
        corners: vertices.map((_, i) => ({ id: `v${i}`, index: i })),
      }
    }
    case 'pyramid': {
      const vertices: Vec3[] = [
        [-1, -1, -1],
        [1, -1, -1],
        [1, -1, 1],
        [-1, -1, 1],
        [0, 1.3, 0],
      ]
      const faces = [
        [0, 1, 2, 3],
        [3, 2, 4],
        [2, 1, 4],
        [1, 0, 4],
        [0, 3, 4],
      ]
      fixWinding(vertices, faces)
      const surfaces: SolidSurface[] = faces.map((_, i) => ({ id: `f${i}`, kind: 'face' }))
      return {
        vertices,
        faces,
        faceSurface: surfaces.map((s) => s.id),
        surfaces,
        edges: polyhedronEdges(faces),
        corners: vertices.map((_, i) => ({ id: `v${i}`, index: i })),
      }
    }
    case 'cylinder': {
      const n = segments
      const vertices: Vec3[] = [...ring(n, 1), ...ring(n, -1)]
      const faces: number[][] = [
        Array.from({ length: n }, (_, i) => i), // top cap
        Array.from({ length: n }, (_, i) => n + i), // bottom cap
      ]
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n
        faces.push([i, j, n + j, n + i]) // side quads → ONE curved surface
      }
      fixWinding(vertices, faces)
      const faceSurface = ['f0', 'f1', ...Array.from({ length: n }, () => 'c0')]
      return {
        vertices,
        faces,
        faceSurface,
        surfaces: [
          { id: 'f0', kind: 'face' },
          { id: 'f1', kind: 'face' },
          { id: 'c0', kind: 'curved' },
        ],
        edges: [rimEdge('e0', 0, n), rimEdge('e1', n, n)],
        corners: [],
      }
    }
    case 'cone': {
      const n = segments
      const vertices: Vec3[] = [...ring(n, -1), [0, 1.3, 0]]
      const apex = n
      const faces: number[][] = [Array.from({ length: n }, (_, i) => i)] // base
      for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, apex]) // curved skin
      fixWinding(vertices, faces)
      return {
        vertices,
        faces,
        faceSurface: ['f0', ...Array.from({ length: n }, () => 'c0')],
        surfaces: [
          { id: 'f0', kind: 'face' },
          { id: 'c0', kind: 'curved' },
        ],
        edges: [rimEdge('e0', 0, n)],
        corners: [{ id: 'v0', index: apex }],
      }
    }
    case 'triprism':
      return makePrism(3)
    case 'hexprism':
      return makePrism(6)
    case 'tetrahedron': {
      const k = 1.15
      const vertices: Vec3[] = [
        [k, k, k],
        [k, -k, -k],
        [-k, k, -k],
        [-k, -k, k],
      ]
      const faces = [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
        [1, 3, 2],
      ]
      fixWinding(vertices, faces)
      return {
        vertices,
        faces,
        faceSurface: faces.map((_, i) => `f${i}`),
        surfaces: faces.map((_, i) => ({ id: `f${i}`, kind: 'face' as const })),
        edges: polyhedronEdges(faces),
        corners: vertices.map((_, i) => ({ id: `v${i}`, index: i })),
      }
    }
    case 'sphere': {
      const slices = segments
      const stacks = Math.max(6, Math.round(segments / 2))
      const vertices: Vec3[] = []
      for (let j = 0; j <= stacks; j++) {
        const phi = (j / stacks) * Math.PI
        for (let i = 0; i < slices; i++) {
          const theta = (i / slices) * 2 * Math.PI
          vertices.push([Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)])
        }
      }
      const idx = (j: number, i: number) => j * slices + (i % slices)
      const faces: number[][] = []
      for (let j = 0; j < stacks; j++)
        for (let i = 0; i < slices; i++)
          faces.push([idx(j, i), idx(j, i + 1), idx(j + 1, i + 1), idx(j + 1, i)])
      fixWinding(vertices, faces)
      return {
        vertices,
        faces,
        faceSurface: faces.map(() => 'c0'),
        surfaces: [{ id: 'c0', kind: 'curved' }],
        edges: [],
        corners: [],
      }
    }
  }
}

/** Rotate a point: yaw (around Y) then pitch (around X). Degrees. */
export function rotateVec(v: Vec3, pitchDeg: number, yawDeg: number): Vec3 {
  const a = (pitchDeg * Math.PI) / 180
  const b = (yawDeg * Math.PI) / 180
  const [x, y, z] = v
  const x1 = x * Math.cos(b) + z * Math.sin(b)
  const z1 = -x * Math.sin(b) + z * Math.cos(b)
  const y2 = y * Math.cos(a) - z1 * Math.sin(a)
  const z2 = y * Math.sin(a) + z1 * Math.cos(a)
  return [x1, y2, z2]
}

export interface ProjectedFace {
  /** The logical surface this polygon belongs to (tap target). */
  surfaceId: string
  kind: 'face' | 'curved'
  /** "x,y x,y …" for an SVG <polygon points>. */
  points: string
  /** 0.45 → 1 lighting factor. */
  shade: number
}
export interface ProjectedEdge {
  id: string
  /** false = every segment is behind the solid (whole edge hidden). */
  visible: boolean
  /** Per-segment: a circular rim is half visible, half hidden → dash per segment. */
  segs: Array<{ x1: number; y1: number; x2: number; y2: number; visible: boolean }>
}
export interface ProjectedCorner {
  id: string
  x: number
  y: number
  visible: boolean
}
export interface SolidProjection {
  faces: ProjectedFace[]
  edges: ProjectedEdge[]
  corners: ProjectedCorner[]
}

const LIGHT = norm([0.4, 0.6, 1])

/**
 * Rotate + project a solid. Back-facing polygons are culled; edges and corners
 * carry a `visible` flag (false when every face touching them faces away), so the
 * UI can draw hidden ones dashed and decide what is tappable.
 */
export function projectSolid(
  solid: Solid3D,
  pitchDeg: number,
  yawDeg: number,
  scale = 30,
  cx = 50,
  cy = 50,
): SolidProjection {
  const rot = solid.vertices.map((v) => rotateVec(v, pitchDeg, yawDeg))
  const px = (i: number) => cx + rot[i]![0] * scale
  const py = (i: number) => cy - rot[i]![1] * scale // SVG y grows downward

  // Which mesh faces are front-facing?
  const front = solid.faces.map((f) => faceNormal(rot, f)[2] > 0.001)

  // Vertex visibility: touched by at least one front-facing face.
  const vertVisible = new Array<boolean>(solid.vertices.length).fill(false)
  solid.faces.forEach((f, fi) => {
    if (front[fi]) for (const i of f) vertVisible[i] = true
  })

  // Edge→faces adjacency. An edge is HIDDEN when both faces touching it face away
  // (that is exactly the dashed "hidden edge" of the textbooks).
  const key = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)
  const adj = new Map<string, number[]>()
  solid.faces.forEach((f, fi) => {
    for (let k = 0; k < f.length; k++) {
      const k2 = key(f[k]!, f[(k + 1) % f.length]!)
      const list = adj.get(k2)
      if (list) list.push(fi)
      else adj.set(k2, [fi])
    }
  })
  const segVisible = (a: number, b: number) => (adj.get(key(a, b)) ?? []).some((fi) => front[fi])

  const faces: ProjectedFace[] = []
  solid.faces.forEach((f, fi) => {
    if (!front[fi]) return
    const surfaceId = solid.faceSurface[fi]!
    const kind = solid.surfaces.find((s) => s.id === surfaceId)!.kind
    faces.push({
      surfaceId,
      kind,
      points: f.map((i) => `${px(i).toFixed(2)},${py(i).toFixed(2)}`).join(' '),
      shade: 0.45 + 0.55 * Math.max(0, dot(faceNormal(rot, f), LIGHT)),
    })
  })

  const edges: ProjectedEdge[] = solid.edges.map((e) => {
    const segs = e.segs.map(([a, b]) => ({
      x1: px(a),
      y1: py(a),
      x2: px(b),
      y2: py(b),
      visible: segVisible(a, b),
    }))
    return { id: e.id, visible: segs.some((sg) => sg.visible), segs }
  })

  const corners: ProjectedCorner[] = solid.corners.map((c) => ({
    id: c.id,
    x: px(c.index),
    y: py(c.index),
    visible: vertVisible[c.index]!,
  }))

  return { faces, edges, corners }
}

/** The ids a learner should find for a counting task ("tap every edge"). */
export function solidPartIds(solid: Solid3D, kind: SolidPartKind): string[] {
  if (kind === 'edge') return solid.edges.map((e) => e.id)
  if (kind === 'vertex') return solid.corners.map((c) => c.id)
  return solid.surfaces.filter((s) => s.kind === kind).map((s) => s.id)
}

/** Faces / edges / vertices of a solid — the textbook counts (curved ≠ face). */
export function solidProperties(name: Solid3DName): {
  faces: number
  edges: number
  vertices: number
  curved: number
} {
  const s = makeSolid(name)
  return {
    faces: solidPartIds(s, 'face').length,
    edges: s.edges.length,
    vertices: s.corners.length,
    curved: solidPartIds(s, 'curved').length,
  }
}
