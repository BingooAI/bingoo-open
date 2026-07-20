import type { MediaScope } from '@bingoo/db'
import { getStorage } from '../providers'

/**
 * Storage key layout for a rendition (invariant M3 — server-only, R1):
 *   media/{scope}/{scopeId|global}/{assetId}/{rendition}[.ext]
 * Stable + scoped so a whole tenant's bytes can be listed/moved/backed-up by
 * prefix (the user's backup/restore/move requirement).
 */
export function renditionStorageKey(
  scope: MediaScope,
  scopeId: string | null,
  assetId: string,
  rendition: string,
  ext?: string,
): string {
  const tenant = scopeId ?? 'global'
  const suffix = ext ? `.${ext.replace(/^\./, '')}` : ''
  return `media/${scope.toLowerCase()}/${tenant}/${assetId}/${rendition}${suffix}`
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'application/pdf': 'pdf',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}

export function extForMime(mime?: string | null): string | undefined {
  return mime ? EXT_BY_MIME[mime] : undefined
}

interface RenditionRow {
  kind: string
  provider: string | null
  storageKey: string | null
  videoId: string | null
  url: string | null
  mimeType: string | null
  width: number | null
  height: number | null
}

/** Resolve a viewable URL for a rendition: an external url, a public bucket URL,
 *  else a short-lived signed download URL. Never leaks the raw storage key. */
export async function renditionUrl(r: RenditionRow): Promise<string | null> {
  if (r.url) return r.url
  if (!r.storageKey) return null
  const storage = getStorage(r.provider ?? undefined)
  const publicUrl = storage.getPublicUrl(r.storageKey)
  if (publicUrl) return publicUrl
  const signed = await storage.createSignedDownloadUrl({ key: r.storageKey })
  return signed.url
}

interface SerializableAsset {
  id: string
  publicId: string
  kind: string
  status: string
  moderation: string
  moderationReason: string | null
  title: unknown
  description: unknown
  altText: unknown
  folderId: string | null
  scope: string
  scopeId: string | null
  visibility: string
  mimeType: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  locale: string | null
  license: string | null
  ageRating: string | null
  keywords: string[]
  createdAt: Date
  renditions?: RenditionRow[]
  tags?: { tag: { slug: string; kind: string; label: unknown } }[]
}

/**
 * Public-facing asset DTO. Renditions are turned into URLs (never keys, R1). Pass
 * `signed=false` for list views to skip signing every rendition (only the thumbnail
 * is resolved) — the user's requirement that a result page signs lazily (§4.3).
 */
// Preference order for the single rendition a list view resolves: a cheap
// thumbnail if one exists, else progressively fall back so the client always gets
// a viewable URL (assets without a derived thumbnail — e.g. freshly AI-generated —
// otherwise serialise with no URL at all).
const LIST_RENDITION_ORDER = ['THUMBNAIL', 'PREVIEW', 'OPTIMIZED', 'ORIGINAL'] as const

export async function serializeAsset(asset: SerializableAsset, signed = true) {
  const renditions = asset.renditions ?? []
  let chosen: RenditionRow[]
  if (signed) {
    chosen = renditions
  } else {
    const best = LIST_RENDITION_ORDER.map((k) => renditions.find((r) => r.kind === k)).find(
      (r): r is RenditionRow => Boolean(r),
    )
    chosen = best ? [best] : []
  }

  const withUrls = await Promise.all(
    chosen.map(async (r) => ({
      kind: r.kind,
      mimeType: r.mimeType,
      width: r.width,
      height: r.height,
      url: await renditionUrl(r),
    })),
  )

  return {
    id: asset.id,
    publicId: asset.publicId,
    kind: asset.kind,
    status: asset.status,
    moderation: asset.moderation,
    moderationReason: asset.moderationReason,
    title: asset.title,
    description: asset.description,
    altText: asset.altText,
    folderId: asset.folderId,
    scope: asset.scope,
    scopeId: asset.scopeId,
    visibility: asset.visibility,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
    locale: asset.locale,
    license: asset.license,
    ageRating: asset.ageRating,
    keywords: asset.keywords,
    createdAt: asset.createdAt,
    renditions: withUrls,
    tags: asset.tags?.map((t) => ({ slug: t.tag.slug, kind: t.tag.kind, label: t.tag.label })),
  }
}
