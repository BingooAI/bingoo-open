/**
 * gen-prompt.mjs — write contract/PROMPT.md.
 *
 * The markdown itself is built by `promptMarkdown()` in the engine, so this file
 * and the admin's download button emit BYTE-IDENTICAL text. A prompt doc that is
 * a hand-maintained file always ends up describing an engine that no longer
 * exists; generating it from the running engine is the only way it stays true.
 *
 * The few-shot is re-checked against the real gate before anything is written: a
 * stale example teaches the model to produce exactly the scene the importer will
 * then reject, which is worse than shipping no example at all.
 *
 * Run: pnpm --filter @bingoo/explainer prompt
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { MANIPULATIVES } from '@bingoo/manipulatives';
import { promptMarkdown, templateCatalog, checkScene } from '../src/index.ts';
import { EXAMPLES } from '../src/examples.ts';

let bad = 0;
for (const [tpl, ex] of Object.entries(EXAMPLES)) {
  const errs = checkScene(ex.scene, ex.strings).filter((f) => f.level === 'error');
  if (errs.length) {
    bad++;
    console.error(`✗ ví dụ "${tpl}": ${errs.map((e) => e.code).join(', ')}`);
  }
}
if (bad) {
  console.error(`\n✗ ${bad} ví dụ không qua gate — sửa src/examples.ts`);
  process.exit(1);
}

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'contract');
mkdirSync(OUT, { recursive: true });
const md = promptMarkdown();
writeFileSync(join(OUT, 'PROMPT.md'), md);

console.log(
  `✓ contract/PROMPT.md — ${(md.length / 1024).toFixed(1)}KB · ${templateCatalog().length} template · ${Object.keys(EXAMPLES).length} ví dụ · ${MANIPULATIVES.length} kit`,
);
