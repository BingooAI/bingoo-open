import { mintPublicId, type LocalizedText } from '@bingoo/core';
import { db } from '@bingoo/db';
import type {
  AssetRelType,
  MediaKind,
  MediaScope,
  MediaStatus,
  MediaVisibility,
  ModerationStatus,
  Prisma,
  RenditionKind,
} from '@bingoo/db';

/**
 * Media assets (docs/media-library-design.md §3.3) — the logical search+authz
 * unit. Physical bytes live in renditions (storage/video providers, R1). An
 * asset starts life as a DRAFT: the route mints a signed upload URL, the client
 * PUTs the bytes, then `completeAsset` flips it to PROCESSING/READY.
 */

export interface CreateAssetInput {
  kind: MediaKind;
  title: LocalizedText;
  description?: LocalizedText;
  folderId?: string | null;
  scope?: MediaScope;
  scopeId?: string | null;
  visibility?: MediaVisibility;
  locale?: string | null;
  license?: string | null;
  ageRating?: string | null;
  source?: string | null;
  mimeType?: string | null;
  createdById?: string | null;
  ownerId?: string | null;
  /** Defaults to PENDING (R5). Callers pass `initialModeration(role)` — see lib/media-moderation. */
  moderation?: ModerationStatus;
}

export async function createAsset(input: CreateAssetInput) {
  // Inherit scope from the folder when one is given and no explicit scope.
  let scope: MediaScope = input.scope ?? 'GLOBAL';
  let scopeId = input.scopeId ?? null;
  if (input.folderId && input.scope === undefined) {
    const folder = await db.mediaFolder.findUnique({
      where: { id: input.folderId },
      select: { scope: true, scopeId: true },
    });
    if (folder) {
      scope = folder.scope;
      scopeId = folder.scopeId;
    }
  }

  const moderation = input.moderation ?? 'PENDING';

  return db.mediaAsset.create({
    data: {
      publicId: mintPublicId(),
      kind: input.kind,
      status: 'DRAFT',
      moderation,
      // Mirrors setAssetModeration: approved is what makes an asset published.
      ...(moderation === 'APPROVED' ? { publishedAt: new Date() } : {}),
      title: input.title,
      description: input.description ?? undefined,
      folderId: input.folderId ?? null,
      scope,
      scopeId,
      visibility: input.visibility ?? 'SCOPE',
      locale: input.locale ?? null,
      license: input.license ?? null,
      ageRating: input.ageRating ?? null,
      source: input.source ?? null,
      mimeType: input.mimeType ?? null,
      createdById: input.createdById ?? null,
      ownerId: input.ownerId ?? input.createdById ?? null,
      keywords: [],
    },
  });
}

const ASSET_INCLUDE = {
  renditions: true,
  tags: { include: { tag: { select: { slug: true, kind: true, label: true } } } },
} satisfies Prisma.MediaAssetInclude;

export function getAssetById(id: string) {
  return db.mediaAsset.findUnique({ where: { id }, include: ASSET_INCLUDE });
}

export function getAssetByPublicId(publicId: string) {
  return db.mediaAsset.findUnique({ where: { publicId }, include: ASSET_INCLUDE });
}

export interface RenditionInput {
  kind: RenditionKind;
  provider?: string | null;
  storageKey?: string | null;
  videoId?: string | null;
  url?: string | null;
  checksum?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  bitrate?: number | null;
}

/** Upsert a rendition (one per kind per asset). */
export function putRendition(assetId: string, r: RenditionInput) {
  return db.mediaRendition.upsert({
    where: { assetId_kind: { assetId, kind: r.kind } },
    create: {
      assetId,
      kind: r.kind,
      provider: r.provider ?? null,
      storageKey: r.storageKey ?? null,
      videoId: r.videoId ?? null,
      url: r.url ?? null,
      checksum: r.checksum ?? null,
      mimeType: r.mimeType ?? null,
      byteSize: r.byteSize ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      bitrate: r.bitrate ?? null,
    },
    update: {
      provider: r.provider ?? null,
      storageKey: r.storageKey ?? null,
      videoId: r.videoId ?? null,
      url: r.url ?? null,
      checksum: r.checksum ?? null,
      mimeType: r.mimeType ?? null,
      byteSize: r.byteSize ?? null,
      width: r.width ?? null,
      height: r.height ?? null,
      bitrate: r.bitrate ?? null,
    },
  });
}

export interface CompleteAssetInput {
  byteSize?: number | null;
  checksum?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  pageCount?: number | null;
}

/** Mark an uploaded asset ready for enrichment/moderation. */
export function completeAsset(id: string, meta: CompleteAssetInput) {
  return db.mediaAsset.update({
    where: { id },
    data: {
      status: 'PROCESSING',
      byteSize: meta.byteSize ?? undefined,
      checksum: meta.checksum ?? undefined,
      width: meta.width ?? undefined,
      height: meta.height ?? undefined,
      durationMs: meta.durationMs ?? undefined,
      pageCount: meta.pageCount ?? undefined,
    },
  });
}

export interface UpdateAssetInput {
  title?: LocalizedText;
  description?: LocalizedText;
  altText?: LocalizedText;
  folderId?: string | null;
  visibility?: MediaVisibility;
  license?: string | null;
  ageRating?: string | null;
  locale?: string | null;
}

export function updateAsset(id: string, input: UpdateAssetInput) {
  return db.mediaAsset.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      description: input.description ?? undefined,
      altText: input.altText ?? undefined,
      folderId: input.folderId === undefined ? undefined : input.folderId,
      visibility: input.visibility ?? undefined,
      license: input.license === undefined ? undefined : input.license,
      ageRating: input.ageRating === undefined ? undefined : input.ageRating,
      locale: input.locale === undefined ? undefined : input.locale,
    },
  });
}

export function setAssetStatus(id: string, status: MediaStatus) {
  return db.mediaAsset.update({ where: { id }, data: { status } });
}

export function setAssetModeration(
  id: string,
  moderation: ModerationStatus,
  reason?: string | null,
) {
  return db.mediaAsset.update({
    where: { id },
    data: {
      moderation,
      moderationReason: reason ?? null,
      // Publish only when moderation approves a ready asset.
      ...(moderation === 'APPROVED' ? { publishedAt: new Date() } : {}),
    },
  });
}

export function listAssetsByFolder(folderId: string, skip: number, take: number) {
  return Promise.all([
    db.mediaAsset.findMany({
      where: { folderId },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
      include: ASSET_INCLUDE,
    }),
    db.mediaAsset.count({ where: { folderId } }),
  ]);
}

export function getAssetsByIds(ids: string[]) {
  return db.mediaAsset.findMany({ where: { id: { in: ids } }, include: ASSET_INCLUDE });
}

export function relateAssets(fromAssetId: string, toAssetId: string, relType: AssetRelType) {
  return db.mediaAssetRelation.upsert({
    where: { fromAssetId_toAssetId_relType: { fromAssetId, toAssetId, relType } },
    create: { fromAssetId, toAssetId, relType },
    update: {},
  });
}

/** Renditions with their physical location — used to delete/move bytes. */
export function listRenditions(assetId: string) {
  return db.mediaRendition.findMany({ where: { assetId } });
}

export function deleteAsset(id: string) {
  return db.mediaAsset.delete({ where: { id } });
}
