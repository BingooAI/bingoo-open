/**
 * smoke-gen.ts — prove the ported generation pipeline runs server-side with a
 * MOCK llm (no API key/credits). The mock returns a known-valid {doc, bundle} for
 * the write stage; outline/critique safeParse-fail on it and are skipped
 * (best-effort — the "never worse than single-shot" path). Asserts a lint-clean
 * doc comes out.
 *
 * Run: pnpm --filter @bingoo/api-server exec tsx scripts/smoke-gen.ts
 */
import { briefFromTopic, lintDoc } from '@bingoo/explainer';
import { generateLesson, type GenDeps } from '../src/services/explainer-gen/pipeline';
import { ACCEPTANCE_DOC, ACCEPTANCE_VI } from '../../web/src/lib/explainerLesson';

const mockLlm = {
  complete() {
    return Promise.resolve(
      JSON.stringify({
        doc: ACCEPTANCE_DOC,
        bundle: { strings: ACCEPTANCE_VI.strings, narration: ACCEPTANCE_VI.narration },
      }),
    );
  },
};

const brief = briefFromTopic('Số chẵn và số lẻ', ['vi']);
const deps: GenDeps = {
  llm: mockLlm,
  rules: 'rules',
  manifest: '[]',
  wantImages: false,
  assetsPresent: false,
  langName: 'Vietnamese',
};

const res = await generateLesson(brief, deps, () => {});
const errs = lintDoc(res.doc, [res.bundle]).filter((i) => i.level === 'error');
const okDoc = !!res.doc?.scenes?.length && errs.length === 0;
console.log(
  okDoc
    ? `✓ pipeline ran on mock AiPort → ${res.doc.scenes.length}-scene doc, lint 0 errors`
    : `✗ failed: scenes=${res.doc?.scenes?.length ?? 0} lintErrors=${errs.length}`,
);
process.exit(okDoc ? 0 : 1);
