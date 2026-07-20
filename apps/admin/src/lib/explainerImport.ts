/**
 * explainerImport.ts — the import PIPELINE, as pure steps.
 *
 * A model gives you JSON with holes in it on purpose: pictures are `query`
 * strings (not URLs — a model that invents an image URL invents a 404), and
 * narration has no audio. Filling those holes needs the server (media library,
 * R2, TTS), costs money, and can partly fail. So it is a sequence of explicit
 * steps you can watch, retry and stop — not one opaque "import" button that
 * either works or doesn't.
 *
 *   1. validate  — parse + lint + the LAYOUT GATE. Free, instant, and it is the
 *                  only step that can reject the lesson outright. Nothing is
 *                  spent until the shape is known good.
 *   2. images    — search the media library FIRST; generate only what isn't there.
 *   3. audio     — TTS per narration line, with the cue marks that drive the beats.
 *   4. edit      — hand the finished doc to the Studio.
 *
 * Steps 2 and 3 are idempotent: re-running skips anything already resolved, so a
 * partial failure is resumed, not restarted.
 */
import type { ExplainerDoc, LocaleBundle } from '@bingoo/explainer';
import { parseDoc, parseBundle, lintDoc, checkScene, checkLesson } from '@bingoo/explainer';

export type ImportIssue = {
  level: 'error' | 'warn';
  code: string;
  where: string;
  message: string;
  /** the mechanical repair — paste this back to the model */
  fix?: string;
};

export type Parsed = { doc: ExplainerDoc; bundle: LocaleBundle };

/* ── step 1: validate ─────────────────────────────────────────────────────── */

export function validateImport(
  raw: string,
): { ok: true; parsed: Parsed; issues: ImportIssue[] } | { ok: false; issues: ImportIssue[] } {
  let json: unknown;
  try {
    // tolerate a model wrapping the JSON in a ```json fence
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    json = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'bad-json',
          where: 'input',
          message: `JSON không hợp lệ: ${(e as Error).message}`,
          fix: 'Trả về DUY NHẤT object JSON, không kèm văn xuôi hay ```fence.',
        },
      ],
    };
  }

  const r = json as { doc?: unknown; bundle?: unknown };
  if (!r?.doc || !r?.bundle) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'bad-envelope',
          where: 'input',
          message: 'Thiếu key "doc" hoặc "bundle"',
          fix: 'Trả về { "doc": {...}, "bundle": {...} }',
        },
      ],
    };
  }

  let doc: ExplainerDoc;
  let bundle: LocaleBundle;
  try {
    doc = parseDoc(r.doc);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'bad-doc',
          where: 'doc',
          message: String((e as Error).message).slice(0, 2000),
          fix: 'Sửa doc theo lỗi schema ở trên.',
        },
      ],
    };
  }
  try {
    bundle = parseBundle(r.bundle);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          level: 'error',
          code: 'bad-bundle',
          where: 'bundle',
          message: String((e as Error).message).slice(0, 2000),
          fix: 'Sửa bundle theo lỗi schema ở trên.',
        },
      ],
    };
  }

  const issues: ImportIssue[] = [];
  for (const i of lintDoc(doc, [bundle])) {
    issues.push({ level: i.level, code: i.code, where: 'lint', message: i.message });
  }
  // THE LESSON GATE — does it TEACH? (the arc: explore → orient → teach →
  // formalize → guided → practice → recap → checkout) and does it USE the
  // engine (kits that move on a cue, varied templates, a diagram, a manip gate)?
  // A lesson can be perfectly well-formed scene by scene and still be a trailer.
  for (const f of checkLesson(doc, bundle)) {
    issues.push({ level: f.level, code: f.code, where: 'bài học', message: f.message, fix: f.fix });
  }
  // THE LAYOUT GATE — the same resolveLayout the renderer uses, at both aspects.
  for (const scene of doc.scenes) {
    for (const f of checkScene(scene, bundle.strings, bundle.locale)) {
      issues.push({
        level: f.level,
        code: f.code,
        where: `scene "${scene.id}"${f.elementId ? ` · ${f.elementId}` : ''}`,
        message: f.message,
        fix: f.fix,
      });
    }
  }

  if (issues.some((i) => i.level === 'error')) return { ok: false, issues };
  return { ok: true, parsed: { doc, bundle }, issues };
}

/** Every finding, formatted to paste straight back into the chat. */
export function repairPrompt(issues: ImportIssue[]): string {
  const errs = issues.filter((i) => i.level === 'error');
  return [
    'Bài bị từ chối. Sửa ĐÚNG những lỗi sau rồi trả lại JSON {doc, bundle} đầy đủ:',
    '',
    ...errs.map((i) => `- [${i.code}] ${i.where}: ${i.message}${i.fix ? `\n  FIX: ${i.fix}` : ''}`),
  ].join('\n');
}

/* ── step 2: images ───────────────────────────────────────────────────────── */

export type ImageJob = {
  sceneId: string;
  /** the scene's on-screen title — so you know WHERE this picture goes */
  sceneTitle?: string;
  /** the line the teacher says over it */
  caption?: string;
  elementId: string;
  /** the Vietnamese description — what we SEARCH the library with */
  query: string;
  /** the English fallback — what an image MODEL is prompted with, if we generate.
   *  Sending the Vietnamese query to an image model was a bug: it is a search
   *  string, not a generation prompt. */
  prompt?: string;
  /** English tag slugs the lesson supplied — the asset is unfilterable without them */
  tags?: string[];
  alt?: string;
};

/** A library candidate for one image. */
export type MediaHit = { id: string; url: string; label?: string; score: number; kind?: string };

/** Image elements the model left as a `query` — no src yet. */
export function pendingImages(doc: ExplainerDoc, bundle?: LocaleBundle): ImageJob[] {
  const out: ImageJob[] = [];
  for (const scene of doc.scenes) {
    const titleEl = scene.elements.find((e) => e.type === 'text' && e.region === 'title');
    const sceneTitle = titleEl ? bundle?.strings[titleEl.id] : undefined;
    const refs = [scene.narrationRef, ...(scene.narrations ?? []).map((n) => n.ref)].filter(
      Boolean,
    ) as string[];
    const caption = refs
      .map((r) => bundle?.narration[r]?.script ?? '')
      .join(' ')
      .replace(/\[\[cue:[^\]]+\]\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    for (const el of scene.elements) {
      if (el.type !== 'image') continue;
      const c = (el.content ?? {}) as {
        src?: string;
        query?: string;
        prompt?: string;
        alt?: string;
      };
      if (c.src) continue; // already resolved — idempotent
      const query = c.query ?? c.prompt ?? c.alt;
      if (query)
        out.push({
          sceneId: scene.id,
          sceneTitle,
          caption,
          elementId: el.id,
          query,
          prompt: c.prompt,
          alt: c.alt,
        });
    }
  }
  return out;
}

/** Fill one image's `src` in place (returns a NEW doc — no mutation). */
export function withImage(
  doc: ExplainerDoc,
  elementId: string,
  src: string,
  w?: number,
  h?: number,
): ExplainerDoc {
  return {
    ...doc,
    scenes: doc.scenes.map((s) => ({
      ...s,
      elements: s.elements.map((el) =>
        el.id === elementId
          ? {
              ...el,
              content: {
                ...(el.content as object),
                kind: 'image',
                src,
                w: w ?? (el.content as { w?: number })?.w,
                h: h ?? (el.content as { h?: number })?.h,
              },
            }
          : el,
      ),
    })),
  };
}

/* ── step 3: audio ────────────────────────────────────────────────────────── */

export type AudioJob = { ref: string; script: string };

/** Narration lines with no audio yet. */
export function pendingAudio(bundle: LocaleBundle): AudioJob[] {
  return Object.entries(bundle.narration ?? {})
    .filter(([, n]) => !n.audioUrl)
    .map(([ref, n]) => ({ ref, script: n.script }));
}

export function withAudio(
  bundle: LocaleBundle,
  ref: string,
  audioUrl: string,
  marks?: { cue: string; t: number }[],
): LocaleBundle {
  const n = bundle.narration[ref];
  if (!n) return bundle;
  return {
    ...bundle,
    narration: {
      ...bundle.narration,
      // Keep the model's marks when TTS returns none: the beats are bound to
      // those cues, and dropping them would silently unhook every animation.
      [ref]: { ...n, audioUrl, marks: marks?.length ? marks : n.marks },
    },
  };
}
