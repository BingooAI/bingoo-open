/**
 * Document-generation self-test. Seeds a DocumentTemplate, generates a worksheet
 * via the LLM (structured → rubric-verified → Markdown), verifies the PENDING
 * DOCUMENT asset + its Markdown in R2, then cleans up. Hits live OpenAI.
 * Run: `node --env-file=.env --import tsx src/scripts/media-doc-check.ts`
 */
import { db } from '@bingoo/db';
import { getStorage } from '../providers';
import { createTemplate } from '../repos/document-template.repo';
import { deleteAsset, getAssetById, listRenditions } from '../repos/media-asset.repo';
import { generateDocument } from '../services/media-generate-doc.service';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

async function main() {
  const tpl = await createTemplate({
    key: 'e2e-worksheet',
    name: { vi: 'Phiếu bài tập', en: 'Worksheet' },
    docKind: 'worksheet',
    locale: 'vi',
    sections: [
      {
        key: 'objective',
        title: { vi: 'Mục tiêu', en: 'Objective' },
        instruction: 'Nêu mục tiêu học tập ngắn gọn.',
        required: true,
      },
      {
        key: 'warmup',
        title: { vi: 'Khởi động', en: 'Warm-up' },
        instruction: 'Một hoạt động khởi động vui.',
      },
      {
        key: 'exercises',
        title: { vi: 'Bài tập', en: 'Exercises' },
        instruction: 'Từ 5 đến 8 bài tập tăng dần độ khó, đánh số.',
        required: true,
      },
      {
        key: 'answer_key',
        title: { vi: 'Đáp án', en: 'Answer key' },
        instruction: 'Đáp án cho mọi bài tập.',
        required: true,
      },
    ],
    style: { tone: 'thân thiện, khích lệ', gradeBand: 'grade-3', length: 'khoảng 1 trang' },
    rubric: [
      'Toán chính xác, không sai kết quả',
      'Ngôn ngữ phù hợp học sinh lớp 3',
      'Hướng dẫn rõ ràng',
      'Có đủ đáp án cho mọi bài tập',
    ],
    createdById: 'user_doc_test',
  });
  check('template created', Boolean(tpl.id));

  console.log('Generating document via LLM (structured + rubric verify)…');
  const { assetId, quality } = await generateDocument({
    templateKey: 'e2e-worksheet',
    inputs: { topic: 'phép cộng trong phạm vi 20', gradeBand: 'grade-3', locale: 'vi' },
    visibility: 'PRIVATE',
    createdById: 'user_doc_test',
  });

  const asset = await getAssetById(assetId);
  check(
    'asset is DOCUMENT + PENDING (R5 gate)',
    asset?.kind === 'DOCUMENT' && asset?.moderation === 'PENDING',
    `${asset?.kind}/${asset?.moderation}`,
  );
  check(
    'quality score is present (0..1)',
    typeof quality.score === 'number' && quality.score >= 0 && quality.score <= 1,
    `score=${quality.score} refined=${quality.refined}`,
  );
  const gen = (asset?.metadata as { generator?: { templateKey?: string } })?.generator;
  check('metadata records the template used', gen?.templateKey === 'e2e-worksheet');

  // Markdown source stored in R2 + contains the rendered structure.
  const rends = await listRenditions(assetId);
  const original = rends.find((r) => r.kind === 'ORIGINAL');
  check(
    'markdown rendition stored (text/markdown)',
    original?.mimeType === 'text/markdown' && Boolean(original?.storageKey),
  );
  let md = '';
  if (original?.storageKey) {
    const { url } = await getStorage(original.provider ?? undefined).createSignedDownloadUrl({
      key: original.storageKey,
    });
    const res = await fetch(url);
    md = await res.text();
  }
  check('markdown has a title heading', /^#\s/m.test(md));
  check(
    'markdown has section headings (## )',
    (md.match(/^##\s/gm)?.length ?? 0) >= 2,
    `${md.match(/^##\s/gm)?.length ?? 0} sections`,
  );
  check('markdown includes the answer-key section', /Đáp án/i.test(md));
  console.log(`\n--- generated markdown (first 400 chars) ---\n${md.slice(0, 400)}\n---`);

  // Cleanup
  if (original?.storageKey)
    await getStorage(original.provider ?? undefined)
      .deleteObject(original.storageKey)
      .catch(() => {});
  await deleteAsset(assetId).catch(() => {});
  await db.documentTemplate.delete({ where: { id: tpl.id } }).catch(() => {});

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('doc check crashed:', err);
  await db.$disconnect();
  process.exit(1);
});
