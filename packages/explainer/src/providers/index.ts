// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * @bingoo.ai/explainer/providers — the explainer's pluggable service boundary.
 *
 * Pure interfaces + the explainer's vendor-neutral orchestration logic
 * (illustration-first image resolution, narration↔cue re-timing). The engine
 * core stays pure and vendor-agnostic; the concrete adapters that satisfy these
 * ports live in `apps/api` (backed by bingoo's AiPort/TtsPort/ImagePort/
 * SearchPort). Nothing here imports a vendor, node, env, or `fetch`.
 */
export * from './types'
export * from './cue'
export * from './resolveImage'
