/**
 * DOCX export self-test (no LLM). Creates a DOCUMENT asset with a Markdown
 * ORIGINAL in R2, renders the DOCX rendition, verifies it's a real .docx (zip)
 * stored + downloadable, then cleans up.
 * Run: `node --env-file=.env --import tsx src/scripts/media-docx-check.ts`
 */
import { db } from '@bingoo/db';
import { getStorage } from '../providers';
import { extForMime, renditionStorageKey } from '../lib/media-serialize';
import {
  createAsset,
  deleteAsset,
  getAssetById,
  listRenditions,
  putRendition,
} from '../repos/media-asset.repo';
import { renderDocumentDocx, DOCX_MIME } from '../services/media-render.service';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

const MARKDOWN = `# Phiếu bài tập: Phép cộng

## Mục tiêu

Học sinh **cộng** được các số trong phạm vi 20.

## Bài tập

1. 8 + 5 = ?
2. 7 + 9 = ?
3. 6 + 6 = ?

## Đáp án

1. 13
2. 16
3. 12
`;

async function main() {
  const asset = await createAsset({
    kind: 'DOCUMENT',
    title: { vi: 'Phiếu bài tập: Phép cộng', en: 'Worksheet: Addition' },
    visibility: 'PRIVATE',
    mimeType: 'text/markdown',
    createdById: 'user_docx_test',
  });

  // Store the canonical Markdown ORIGINAL in R2.
  const mdKey = renditionStorageKey(
    asset.scope,
    asset.scopeId,
    asset.id,
    'original',
    extForMime('text/markdown'),
  );
  await getStorage().putObject({
    key: mdKey,
    body: new Uint8Array(Buffer.from(MARKDOWN, 'utf8')),
    contentType: 'text/markdown',
  });
  await putRendition(asset.id, {
    kind: 'ORIGINAL',
    provider: 'r2',
    storageKey: mdKey,
    mimeType: 'text/markdown',
  });

  // Render DOCX.
  const rendition = await renderDocumentDocx(asset.id);
  check('DOCX rendition created', rendition.kind === 'DOCX' && Boolean(rendition.storageKey));
  check('DOCX mime recorded', rendition.mimeType === DOCX_MIME);

  // Download + verify it's a real .docx (ZIP magic "PK\x03\x04").
  let ok = false;
  if (rendition.storageKey) {
    const { url } = await getStorage(rendition.provider ?? undefined).createSignedDownloadUrl({
      key: rendition.storageKey,
    });
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    ok = buf.length > 0 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK"
    check('DOCX bytes downloadable + valid zip signature', ok, `${buf.length} bytes`);
  }

  const full = await getAssetById(asset.id);
  check(
    'asset now exposes both ORIGINAL + DOCX renditions',
    (full?.renditions.length ?? 0) >= 2,
    `${full?.renditions.length} renditions`,
  );

  // Cleanup
  for (const r of await listRenditions(asset.id)) {
    if (r.storageKey)
      await getStorage(r.provider ?? undefined)
        .deleteObject(r.storageKey)
        .catch(() => {});
  }
  await deleteAsset(asset.id).catch(() => {});

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('docx check crashed:', err);
  await db.$disconnect();
  process.exit(1);
});
