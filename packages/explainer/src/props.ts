/**
 * props.ts — pure metadata for the reusable prop kit (spec §8, FR-C-06).
 *
 * The visual renderers live in `src/kit/props.tsx` (platform-specific SVG), but
 * the engine only needs each prop's *natural aspect ratio* and *anchor* to place
 * it. Keeping this as pure data lets `layout.ts` compose scenes headlessly
 * without importing any React — objects snap to the ground/sky consistently at
 * both aspects, so composing a scene never means hand-tuning pixels per aspect.
 */

/** anchor: where the placement point sits on the prop's box. */
export type PropAnchor = 'bottom' | 'center'

export type PropMeta = {
  aspect: number // width / height of the prop's natural box
  anchor: PropAnchor // "bottom" → stands on the ground; "center" → floats
}

export const PROP_META: Record<string, PropMeta> = {
  // sky / floating
  sun: { aspect: 1, anchor: 'center' },
  moon: { aspect: 1, anchor: 'center' },
  cloud: { aspect: 1.7, anchor: 'center' },
  raincloud: { aspect: 1.7, anchor: 'center' },
  star: { aspect: 1, anchor: 'center' },
  bird: { aspect: 1.7, anchor: 'center' },
  vapor: { aspect: 0.4, anchor: 'center' },
  droplet: { aspect: 0.7, anchor: 'center' },
  // ground-standing
  mountain: { aspect: 2.3, anchor: 'bottom' },
  hill: { aspect: 3.0, anchor: 'bottom' },
  lake: { aspect: 3.4, anchor: 'bottom' },
  puddle: { aspect: 4.0, anchor: 'bottom' },
  tree: { aspect: 0.85, anchor: 'bottom' },
  pine: { aspect: 0.7, anchor: 'bottom' },
  bush: { aspect: 1.4, anchor: 'bottom' },
  flower: { aspect: 0.5, anchor: 'bottom' },
  grass: { aspect: 1.6, anchor: 'bottom' },
  house: { aspect: 1.15, anchor: 'bottom' },
  // generic
  thermometer: { aspect: 0.4, anchor: 'bottom' },
  sunNoon: { aspect: 1, anchor: 'center' },
  box: { aspect: 1.4, anchor: 'center' },
  circle: { aspect: 1, anchor: 'center' },
  arrow: { aspect: 1.6, anchor: 'center' },
  arrowUp: { aspect: 0.8, anchor: 'center' },
  wave: { aspect: 2.4, anchor: 'center' },
}

/** stick figure is not a prop but participates in ground placement. */
export const STICK_META: PropMeta = { aspect: 0.55, anchor: 'bottom' }

/**
 * Merge in metadata for imported SVG assets (auto-generated from /assets).
 * Kept separate so hand-authored props and imported art share one lookup.
 */
import { SVG_ASSET_META } from './svgAssetMeta'
export const ALL_PROP_META: Record<string, PropMeta> = { ...PROP_META, ...SVG_ASSET_META }

export function propMeta(shape: string | undefined): PropMeta {
  return (shape && ALL_PROP_META[shape]) || { aspect: 1, anchor: 'center' }
}
