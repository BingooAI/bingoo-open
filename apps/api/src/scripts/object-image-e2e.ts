/**
 * RUNTIME-VERIFY end-to-end: count kit → objectLabel → ảnh-vật (1 vật đơn lẻ) → render kit dùng ảnh.
 * Chứng minh cả CHUỖI chạy thật, đúng thứ tự memory content-authoring #2:
 *   1. LLM (Claude) sinh 1 item `count` cho KC → payload.params.shape + payload.objectLabel.
 *   2. itemMediaSlots → ô "Ảnh cho vật" path=`params.assets.<shape>`, query = 1 VẬT ĐƠN LẺ (không cả cảnh).
 *   3. OpenAI sinh ảnh từ query đó → asset (PENDING trong thư viện, R2).
 *   4. attach asUrl → resolve URL → applyMediaAsset ghi vào params.assets[shape].
 *   5. RENDER THẬT: compileManip + CountObjects.render(params) phát prim {k:'image', src:url} —
 *      đúng nhánh render đọc `P.assets?.[P.shape]` → kit vẽ ẢNH thay icon.
 * Dọn asset sau khi xong. Chi phí: ~1 call item-gen + 1 ảnh gpt-image-1.
 * Run: `node --env-file=.env --import tsx src/scripts/object-image-e2e.ts`
 */
import { db } from '@bingoo/db';
import { applyMediaAsset } from '@bingoo/authored-item';
import { CountObjects, compileManip } from '@bingoo/manipulatives';
import { serializeAsset } from '../lib/media-serialize';
import { deleteAsset, getAssetById, listRenditions } from '../repos/media-asset.repo';
import { getStorage } from '../providers';
import { generateImageAssets } from '../services/media-generate.service';
import { generateOneItem } from '../services/content-item-gen.service';
import { itemMediaSlots } from '../services/item-media.service';

let pass = 0;
let fail = 0;
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (ok) pass++;
  else fail++;
}

async function cleanup(assetId: string) {
  for (const r of await listRenditions(assetId)) {
    if (r.storageKey)
      await getStorage(r.provider ?? undefined)
        .deleteObject(r.storageKey)
        .catch(() => {});
  }
  await deleteAsset(assetId).catch(() => {});
}

async function main() {
  // ── 1. Sinh 1 item COUNT (LLM thật) — brief đẩy vật = ô tô đồ chơi ──────────────
  console.log('1) Sinh item count (Claude)…');
  const item = await generateOneItem({
    kc: 'count-objects-to-10',
    primitiveKind: 'manip:count',
    brief: 'Đếm những chiếc ô tô đồ chơi (toy cars) từ 1 đến 5. Vật để đếm là ô tô.',
    languages: ['vi'],
    persist: false,
  });
  check('LLM trả 1 item count hợp lệ', item !== null);
  if (!item) {
    console.log(`\n⚠️  ${pass} passed, ${fail} failed`);
    await db.$disconnect();
    process.exit(1);
  }
  const payload = item.payload as Record<string, unknown>;
  const params = (payload.params ?? {}) as Record<string, unknown>;
  const objectLabel = (payload.objectLabel ?? {}) as Record<string, string>;
  console.log(
    '   params =',
    JSON.stringify(params),
    '| objectLabel =',
    JSON.stringify(objectLabel),
  );
  const shape = typeof params.shape === 'string' ? params.shape : '';
  const tgtCount = (item.payload as { target?: { count?: number } }).target?.count;
  check('payload.params.shape là chuỗi (khoá vật)', shape.length > 0, `shape=${shape}`);
  check(
    'payload.params.count là số (0 = bắt đầu rỗng, hợp lệ)',
    typeof params.count === 'number',
    `count=${String(params.count)}`,
  );
  check(
    'target.count > 0 (đích để đếm/tạo tới)',
    typeof tgtCount === 'number' && tgtCount > 0,
    `target.count=${String(tgtCount)}`,
  );
  check(
    'payload.objectLabel có vật đơn lẻ (en/vi)',
    Boolean(objectLabel.en || objectLabel.vi),
    `${objectLabel.vi ?? ''}/${objectLabel.en ?? ''}`,
  );

  // ── 2. Ô media từ item → "Ảnh cho vật" (single object, đúng khoá shape) ─────────
  const slots = itemMediaSlots(item);
  const objSlot = slots.find((s) => s.slot === 'kit-object');
  check('có ô "Ảnh cho vật" (kit-object)', Boolean(objSlot), slots.map((s) => s.slot).join(','));
  if (!objSlot) {
    console.log(`\n⚠️  ${pass} passed, ${fail} failed`);
    await db.$disconnect();
    process.exit(1);
  }
  check('ô ghi URL vào ĐÚNG khoá shape', objSlot.path === `params.assets.${shape}`, objSlot.path);
  check('ô lưu URL (asUrl) cho kit render', objSlot.asUrl === true);
  check(
    'query ép 1 VẬT ĐƠN LẺ, không cả cảnh/không số',
    /single/i.test(objSlot.query) && /one object only/i.test(objSlot.query),
    objSlot.query.slice(0, 80) + '…',
  );

  // ── 3. Sinh ảnh THẬT từ query (OpenAI) ─────────────────────────────────────────
  console.log('3) Sinh ảnh-vật (OpenAI)…', objSlot.query.slice(0, 60), '…');
  const assets = await generateImageAssets({
    prompt: objSlot.query,
    count: 1,
    visibility: 'PRIVATE',
    createdById: 'user_verify_object_image',
  });
  const asset = assets[0];
  check('OpenAI trả 1 asset ảnh', Boolean(asset), `got ${assets.length}`);
  if (!asset) {
    console.log(`\n⚠️  ${pass} passed, ${fail} failed`);
    await db.$disconnect();
    process.exit(1);
  }

  // ── 4. Attach asUrl → resolve URL → params.assets[shape] (đúng như route attach) ─
  const full = await getAssetById(asset.id);
  const s = full ? await serializeAsset(full) : null;
  const url = s?.renditions.find((r) => r.url)?.url ?? '';
  check('asset resolve ra URL xem được', url.startsWith('http'), url.slice(0, 60));

  const newPayload = applyMediaAsset(item.payload, objSlot.path, url) as Record<string, unknown>;
  const newParams = (newPayload.params ?? {}) as Record<string, unknown>;
  const newAssets = (newParams.assets ?? {}) as Record<string, string>;
  check(
    'params.assets[shape] = URL sau attach',
    newAssets[shape] === url,
    newAssets[shape] ?? '(trống)',
  );

  // ── 5. RENDER THẬT: count kit chơi "chạm để thêm vật tới target" (onTap:add, check:count===target).
  //    params.count=0 = bắt đầu RỖNG là ĐÚNG thiết kế (học viên tự thêm). Ảnh-vật render khi count>0 →
  //    drive kit tới trạng thái GIẢI (setCount = target.count) rồi render: phải phát N prim ẢNH src=URL.
  const target = (item.payload as { target?: { count?: number } }).target;
  const targetCount = typeof target?.count === 'number' && target.count > 0 ? target.count : 3;
  const state = compileManip(
    CountObjects,
    newParams,
    [{ verb: 'setCount', args: { n: targetCount } }],
    () => undefined,
  );
  const model = CountObjects.render(CountObjects.normalize(newParams), state, state.end, {
    aspect: '16:9',
    box: { w: 480, h: 360 },
  });
  const imgPrims = model.prims.filter((p) => p.k === 'image');
  check(
    'render (trạng thái giải) phát prim ẢNH thay icon',
    imgPrims.length > 0,
    `image prims=${imgPrims.length}`,
  );
  check(
    'prim ảnh dùng ĐÚNG src = URL vật vừa sinh',
    imgPrims.some((p) => (p as { src?: string }).src === url),
    (imgPrims[0] as { src?: string })?.src?.slice(0, 60) ?? '(none)',
  );
  check(
    'số prim ảnh = target.count (mỗi vật một ảnh)',
    imgPrims.length === targetCount,
    `${imgPrims.length} vs target ${targetCount}`,
  );

  // ── Dọn ─────────────────────────────────────────────────────────────────────────
  await cleanup(asset.id);
  check('asset đã dọn', (await getAssetById(asset.id)) === null);

  console.log(`\n${fail === 0 ? '🎉' : '⚠️ '} ${pass} passed, ${fail} failed`);
  await db.$disconnect();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('object-image e2e crashed:', err);
  await db.$disconnect();
  process.exit(1);
});
