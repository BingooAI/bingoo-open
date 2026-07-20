/**
 * importLesson.ts — validate an external `{ doc, bundles }` lesson (from the AI
 * `/generate` page, a downloaded JSON, or a paste) into a loadable EditState.
 *
 * This is the seam that closes the "AI drafts → human refines" loop: the studio
 * only accepts a lesson that PARSES against the engine schema, so a malformed
 * import fails loudly here instead of crashing the editor later. Lint errors are
 * surfaced but NOT fatal — the editor exists precisely to fix them.
 */
import { parseDoc, parseBundle, lintDoc } from '@bingoo/explainer'
import type { LocaleBundle } from '@bingoo/explainer'
import type { EditState } from './ops'

export type ImportResult = { ok: true; state: EditState; lintErrors: string[] } | { ok: false; error: string }

/** Coerce a raw parsed object (`{ doc, bundles }`) into a validated EditState. */
export function importLesson(raw: unknown): ImportResult {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Tệp không phải JSON hợp lệ.' }
  const obj = raw as { doc?: unknown; bundles?: unknown; bundle?: unknown }
  if (!obj.doc) return { ok: false, error: 'Thiếu `doc` trong tệp.' }

  try {
    const doc = parseDoc(obj.doc)
    // accept both { bundles: {locale: bundle} } and a single { bundle }
    const rawBundles: Record<string, unknown> =
      obj.bundles && typeof obj.bundles === 'object'
        ? (obj.bundles as Record<string, unknown>)
        : obj.bundle
          ? { [doc.meta.defaultLocale]: obj.bundle }
          : {}
    const bundles: Record<string, LocaleBundle> = {}
    for (const [loc, b] of Object.entries(rawBundles)) {
      bundles[loc] = parseBundle({ ...(b as object), locale: loc })
    }
    if (Object.keys(bundles).length === 0)
      return { ok: false, error: 'Thiếu `bundles` (lời giảng) trong tệp.' }

    const lintErrors = lintDoc(doc, Object.values(bundles))
      .filter((i) => i.level === 'error')
      .map((e) => `${e.code}: ${e.message}`)
    return { ok: true, state: { doc, bundles }, lintErrors }
  } catch (e) {
    return { ok: false, error: `Không đọc được bài học: ${(e as Error).message}` }
  }
}

/** localStorage handoff key: `/generate` writes a lesson here, the editor picks
 *  it up once on mount ("✎ Sửa trong Studio"). */
export const HANDOFF_KEY = 'es.editorImport'
