/**
 * providers/resolveImage.ts — illustration-first image resolution (pure).
 *
 * BEFORE generating a picture, search an existing media library (the art the
 * host already curated, indexed by NLP + embeddings). Only generate when nothing
 * suitable is found. The algorithm is the explainer's — kept identical to the
 * studio — but the concrete `search`/`image` capabilities are INJECTED (in
 * bingoo they are backed by SearchPort + ImagePort; standalone tests pass fakes),
 * so this module has no vendor, no env, no `fetch`.
 */
import type { MediaSearchProvider, ImageProvider, ImageRequest, ImageResult } from './types';

/** Below this relevance we don't trust a library hit — generate instead. */
export const SCORE_THRESHOLD = 0.34;

export type ResolvedImage = ImageResult & { source: 'library' | 'generated' };

export type ResolveImageDeps = {
  /** library search (illustration-first). Omit/anavailable → skip to generation. */
  search?: MediaSearchProvider;
  /** generator fallback. Omit/unavailable → throw (caller leaves a placeholder). */
  image?: ImageProvider;
};

/**
 * Resolve an image request illustration-first: search the library for `query`
 * (falls back to `prompt`); if a confident match exists (score ≥ threshold) use
 * it; otherwise generate. Throws only when BOTH search misses and generation is
 * unavailable — the caller then leaves the element as a prompt placeholder.
 */
export async function resolveImage(
  req: ImageRequest,
  deps: ResolveImageDeps,
): Promise<ResolvedImage> {
  const query = (req.query ?? req.prompt ?? '').trim();
  // 1) library search first
  const lib = deps.search;
  if (lib?.available() && query) {
    try {
      const { items } = await lib.search({
        query,
        tags: req.tags,
        kind: 'any',
        limit: 5,
        hints: req.hints,
      });
      const top = items[0];
      if (top && top.score >= SCORE_THRESHOLD) {
        return {
          url: top.url,
          provider: `library:${lib.id}`,
          source: 'library',
          meta: { label: top.label, score: top.score, kind: top.kind },
        };
      }
    } catch {
      /* fall through to generation */
    }
  }
  // 2) generate as fallback
  const img = deps.image;
  if (img?.available()) {
    const r = await img.generate(req);
    return { ...r, source: 'generated' };
  }
  throw new Error('no library match and no image generator configured');
}
