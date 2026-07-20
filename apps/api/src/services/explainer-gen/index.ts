// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * explainer-gen — the multi-stage lesson generator (outline → write → critic →
 * regen) run server-side on bingoo's AiPort. The engine-owned pipeline is
 * unchanged; here we build its deps: the LLM is `explainerComplete` (AiPort), the
 * kit catalogue comes from the live @bingoo.ai/manipulatives registry, and a
 * concise authoring ruleset grounds the writer.
 */
import { MANIPULATIVES } from '@bingoo.ai/manipulatives'
import type { LessonBrief } from '@bingoo.ai/explainer'
import { promptMarkdown, planForScenes } from '@bingoo.ai/explainer'
import { db } from '@bingoo.ai/db'
import { generateLesson, type GenDeps, type GenResult, type BankItem } from './pipeline'
import { explainerComplete } from '../explainer.service'

/** Reuse from the content bank: APPROVED/PUBLISHED, difficulty-calibrated,
 *  measurable questions whose skills overlap the objective's. Mirrors the
 *  media-illustration-first rule — search the library before generating. Cheapest
 *  first so the writer sees an easy→hard spread. Empty on any failure so
 *  generation degrades to authoring-from-scratch, never breaks. */
async function bankItems(skills: string[]): Promise<BankItem[]> {
  if (!skills.length) return []
  try {
    const rows = await db.contentItem.findMany({
      where: {
        skills: { hasSome: skills },
        measurable: true,
        status: { in: ['APPROVED', 'PUBLISHED'] },
      },
      orderBy: { difficulty: 'asc' },
      take: 12,
    })
    return rows.map((r) => ({
      skills: r.skills,
      primitiveKind: r.primitiveKind,
      difficulty: r.difficulty,
      payload: r.payload,
    }))
  } catch {
    return []
  }
}

const LANG: Record<string, string> = { vi: 'Vietnamese', en: 'English' }

/**
 * The kit catalogue the writer grounds on. It carries `defaultParams`, not just
 * verb names: that object is the ONLY place a param's shape is written down, so
 * a manifest without it left the model unable to know a kit even takes `labels`
 * — and every evenodd rendered "7 is ODD" in English inside a Vietnamese lesson.
 */
function kitManifest(): string {
  return JSON.stringify(
    MANIPULATIVES.map((m) => ({
      kind: m.kind,
      defaultParams: m.defaultParams ?? {},
      verbs: Object.keys(m.verbs),
    })),
  )
}

export type { GenResult } from './pipeline'

/** Generate a lesson from a validated LessonBrief using bingoo's AiPort. */
export function runGenerate(
  brief: LessonBrief,
  opts: { locale?: string; wantImages?: boolean; assetsPresent?: boolean } = {},
): Promise<GenResult> {
  const deps: GenDeps = {
    llm: { complete: (req) => explainerComplete(req) },
    // The FULL authoring contract — the same generator behind contract/PROMPT.md.
    // Built from source (kit registry, quiz shapes, arc, SFX, layout, gold
    // reference); the server writer and the downloadable prompt never diverge.
    // Sized to the brief so the contract's scene target / targetMinutes match the
    // outline and the gate (all three go through planForScenes).
    rules: promptMarkdown(planForScenes(brief.constraints.sceneCount).minutes),
    manifest: kitManifest(),
    wantImages: opts.wantImages ?? false,
    assetsPresent: opts.assetsPresent ?? false,
    langName: LANG[opts.locale ?? 'vi'] ?? 'Vietnamese',
    // Reuse APPROVED questions from the content bank for objectives that carry
    // skill slugs — moderated, calibrated, consistent with the rest of bingoo.
    bank: bankItems,
  }
  return generateLesson(brief, deps, () => {})
}
