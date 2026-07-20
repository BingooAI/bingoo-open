import { permissionSatisfies, type MediaPermission } from '@bingoo/core';
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../auth';
import { hasAnyRole } from '../auth/roles';
import type { AppEnv } from '../lib/context';
import { AppError } from '../lib/errors';
import { initialModeration, MODERATION_ROLES } from '../lib/media-moderation';
import { extForMime, renditionStorageKey, serializeAsset } from '../lib/media-serialize';
import { paginationMeta, paginationQuerySchema, toSkipTake } from '../lib/pagination';
import { resolveServiceToken } from '../lib/service-token';
import { ok, paginated } from '../lib/response';
import { validate } from '../lib/validate';
import { getSearch, getStorage } from '../providers';
import {
  addGrant,
  buildMediaSubject,
  listGrants,
  removeGrant,
  resolveAssetPermission,
  resolveFolderPermission,
  toSearchFilter,
} from '../repos/media-access.repo';
import {
  completeAsset,
  createAsset,
  deleteAsset,
  getAssetById,
  getAssetsByIds,
  listAssetsByFolder,
  listRenditions,
  putRendition,
  setAssetModeration,
  setAssetStatus,
  updateAsset,
} from '../repos/media-asset.repo';
import {
  addCollectionItem,
  createCollection,
  getCollection,
  listCollectionItemIds,
  listCollections,
  removeCollectionItem,
} from '../repos/media-collection.repo';
import {
  createFolder,
  deleteFolder,
  getFolder,
  getFolderTree,
  listChildFolders,
  updateFolder,
} from '../repos/media-folder.repo';
import {
  addAssetTags,
  expandTagSlugs,
  getTagBySlug,
  listTags,
  removeAssetTag,
  upsertTag,
} from '../repos/media-tag.repo';
import { writeAudit } from '../repos/audit.repo';
import { createTemplate, getTemplateByKey, listTemplates } from '../repos/document-template.repo';
import { enrichAsset } from '../services/media-enrich.service';
import { renderDocumentDocx } from '../services/media-render.service';
import { generateDocument } from '../services/media-generate-doc.service';
import { generateAudioAsset, generateImageAssets } from '../services/media-generate.service';
import { cancelMediaJob, getMediaJob, startMediaJob } from '../services/media-jobs';
import { parseNlQuery } from '../services/media-nl-query.service';
import { randomUUID } from 'node:crypto';

// ── Shared zod pieces ────────────────────────────────────────────────────────

const localized = z.record(z.string(), z.string()).refine((v) => Object.keys(v).length > 0, {
  message: 'at least one locale required',
});
const mediaKind = z.enum([
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'DOCUMENT',
  'ANIMATION',
  'FONT',
  'ARCHIVE',
  'OTHER',
]);
const scope = z.enum(['GLOBAL', 'ORG', 'CLASS', 'COMMUNITY', 'USER']);
const visibility = z.enum(['PRIVATE', 'SCOPE', 'PUBLIC']);
const permission = z.enum(['VIEW', 'USE', 'EDIT', 'MANAGE']);
const grantSubject = z.enum(['USER', 'ORG', 'TEAM', 'ROLE', 'SERVICE', 'PUBLIC']);
const tagKind = z.enum([
  'SUBJECT',
  'GRADE_BAND',
  'TOPIC',
  'STYLE',
  'LANGUAGE',
  'LICENSE',
  'AGE_RATING',
  'SOURCE',
  'ENTITY',
  'KEYWORD',
  'FORMAT',
]);

const CONTENT_ROLES = ['CONTENT_EDITOR', 'ADMIN'] as const;
/** The storage provider bytes are written to (same default as the storage registry). */
const ACTIVE_STORAGE = process.env.STORAGE_PROVIDER ?? 'r2';

/** Guard helper: 403 unless the effective permission satisfies `required`. */
function assertPermission(held: MediaPermission | null, required: MediaPermission) {
  if (!permissionSatisfies(held, required)) throw AppError.forbidden();
}

const moderateBody = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'FLAGGED']),
  reason: z.string().optional(),
});
/** Cap on one bulk-moderate call — each id is a write + an audit row. */
const BULK_MODERATE_MAX = 200;

/**
 * Record one moderation decision (single + bulk share this). Returns false when the
 * asset is gone. Approving a PROCESSING asset promotes it to READY and refreshes the
 * full enrichment — approval is what makes an asset deliverable (R5).
 */
async function applyModeration(
  assetId: string,
  decision: z.infer<typeof moderateBody>['decision'],
  reason: string | null,
  actorUserId: string,
): Promise<boolean> {
  const existing = await getAssetById(assetId);
  if (!existing) return false;
  await setAssetModeration(assetId, decision, reason);
  if (decision === 'APPROVED' && existing.status === 'PROCESSING')
    await setAssetStatus(assetId, 'READY');
  await writeAudit({
    action: 'media.asset.moderated',
    actorUserId,
    targetType: 'media_asset',
    targetId: assetId,
    metadata: { decision },
  });
  if (decision === 'APPROVED') {
    void enrichAsset(assetId).catch((e) => console.error('[media] post-approve enrich failed', e));
  }
  return true;
}

// ── Router ───────────────────────────────────────────────────────────────────

/**
 * Media library (docs/media-library-design.md). Server-enforced access on every
 * route (R1/R6): folder/asset permissions via resolveFolder/AssetPermission,
 * platform CONTENT_EDITOR/ADMIN for taxonomy + root folders, MODERATOR for
 * moderation. Bytes are never exposed as keys — only signed/public URLs (R1).
 */
export const media = new Hono<AppEnv>()

  // ── Folders ────────────────────────────────────────────────────────────────
  .post(
    '/folders',
    requireAuth,
    validate(
      'json',
      z.object({
        name: localized,
        parentId: z.string().optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        visibility: visibility.optional(),
        description: localized.optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);

      if (body.parentId) {
        assertPermission(await resolveFolderPermission(subject, body.parentId), 'EDIT');
      } else if (!hasAnyRole(user.role, CONTENT_ROLES)) {
        throw AppError.forbidden('Only content editors can create root folders');
      }

      const folder = await createFolder({
        name: body.name,
        parentId: body.parentId ?? null,
        scope: body.scope,
        scopeId: body.scopeId ?? null,
        visibility: body.visibility,
        description: body.description,
        createdById: user.id,
      });
      await writeAudit({
        action: 'media.folder.created',
        actorUserId: user.id,
        targetType: 'media_folder',
        targetId: folder.id,
      });
      return ok(c, folder, 201);
    },
  )

  // List folders at one level of the tree: no `parentId` → roots; with
  // `parentId` → that folder's direct children. Enables lazy tree navigation
  // (the tree endpoint needs a starting id; this is how the client gets roots).
  // Access-filtered per folder to VIEW, matching resolveFolderPermission — a
  // caller only ever sees folders they may view (staff see all via the floor).
  .get(
    '/folders',
    requireAuth,
    validate('query', z.object({ parentId: z.string().optional() })),
    async (c) => {
      const user = c.get('user')!;
      const { parentId } = c.req.valid('query');
      const subject = await buildMediaSubject(user);
      const candidates = await listChildFolders(parentId ?? null);
      const visible = [];
      for (const folder of candidates) {
        const perm = await resolveFolderPermission(subject, folder.id);
        if (permissionSatisfies(perm, 'VIEW')) visible.push(folder);
      }
      return ok(c, visible);
    },
  )

  .get('/folders/:folderId', requireAuth, async (c) => {
    const user = c.get('user')!;
    const folderId = c.req.param('folderId');
    const subject = await buildMediaSubject(user);
    assertPermission(await resolveFolderPermission(subject, folderId), 'VIEW');
    const folder = await getFolder(folderId);
    if (!folder) throw AppError.notFound();
    return ok(c, folder);
  })

  .get('/folders/:folderId/tree', requireAuth, async (c) => {
    const user = c.get('user')!;
    const folderId = c.req.param('folderId');
    const subject = await buildMediaSubject(user);
    assertPermission(await resolveFolderPermission(subject, folderId), 'VIEW');
    return ok(c, await getFolderTree(folderId));
  })

  .get(
    '/folders/:folderId/assets',
    requireAuth,
    validate('query', paginationQuerySchema),
    async (c) => {
      const user = c.get('user')!;
      const folderId = c.req.param('folderId');
      const params = c.req.valid('query');
      const subject = await buildMediaSubject(user);
      assertPermission(await resolveFolderPermission(subject, folderId), 'VIEW');
      const { skip, take } = toSkipTake(params);
      const [items, total] = await listAssetsByFolder(folderId, skip, take);
      const serialized = await Promise.all(items.map((a) => serializeAsset(a, false)));
      return paginated(c, serialized, paginationMeta(params, total));
    },
  )

  .patch(
    '/folders/:folderId',
    requireAuth,
    validate(
      'json',
      z.object({
        name: localized.optional(),
        description: localized.optional(),
        visibility: visibility.optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const folderId = c.req.param('folderId');
      const subject = await buildMediaSubject(user);
      assertPermission(await resolveFolderPermission(subject, folderId), 'EDIT');
      const folder = await updateFolder(folderId, c.req.valid('json'));
      return ok(c, folder);
    },
  )

  .delete('/folders/:folderId', requireAuth, async (c) => {
    const user = c.get('user')!;
    const folderId = c.req.param('folderId');
    const subject = await buildMediaSubject(user);
    assertPermission(await resolveFolderPermission(subject, folderId), 'MANAGE');
    const result = await deleteFolder(folderId);
    if (!result.ok) throw AppError.conflict(result.reason);
    await writeAudit({
      action: 'media.folder.deleted',
      actorUserId: user.id,
      targetType: 'media_folder',
      targetId: folderId,
    });
    return ok(c, { deleted: true });
  })

  .post(
    '/folders/:folderId/grants',
    requireAuth,
    validate(
      'json',
      z.object({
        subjectType: grantSubject,
        subjectId: z.string().optional(),
        permission,
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const folderId = c.req.param('folderId');
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);
      assertPermission(await resolveFolderPermission(subject, folderId), 'MANAGE');
      const grant = await addGrant({
        folderId,
        ...body,
        subjectId: body.subjectId ?? null,
        createdById: user.id,
      });
      await writeAudit({
        action: 'media.folder.grant_added',
        actorUserId: user.id,
        targetType: 'media_folder',
        targetId: folderId,
        metadata: { ...body },
      });
      return ok(c, grant, 201);
    },
  )

  .get('/folders/:folderId/grants', requireAuth, async (c) => {
    const user = c.get('user')!;
    const folderId = c.req.param('folderId');
    const subject = await buildMediaSubject(user);
    assertPermission(await resolveFolderPermission(subject, folderId), 'MANAGE');
    return ok(c, await listGrants({ folderId }));
  })

  // ── Assets ───────────────────────────────────────────────────────────────
  .post(
    '/assets',
    requireAuth,
    validate(
      'json',
      z.object({
        kind: mediaKind,
        title: localized,
        description: localized.optional(),
        folderId: z.string().optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        visibility: visibility.optional(),
        mimeType: z.string().optional(),
        locale: z.string().optional(),
        license: z.string().optional(),
        ageRating: z.string().optional(),
        source: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);

      if (body.folderId) {
        assertPermission(await resolveFolderPermission(subject, body.folderId), 'EDIT');
      } else if (!hasAnyRole(user.role, CONTENT_ROLES)) {
        throw AppError.forbidden('Only content editors can create unfiled assets');
      }

      const asset = await createAsset({
        kind: body.kind,
        title: body.title,
        description: body.description,
        folderId: body.folderId ?? null,
        scope: body.scope,
        scopeId: body.scopeId ?? null,
        visibility: body.visibility,
        mimeType: body.mimeType ?? null,
        locale: body.locale ?? null,
        license: body.license ?? null,
        ageRating: body.ageRating ?? null,
        source: body.source ?? null,
        createdById: user.id,
        moderation: initialModeration(user.role),
      });

      // Presigned direct-to-storage upload for the ORIGINAL (R1: client PUTs bytes,
      // never learns credentials). Record the rendition slot now.
      const key = renditionStorageKey(
        asset.scope,
        asset.scopeId,
        asset.id,
        'original',
        extForMime(body.mimeType),
      );
      const upload = await getStorage().createSignedUploadUrl({ key, contentType: body.mimeType });
      await putRendition(asset.id, {
        kind: 'ORIGINAL',
        provider: ACTIVE_STORAGE,
        storageKey: key,
        mimeType: body.mimeType ?? null,
      });
      await setAssetStatus(asset.id, 'UPLOADING');
      await writeAudit({
        action: 'media.asset.created',
        actorUserId: user.id,
        targetType: 'media_asset',
        targetId: asset.id,
      });

      return ok(c, { asset, upload: { url: upload.url, key, method: 'PUT' } }, 201);
    },
  )

  .post(
    '/assets/:assetId/complete',
    requireAuth,
    validate(
      'json',
      z.object({
        byteSize: z.number().int().nonnegative().optional(),
        checksum: z.string().optional(),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        durationMs: z.number().int().nonnegative().optional(),
        pageCount: z.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const { subject, asset } = await loadAssetForAccess(c, 'EDIT');
      const meta = c.req.valid('json');
      const updated = await completeAsset(asset.id, meta);
      if (meta.checksum || meta.byteSize) {
        await putRendition(asset.id, {
          kind: 'ORIGINAL',
          provider: ACTIVE_STORAGE,
          storageKey: asset.renditions.find((r) => r.kind === 'ORIGINAL')?.storageKey ?? null,
          checksum: meta.checksum ?? null,
          byteSize: meta.byteSize ?? null,
        });
      }
      await writeAudit({
        action: 'media.asset.uploaded',
        actorUserId: subject.userId,
        targetType: 'media_asset',
        targetId: asset.id,
      });
      // Auto-index the semantic embedding off the critical path (embed-only = fast).
      void enrichAsset(asset.id, { embedOnly: true }).catch((e) =>
        console.error('[media] auto-enrich failed', e),
      );
      return ok(c, updated);
    },
  )

  .get('/assets/:assetId', requireAuth, async (c) => {
    const { asset } = await loadAssetForAccess(c, 'VIEW');
    return ok(c, await serializeAsset(asset, true));
  })

  .patch(
    '/assets/:assetId',
    requireAuth,
    validate(
      'json',
      z.object({
        title: localized.optional(),
        description: localized.optional(),
        altText: localized.optional(),
        folderId: z.string().nullable().optional(),
        visibility: visibility.optional(),
        license: z.string().nullable().optional(),
        ageRating: z.string().nullable().optional(),
        locale: z.string().nullable().optional(),
      }),
    ),
    async (c) => {
      const { asset, subject } = await loadAssetForAccess(c, 'EDIT');
      const body = c.req.valid('json');
      // Moving into a folder needs EDIT on the destination too.
      if (body.folderId)
        assertPermission(await resolveFolderPermission(subject, body.folderId), 'EDIT');
      const updated = await updateAsset(asset.id, body);
      return ok(c, updated);
    },
  )

  .delete('/assets/:assetId', requireAuth, async (c) => {
    const { asset, subject } = await loadAssetForAccess(c, 'MANAGE');
    // Remove physical bytes first (best-effort), then the row (cascades renditions).
    for (const r of await listRenditions(asset.id)) {
      if (r.storageKey) {
        try {
          await getStorage(r.provider ?? undefined).deleteObject(r.storageKey);
        } catch (err) {
          console.error('[media] failed to delete object', r.storageKey, err);
        }
      }
    }
    await deleteAsset(asset.id);
    await writeAudit({
      action: 'media.asset.deleted',
      actorUserId: subject.userId,
      targetType: 'media_asset',
      targetId: asset.id,
    });
    return ok(c, { deleted: true });
  })

  .post(
    '/assets/:assetId/tags',
    requireAuth,
    validate(
      'json',
      z
        .object({
          slugs: z.array(z.string()).optional(),
          tagIds: z.array(z.string()).optional(),
        })
        .refine(
          (b) => (b.slugs?.length ?? 0) + (b.tagIds?.length ?? 0) > 0,
          'provide slugs or tagIds',
        ),
    ),
    async (c) => {
      const { asset, subject } = await loadAssetForAccess(c, 'EDIT');
      const body = c.req.valid('json');
      let tagIds = body.tagIds ?? [];
      if (body.slugs?.length) {
        const tags = await Promise.all(body.slugs.map((s) => getTagBySlug(s)));
        const missing = body.slugs.filter((_, i) => !tags[i]);
        if (missing.length) throw AppError.badRequest(`unknown tag slugs: ${missing.join(', ')}`);
        tagIds = [...tagIds, ...tags.map((t) => t!.id)];
      }
      const keywords = await addAssetTags({
        assetId: asset.id,
        tagIds,
        source: 'MANUAL',
        addedById: subject.userId,
      });
      return ok(c, { keywords });
    },
  )

  .delete('/assets/:assetId/tags/:tagId', requireAuth, async (c) => {
    const { asset } = await loadAssetForAccess(c, 'EDIT');
    const keywords = await removeAssetTag(asset.id, c.req.param('tagId'));
    return ok(c, { keywords });
  })

  // Export a DOCUMENT to DOCX — a derived rendition from the canonical Markdown.
  .post('/assets/:assetId/renditions/docx', requireAuth, async (c) => {
    const { asset, subject } = await loadAssetForAccess(c, 'EDIT');
    if (asset.kind !== 'DOCUMENT') throw AppError.badRequest('Only DOCUMENT assets export to DOCX');
    await renderDocumentDocx(asset.id);
    await writeAudit({
      action: 'media.asset.rendered',
      actorUserId: subject.userId,
      targetType: 'media_asset',
      targetId: asset.id,
      metadata: { format: 'docx' },
    });
    const full = await getAssetById(asset.id);
    return ok(c, full && (await serializeAsset(full, true)), 201);
  })

  // Enrichment (M2): (re)compute the semantic embedding + AI suggestions. Off the
  // upload path; suggestions are stashed, not published (R5).
  .post(
    '/assets/:assetId/enrich',
    requireAuth,
    validate('json', z.object({ force: z.boolean().optional() })),
    async (c) => {
      const { asset, subject } = await loadAssetForAccess(c, 'EDIT');
      const result = await enrichAsset(asset.id, { force: c.req.valid('json').force });
      await writeAudit({
        action: 'media.asset.enriched',
        actorUserId: subject.userId,
        targetType: 'media_asset',
        targetId: asset.id,
        metadata: { ...result },
      });
      return ok(c, result);
    },
  )

  .post(
    '/assets/:assetId/grants',
    requireAuth,
    validate(
      'json',
      z.object({
        subjectType: grantSubject,
        subjectId: z.string().optional(),
        permission,
      }),
    ),
    async (c) => {
      const { asset, subject } = await loadAssetForAccess(c, 'MANAGE');
      const body = c.req.valid('json');
      const grant = await addGrant({
        assetId: asset.id,
        ...body,
        subjectId: body.subjectId ?? null,
        createdById: subject.userId,
      });
      await writeAudit({
        action: 'media.asset.grant_added',
        actorUserId: subject.userId,
        targetType: 'media_asset',
        targetId: asset.id,
        metadata: { ...body },
      });
      return ok(c, grant, 201);
    },
  )

  .get('/assets/:assetId/grants', requireAuth, async (c) => {
    const { asset } = await loadAssetForAccess(c, 'MANAGE');
    return ok(c, await listGrants({ assetId: asset.id }));
  })

  .delete('/assets/:assetId/grants/:grantId', requireAuth, async (c) => {
    const { subject } = await loadAssetForAccess(c, 'MANAGE');
    await removeGrant(c.req.param('grantId'));
    await writeAudit({
      action: 'media.asset.grant_removed',
      actorUserId: subject.userId,
      targetType: 'media_grant',
      targetId: c.req.param('grantId'),
    });
    return ok(c, { removed: true });
  })

  // Moderation — platform MODERATOR/ADMIN only (R5). Gates child-facing delivery.
  .post('/assets/:assetId/moderate', requireAuth, validate('json', moderateBody), async (c) => {
    const user = c.get('user')!;
    if (!hasAnyRole(user.role, MODERATION_ROLES)) throw AppError.forbidden();
    const assetId = c.req.param('assetId');
    const body = c.req.valid('json');
    const applied = await applyModeration(assetId, body.decision, body.reason ?? null, user.id);
    if (!applied) throw AppError.notFound();
    const fresh = await getAssetById(assetId);
    if (!fresh) throw AppError.notFound();
    return ok(c, await serializeAsset(fresh, true));
  })

  // Bulk moderation — the same decision over a selection. Unknown ids are skipped
  // rather than failing the batch (the grid's selection can outlive a delete).
  .post(
    '/assets/moderate-bulk',
    requireAuth,
    validate(
      'json',
      moderateBody.extend({ assetIds: z.array(z.string()).min(1).max(BULK_MODERATE_MAX) }),
    ),
    async (c) => {
      const user = c.get('user')!;
      if (!hasAnyRole(user.role, MODERATION_ROLES)) throw AppError.forbidden();
      const body = c.req.valid('json');
      let moderated = 0;
      for (const assetId of new Set(body.assetIds)) {
        if (await applyModeration(assetId, body.decision, body.reason ?? null, user.id))
          moderated++;
      }
      return ok(c, { moderated, decision: body.decision });
    },
  )

  // ── AI generation (images → openai, audio → elevenlabs) ────────────────────
  // Generated assets are invisible to children until approved (R5); they land
  // PENDING unless the generator may already approve (see `initialModeration`).
  // Access mirrors asset creation: EDIT on the target folder, or platform
  // CONTENT_EDITOR/ADMIN for unfiled assets.
  //
  // ASYNC: an OpenAI image / ElevenLabs audio call runs ~15–30s. Held synchronously
  // that outlives the Next dev proxy's socket → the client sees "Internal Server
  // Error" even though the asset finished and landed in the library. So we kick the
  // work off as a background JOB (see media-jobs.ts), return 202 + jobId immediately,
  // and let the client POLL /generate/job/:id until 'done' then read `result`.
  // Permission is checked SYNCHRONOUSLY here (before starting the job) so an
  // unauthorized request fails fast and never spends a provider call.
  .post(
    '/generate/image',
    requireAuth,
    validate(
      'json',
      z.object({
        prompt: z.string().min(1).max(1000),
        size: z.string().optional(),
        count: z.number().int().min(1).max(4).optional(),
        folderId: z.string().optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        visibility: visibility.optional(),
        title: localized.optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);
      if (body.folderId)
        assertPermission(await resolveFolderPermission(subject, body.folderId), 'EDIT');
      else if (!hasAnyRole(user.role, CONTENT_ROLES))
        throw AppError.forbidden('Only content editors can generate unfiled assets');

      const job = startMediaJob('image', randomUUID(), async (signal) => {
        const assets = await generateImageAssets({
          ...body,
          folderId: body.folderId ?? null,
          scopeId: body.scopeId ?? null,
          createdById: user.id,
          createdByRole: user.role,
          signal,
        });
        for (const a of assets) {
          await writeAudit({
            action: 'media.asset.generated',
            actorUserId: user.id,
            targetType: 'media_asset',
            targetId: a.id,
            metadata: { kind: 'IMAGE', provider: 'openai' },
          });
        }
        const serialized = await Promise.all(
          assets.map((a) => getAssetById(a.id).then((full) => full && serializeAsset(full, true))),
        );
        return { count: assets.length, assets: serialized.filter(Boolean) };
      });
      return ok(c, job, 202);
    },
  )

  .post(
    '/generate/audio',
    requireAuth,
    validate(
      'json',
      z.object({
        text: z.string().min(1).max(5000),
        voice: z.string().optional(),
        languageCode: z.string().optional(),
        folderId: z.string().optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        visibility: visibility.optional(),
        title: localized.optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);
      if (body.folderId)
        assertPermission(await resolveFolderPermission(subject, body.folderId), 'EDIT');
      else if (!hasAnyRole(user.role, CONTENT_ROLES))
        throw AppError.forbidden('Only content editors can generate unfiled assets');

      const job = startMediaJob('audio', randomUUID(), async (signal) => {
        const asset = await generateAudioAsset({
          ...body,
          folderId: body.folderId ?? null,
          scopeId: body.scopeId ?? null,
          createdById: user.id,
          createdByRole: user.role,
          signal,
        });
        await writeAudit({
          action: 'media.asset.generated',
          actorUserId: user.id,
          targetType: 'media_asset',
          targetId: asset.id,
          metadata: { kind: 'AUDIO', provider: 'elevenlabs' },
        });
        const full = await getAssetById(asset.id);
        return full && (await serializeAsset(full, true));
      });
      return ok(c, job, 202);
    },
  )

  // Poll a media-gen job. 404 if the id is unknown (job registry is in-memory, so a
  // server restart drops it — the client then falls back to searching the library).
  .get('/generate/job/:id', requireAuth, (c) => {
    const job = getMediaJob(c.req.param('id'));
    if (!job) throw AppError.notFound('Không có job sinh media với id này.');
    return ok(c, job);
  })

  // Cancel a running media-gen job (aborts the provider call for real).
  .post('/generate/job/:id/cancel', requireAuth, (c) => {
    const job = cancelMediaJob(c.req.param('id'));
    if (!job) throw AppError.notFound('Không có job để hủy.');
    return ok(c, job);
  })

  // ── Document templates + high-quality doc generation ──────────────────────
  .post(
    '/templates',
    requireAuth,
    validate(
      'json',
      z.object({
        key: z.string().min(1).max(80),
        name: localized,
        description: localized.optional(),
        docKind: z.string().min(1).max(40),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        locale: z.string().optional(),
        sections: z
          .array(
            z.object({
              key: z.string().min(1),
              title: localized,
              instruction: z.string().min(1),
              required: z.boolean().optional(),
              repeatable: z.boolean().optional(),
            }),
          )
          .min(1),
        style: z
          .object({
            tone: z.string().optional(),
            gradeBand: z.string().optional(),
            length: z.string().optional(),
          })
          .optional(),
        rubric: z.array(z.string()).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      if (!hasAnyRole(user.role, CONTENT_ROLES)) throw AppError.forbidden();
      const body = c.req.valid('json');
      const tpl = await createTemplate({
        ...body,
        scopeId: body.scopeId ?? null,
        createdById: user.id,
      });
      await writeAudit({
        action: 'media.template.created',
        actorUserId: user.id,
        targetType: 'document_template',
        targetId: tpl.id,
      });
      return ok(c, tpl, 201);
    },
  )

  .get(
    '/templates',
    requireAuth,
    validate('query', z.object({ docKind: z.string().optional() })),
    async (c) => ok(c, await listTemplates({ docKind: c.req.valid('query').docKind })),
  )

  .get('/templates/:key', requireAuth, async (c) => {
    const tpl = await getTemplateByKey(c.req.param('key'));
    if (!tpl) throw AppError.notFound();
    return ok(c, tpl);
  })

  // Generate a document from a template (structured → rubric-verified → Markdown).
  .post(
    '/generate/document',
    requireAuth,
    validate(
      'json',
      z.object({
        templateKey: z.string().min(1),
        inputs: z.object({
          topic: z.string().min(1).max(500),
          gradeBand: z.string().optional(),
          notes: z.string().max(2000).optional(),
          locale: z.string().optional(),
        }),
        folderId: z.string().optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        visibility: visibility.optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      const subject = await buildMediaSubject(user);
      if (body.folderId)
        assertPermission(await resolveFolderPermission(subject, body.folderId), 'EDIT');
      else if (!hasAnyRole(user.role, CONTENT_ROLES))
        throw AppError.forbidden('Only content editors can generate unfiled assets');

      const result = await generateDocument({
        ...body,
        folderId: body.folderId ?? null,
        scopeId: body.scopeId ?? null,
        createdById: user.id,
        createdByRole: user.role,
      });
      await writeAudit({
        action: 'media.asset.generated',
        actorUserId: user.id,
        targetType: 'media_asset',
        targetId: result.assetId,
        metadata: {
          kind: 'DOCUMENT',
          templateKey: body.templateKey,
          quality: result.quality.score,
        },
      });
      const full = await getAssetById(result.assetId);
      return ok(
        c,
        { asset: full && (await serializeAsset(full, true)), quality: result.quality },
        201,
      );
    },
  )

  // ── Tags (taxonomy) ────────────────────────────────────────────────────────
  .post(
    '/tags',
    requireAuth,
    validate(
      'json',
      z.object({
        slug: z.string().optional(),
        kind: tagKind,
        label: localized,
        description: localized.optional(),
        parentId: z.string().optional(),
        externalRef: z.string().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      if (!hasAnyRole(user.role, CONTENT_ROLES)) throw AppError.forbidden();
      const tag = await upsertTag(c.req.valid('json'));
      return ok(c, tag, 201);
    },
  )

  .get(
    '/tags',
    requireAuth,
    validate('query', z.object({ kind: tagKind.optional() })),
    async (c) => {
      return ok(c, await listTags(c.req.valid('query').kind));
    },
  )

  .get('/tags/:slug', requireAuth, async (c) => {
    const tag = await getTagBySlug(c.req.param('slug'));
    if (!tag) throw AppError.notFound();
    return ok(c, tag);
  })

  // ── Collections (virtual grouping) ───────────────────────────────────────
  .post(
    '/collections',
    requireAuth,
    validate(
      'json',
      z.object({
        name: localized,
        description: localized.optional(),
        scope: scope.optional(),
        scopeId: z.string().optional(),
        isSmart: z.boolean().optional(),
        query: z.record(z.string(), z.unknown()).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const body = c.req.valid('json');
      if ((body.scope ?? 'GLOBAL') === 'GLOBAL' && !hasAnyRole(user.role, CONTENT_ROLES)) {
        throw AppError.forbidden('Only content editors can create global collections');
      }
      const collection = await createCollection({
        name: body.name,
        description: body.description,
        scope: body.scope,
        scopeId: body.scopeId ?? null,
        isSmart: body.isSmart,
        query: body.query as never,
        createdById: user.id,
      });
      return ok(c, collection, 201);
    },
  )

  .get('/collections', requireAuth, async (c) => ok(c, await listCollections()))

  .get('/collections/:collectionId', requireAuth, async (c) => {
    const collection = await getCollection(c.req.param('collectionId'));
    if (!collection) throw AppError.notFound();
    return ok(c, collection);
  })

  .get('/collections/:collectionId/items', requireAuth, async (c) => {
    const user = c.get('user');
    const collection = await getCollection(c.req.param('collectionId'));
    if (!collection) throw AppError.notFound();
    const subject = await buildMediaSubject(user);

    let ids: string[];
    if (collection.isSmart && collection.query) {
      // Smart collection: resolve its stored DSL live, under the caller's access.
      const q = collection.query as Record<string, unknown>;
      const result = await getSearch().query(q, toSearchFilter(subject));
      ids = result.hits.map((h) => h.assetId);
    } else {
      ids = await listCollectionItemIds(collection.id);
    }
    const assets = await getAssetsByIds(ids);
    const byId = new Map(assets.map((a) => [a.id, a]));
    const ordered = await Promise.all(
      ids
        .map((id) => byId.get(id))
        .filter((a): a is NonNullable<typeof a> => Boolean(a))
        .map((a) => serializeAsset(a, false)),
    );
    return ok(c, {
      collection: { id: collection.id, name: collection.name, isSmart: collection.isSmart },
      items: ordered,
    });
  })

  .post(
    '/collections/:collectionId/items',
    requireAuth,
    validate(
      'json',
      z.object({
        assetId: z.string(),
        position: z.number().int().nonnegative().optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user')!;
      const collection = await getCollection(c.req.param('collectionId'));
      if (!collection) throw AppError.notFound();
      if (collection.isSmart) throw AppError.badRequest('Cannot add items to a smart collection');
      if (collection.createdById !== user.id && !hasAnyRole(user.role, CONTENT_ROLES))
        throw AppError.forbidden();
      const body = c.req.valid('json');
      const item = await addCollectionItem(
        collection.id,
        body.assetId,
        user.id,
        body.position ?? 0,
      );
      return ok(c, item, 201);
    },
  )

  .delete('/collections/:collectionId/items/:assetId', requireAuth, async (c) => {
    const user = c.get('user')!;
    const collection = await getCollection(c.req.param('collectionId'));
    if (!collection) throw AppError.notFound();
    if (collection.createdById !== user.id && !hasAnyRole(user.role, CONTENT_ROLES))
      throw AppError.forbidden();
    await removeCollectionItem(collection.id, c.req.param('assetId'));
    return ok(c, { removed: true });
  })

  // ── RAG retrieval (LLM/downstream consumer) ───────────────────────────────
  // Compact, APPROVED-only manifest for the AI layer to ground generation on
  // (R5: only moderated assets; access still enforced via the subject filter).
  .post(
    '/rag/retrieve',
    validate(
      'json',
      z.object({
        text: z.string().optional(),
        kind: z.array(mediaKind).optional(),
        anyTags: z.array(z.string()).optional(),
        allTags: z.array(z.string()).optional(),
        locale: z.string().optional(),
        limit: z.number().int().min(1).max(50).optional(),
      }),
    ),
    async (c) => {
      // Two ways in: a user session OR a service token (the AI/RAG layer, §7).
      const user = c.get('user');
      const serviceKey = resolveServiceToken(c.req.header('x-service-token'));
      if (!user && !serviceKey) throw AppError.unauthorized();
      const query = c.req.valid('json');
      const subject = await buildMediaSubject(user, serviceKey);
      // Force APPROVED regardless of staff (LLM output feeds children, R5).
      const filter = toSearchFilter(subject);
      filter.moderation = ['APPROVED'];
      if (query.anyTags?.length) query.anyTags = await expandTagSlugs(query.anyTags);
      const result = await getSearch().query(query, filter);
      const assets = await getAssetsByIds(result.hits.map((h) => h.assetId));
      const byId = new Map(assets.map((a) => [a.id, a]));
      const manifest = await Promise.all(
        result.hits.map(async (h) => {
          const a = byId.get(h.assetId);
          if (!a) return null;
          const serialized = await serializeAsset(a, false);
          return {
            assetId: a.id,
            publicId: a.publicId,
            kind: a.kind,
            title: a.title,
            description: a.description,
            altText: a.altText,
            tags: a.keywords,
            score: h.score,
            url: serialized.renditions[0]?.url ?? null,
          };
        }),
      );
      return ok(c, { mode: result.mode, results: manifest.filter(Boolean) });
    },
  )

  // ── Search (hybrid) ──────────────────────────────────────────────────────
  .post(
    '/search',
    validate(
      'json',
      z.object({
        text: z.string().optional(),
        mode: z.enum(['auto', 'lexical', 'semantic', 'hybrid']).optional(),
        kind: z.array(mediaKind).optional(),
        anyTags: z.array(z.string()).optional(),
        allTags: z.array(z.string()).optional(),
        locale: z.string().optional(),
        license: z.array(z.string()).optional(),
        ageRating: z.array(z.string()).optional(),
        folderId: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
        /** Staff-only facet — powers the admin library's status filter + review queue. */
        moderation: z
          .array(z.enum(['PENDING', 'APPROVED', 'REJECTED', 'FLAGGED']))
          .min(1)
          .optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user'); // search is available to anonymous (PUBLIC only)
      const { moderation, ...query } = c.req.valid('json');
      const subject = await buildMediaSubject(user);
      const filter = toSearchFilter(subject);
      // Narrow the moderation facet only for staff — for everyone else the filter is
      // already pinned to APPROVED (R5) and a request must never widen it.
      if (moderation && filter.staff) filter.moderation = moderation;

      // Widen tag facets via ALIAS/BROADER for recall (§3.6) before compiling SQL.
      if (query.anyTags?.length) query.anyTags = await expandTagSlugs(query.anyTags);

      const result = await getSearch().query(query, filter);
      // Hydrate in the fused order; re-serialize (list view — thumbnail only).
      const assets = await getAssetsByIds(result.hits.map((h) => h.assetId));
      const byId = new Map(assets.map((a) => [a.id, a]));
      const ordered = await Promise.all(
        result.hits
          .map((h) => byId.get(h.assetId))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map((a) => serializeAsset(a, false)),
      );
      return ok(c, { mode: result.mode, hits: ordered });
    },
  )

  // ── Natural-language search ────────────────────────────────────────────────
  // A single sentence ("tìm các ảnh liên quan đến chủ đề phòng cháy chữa cháy")
  // → the LLM extracts a structured MediaSearchQuery, then the SAME hybrid search
  // runs. Anonymous-allowed (PUBLIC only). `query` is echoed back for transparency.
  .post(
    '/search/nl',
    validate(
      'json',
      z.object({
        q: z.string().min(1).max(500),
        limit: z.number().int().min(1).max(100).optional(),
      }),
    ),
    async (c) => {
      const user = c.get('user');
      const { q, limit } = c.req.valid('json');
      const subject = await buildMediaSubject(user);

      const query = await parseNlQuery(q);
      if (limit) query.limit = limit;
      if (query.anyTags?.length) query.anyTags = await expandTagSlugs(query.anyTags);

      const result = await getSearch().query(query, toSearchFilter(subject));
      const assets = await getAssetsByIds(result.hits.map((h) => h.assetId));
      const byId = new Map(assets.map((a) => [a.id, a]));
      const ordered = await Promise.all(
        result.hits
          .map((h) => byId.get(h.assetId))
          .filter((a): a is NonNullable<typeof a> => Boolean(a))
          .map((a) => serializeAsset(a, false)),
      );
      return ok(c, { query, mode: result.mode, hits: ordered });
    },
  );

// ── Access helper ─────────────────────────────────────────────────────────

/**
 * Load an asset + its full access facts, 404 if absent, 403 unless the caller's
 * effective permission satisfies `required`. Returns the asset (with renditions +
 * tags) and the resolved subject for downstream audit/writes.
 */
async function loadAssetForAccess(c: Context<AppEnv>, required: MediaPermission) {
  const user = c.get('user');
  const assetId = c.req.param('assetId');
  if (!assetId) throw AppError.badRequest('Missing asset id');
  const asset = await getAssetById(assetId);
  if (!asset) throw AppError.notFound();
  const subject = await buildMediaSubject(user);
  const perm = await resolveAssetPermission(subject, asset.id, {
    ownerId: asset.ownerId,
    visibility: asset.visibility,
    moderation: asset.moderation,
    status: asset.status,
    scope: asset.scope,
    scopeId: asset.scopeId,
    folderId: asset.folderId,
  });
  assertPermission(perm, required);
  return { asset, subject, permission: perm };
}
