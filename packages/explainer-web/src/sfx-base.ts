// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * sfx-base.ts — where sound effects are served from, for this deployment.
 *
 * `@bingoo.ai/explainer` knows the sound *names* and refuses to know anything else: it takes
 * the base URL as an argument so it stays pure. This module is the one place that answers
 * "which base?", and it is here rather than in the pure package because the answer is a
 * property of the deployment, not of the content.
 *
 * No audio ships with this repository — see `sfx-catalog.ts` for why. With
 * `NEXT_PUBLIC_SFX_BASE_URL` unset, `sfxUrl` returns `undefined` and callers degrade on
 * purpose: the player falls back to a synth blip, the editor's pickers hide their preview
 * buttons. That is the default experience, and it works.
 *
 * To enable real audio, serve a directory of `<name>.mp3` files — locally from
 * `apps/web/public/sfx` (`NEXT_PUBLIC_SFX_BASE_URL=/sfx`) or from any host — using a pack
 * you have the right to distribute.
 */
import { sfxUrl as resolve } from '@bingoo.ai/explainer'

/**
 * Read once at module load. Next inlines `NEXT_PUBLIC_*` at build time, so this is a constant
 * in the bundle rather than a lookup; the `?? undefined` normalises an empty string, which is
 * what a `.env` line with nothing after the `=` produces.
 */
const BASE_URL: string | undefined = process.env.NEXT_PUBLIC_SFX_BASE_URL || undefined

/** True when this deployment has a sound pack configured. Use it to hide preview affordances. */
export const hasSfxPack = BASE_URL !== undefined

/** Resolve a sound name against this deployment's pack, or `undefined` if there is none. */
export const sfxUrl = (name: string): string | undefined => resolve(name, BASE_URL)
