/**
 * Client-facing API DTOs — the shape the backend actually serializes to the wire
 * (apps/api/src/lib/media-serialize.ts + the route handlers), NOT the raw Prisma
 * rows. Domain enums/unions are imported from @bingoo.ai/core (the shared, client-
 * safe contract) so they never drift. Keep these in sync with the API; there is
 * no generated client yet.
 */
import type {
  GrantSubjectType,
  LocalizedText,
  MediaKind,
  MediaPermission,
  MediaScope,
  MediaStatus,
  MediaVisibility,
  ModerationStatus,
  TagKind,
} from '@bingoo.ai/core'

/** Response envelope from the API (apps/api/src/lib/response.ts). */
export interface ApiEnvelope<T> {
  data: T
  meta?: PageMeta
}
export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string; details?: unknown }
}
export interface PageMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** A single physical/derived output of an asset (client subset — never storageKey). */
export interface Rendition {
  kind: string
  mimeType: string | null
  width: number | null
  height: number | null
  url: string | null
}

/** Serialized media asset (serializeAsset). `title`/`description`/`altText` are
 *  localized JSON ({vi,en,…}); render via the active locale with a fallback. */
export interface MediaAssetDto {
  id: string
  publicId: string
  kind: MediaKind
  status: MediaStatus
  moderation: ModerationStatus
  /** Why it was rejected/flagged — set by the moderator, shown back in the panel. */
  moderationReason: string | null
  title: LocalizedText
  description: LocalizedText | null
  altText: LocalizedText | null
  folderId: string | null
  scope: MediaScope
  scopeId: string | null
  visibility: MediaVisibility
  mimeType: string | null
  width: number | null
  height: number | null
  durationMs: number | null
  locale: string | null
  license: string | null
  ageRating: string | null
  keywords: string[]
  createdAt: string
  renditions: Rendition[]
  tags?: { slug: string; kind: TagKind; label: LocalizedText }[]
}

export interface MediaFolderDto {
  id: string
  name: LocalizedText
  slug: string | null
  description: LocalizedText | null
  parentId: string | null
  path: string
  scope: MediaScope
  scopeId: string | null
  visibility: MediaVisibility
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface MediaGrantDto {
  id: string
  subjectType: GrantSubjectType
  subjectId: string | null
  permission: MediaPermission
  folderId: string | null
  assetId: string | null
  createdById: string | null
  createdAt: string
}

export interface TagDto {
  id: string
  slug: string
  kind: TagKind
  label: LocalizedText
  description: LocalizedText | null
  parentId: string | null
  path: string
  externalRef: string | null
  createdAt: string
  updatedAt: string
}

export interface CollectionDto {
  id: string
  name: LocalizedText
  description: LocalizedText | null
  scope: MediaScope
  scopeId: string | null
  isSmart: boolean
  query: unknown | null
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface DocumentTemplateSection {
  key: string
  title: string
  instruction: string
  required?: boolean
  repeatable?: boolean
}
export interface DocumentTemplateDto {
  id: string
  key: string
  name: LocalizedText
  description: LocalizedText | null
  docKind: string
  scope: MediaScope
  scopeId: string | null
  locale: string | null
  sections: DocumentTemplateSection[]
  style: { tone?: string; gradeBand?: string; length?: string } | null
  rubric: string[] | null
  status: string
  version: number
  createdAt: string
  updatedAt: string
}

/** Prompt catalog view (apps/api/src/prompts/index.ts). */
export interface PromptViewDto {
  id: string
  description: string
  variables: string[]
  default: string
  overridden: boolean
  effective: string
}

/** Presigned upload slot returned by POST /media/assets. */
export interface UploadSlot {
  url: string
  key: string
  method: 'PUT'
}
