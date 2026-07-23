// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Prompt management (docs/media-library-design.md §6.3). One module owns every
 * LLM prompt: services call `renderPrompt(id, vars)` instead of hardcoding text.
 * Resolution order: RemoteConfig override (`prompt:<id>`) → in-code default; then
 * `{{var}}` placeholders are interpolated. Overrides are server-controlled (R6)
 * so prompts can be tuned/hotfixed without a release.
 */
import { createHash } from 'node:crypto'
import { deleteRemoteConfig, getRemoteConfig, hasRemoteConfig, setRemoteConfig } from '../repos/config.repo'
import { PROMPTS, PROMPT_IDS, type PromptId } from './catalog'

export { PROMPTS, PROMPT_IDS } from './catalog'
export type { PromptId, PromptDefinition } from './catalog'

const overrideKey = (id: PromptId) => `prompt:${id}`

/** Replace `{{name}}` placeholders; unknown/missing vars → '' then tidy spaces. */
export function interpolate(template: string, vars: Record<string, string | undefined> = {}): string {
  return template
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/** The effective template for `id` — a runtime override if set, else the default. */
export async function getPromptTemplate(id: PromptId): Promise<string> {
  return getRemoteConfig<string>(overrideKey(id), PROMPTS[id].template)
}

/**
 * Vân tay của prompt tại thời điểm gọi: id + hash của template HIỆU LỰC (kể cả override runtime). Lưu
 * kèm thứ AI sinh để TRUY VẾT — prompt có thể bị override đổi giữa hai lần sinh (R6) mà không đổi id;
 * hash bắt được đúng bản đã dùng (quyết định D1: giữ override được, nhưng phải truy được).
 */
export async function promptFingerprint(id: PromptId): Promise<{ promptId: PromptId; promptHash: string }> {
  const template = await getPromptTemplate(id)
  return { promptId: id, promptHash: createHash('sha256').update(template).digest('hex').slice(0, 16) }
}

/** Render a prompt ready to send to the LLM (override-aware + interpolated). */
export async function renderPrompt(
  id: PromptId,
  vars: Record<string, string | undefined> = {},
): Promise<string> {
  return interpolate(await getPromptTemplate(id), vars)
}

export interface PromptView {
  id: PromptId
  description: string
  variables: readonly string[]
  default: string
  overridden: boolean
  effective: string
}

/** Catalog + current override state — powers the admin prompt-management view. */
export async function listPromptViews(): Promise<PromptView[]> {
  return Promise.all(
    PROMPT_IDS.map(async (id) => {
      const def = PROMPTS[id]
      const overridden = await hasRemoteConfig(overrideKey(id))
      const effective = await getPromptTemplate(id)
      return {
        id,
        description: def.description,
        variables: def.variables,
        default: def.template,
        overridden,
        effective,
      }
    }),
  )
}

/** Set a runtime override for a prompt (server-controlled, takes effect ~cache TTL). */
export function setPromptOverride(id: PromptId, template: string, updatedBy?: string | null): Promise<void> {
  return setRemoteConfig(overrideKey(id), template, updatedBy)
}

/** Clear a prompt override — revert to the in-code default. */
export function clearPromptOverride(id: PromptId): Promise<void> {
  return deleteRemoteConfig(overrideKey(id))
}

export function isPromptId(value: string): value is PromptId {
  return (PROMPT_IDS as string[]).includes(value)
}
