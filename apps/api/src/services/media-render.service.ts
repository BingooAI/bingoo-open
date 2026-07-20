import { createHash } from 'node:crypto';
import htmlToDocx from 'html-to-docx';
import MarkdownIt from 'markdown-it';
import { getStorage } from '../providers';
import { extForMime, renditionStorageKey } from '../lib/media-serialize';
import { getAssetById, putRendition } from '../repos/media-asset.repo';

/**
 * Document export rendering (docs/media-library-design.md §6.2). Derives a
 * downloadable format from a DOCUMENT asset's canonical Markdown ORIGINAL — a
 * derived rendition, exactly like an image thumbnail. DOCX now (pure-JS,
 * light: markdown→HTML→docx); PDF is a future format behind the same shape.
 */

const ACTIVE_STORAGE = process.env.STORAGE_PROVIDER ?? 'r2';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function firstLocalized(value: unknown): string {
  if (value && typeof value === 'object') {
    const v = Object.values(value as Record<string, unknown>).find((x) => typeof x === 'string');
    return (v as string) ?? '';
  }
  return '';
}

/** Markdown → DOCX bytes (via HTML). */
export async function markdownToDocx(markdown: string, title?: string): Promise<Uint8Array> {
  const bodyHtml = md.render(markdown);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title ?? ''}</title></head><body>${bodyHtml}</body></html>`;
  const out = await htmlToDocx(html, null, { title, pageNumber: true });
  return out instanceof ArrayBuffer ? new Uint8Array(out) : new Uint8Array(out as Buffer);
}

async function fetchText(provider: string | null, storageKey: string): Promise<string> {
  const { url } = await getStorage(provider ?? undefined).createSignedDownloadUrl({
    key: storageKey,
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`failed to read source (${res.status})`);
  return res.text();
}

/** Render + store the DOCX rendition of a DOCUMENT asset; returns the rendition. */
export async function renderDocumentDocx(assetId: string) {
  const asset = await getAssetById(assetId);
  if (!asset) throw new Error('asset not found');
  if (asset.kind !== 'DOCUMENT') throw new Error('asset is not a DOCUMENT');
  const original = asset.renditions.find((r) => r.kind === 'ORIGINAL');
  if (!original?.storageKey) throw new Error('asset has no source markdown');

  const markdown = await fetchText(original.provider, original.storageKey);
  const bytes = await markdownToDocx(markdown, firstLocalized(asset.title));

  const key = renditionStorageKey(
    asset.scope,
    asset.scopeId,
    asset.id,
    'document',
    extForMime(DOCX_MIME),
  );
  await getStorage().putObject({ key, body: bytes, contentType: DOCX_MIME });
  return putRendition(asset.id, {
    kind: 'DOCX',
    provider: ACTIVE_STORAGE,
    storageKey: key,
    checksum: createHash('sha256').update(bytes).digest('hex'),
    mimeType: DOCX_MIME,
    byteSize: bytes.byteLength,
  });
}
