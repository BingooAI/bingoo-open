/**
 * manipulative/registry.ts — the `kind` → Manipulative lookup. Kinds register
 * themselves in index.ts; the choreographer (to bake) and frame (to render) both
 * resolve through here. Pure data — no platform code.
 */
import type { KitAny, Manipulative } from './types'

const REGISTRY = new Map<string, Manipulative<KitAny>>()

export function registerManipulative(m: Manipulative<KitAny>): void {
  REGISTRY.set(m.kind, m)
}

export function getManipulative(kind: string): Manipulative<KitAny> | null {
  return REGISTRY.get(kind) ?? null
}

export function manipulativeKinds(): string[] {
  return [...REGISTRY.keys()]
}
