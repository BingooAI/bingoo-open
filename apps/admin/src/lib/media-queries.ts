// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import type { MediaKind, MediaSearchMode, ModerationStatus } from '@bingoo.ai/core'
import { api } from './api-client'
import type { MediaAssetDto, MediaFolderDto, PageMeta, TagDto, UploadSlot } from './api-types'

/**
 * TanStack Query hooks for the media library. One module owns the query keys +
 * cache invalidation so mutations keep the browser consistent. All calls go
 * through the same-origin `/api/media` proxy (see api-client).
 */
export const mediaKeys = {
  all: ['media'] as const,
  folderChildren: (parentId: string | null) => ['media', 'folders', 'children', parentId] as const,
  folder: (id: string) => ['media', 'folders', id] as const,
  folderAssets: (id: string, page: number, limit: number) =>
    ['media', 'folders', id, 'assets', page, limit] as const,
  search: (body: SearchBody) => ['media', 'search', body] as const,
  asset: (id: string) => ['media', 'assets', id] as const,
  tags: (kind?: string) => ['media', 'tags', kind ?? 'all'] as const,
}

// ── Folder tree ──────────────────────────────────────────────────────────────

/** Direct children of a folder (null = roots). Backs lazy tree expansion. */
export function useFolderChildren(parentId: string | null, enabled = true) {
  return useQuery({
    queryKey: mediaKeys.folderChildren(parentId),
    queryFn: () =>
      api.get<MediaFolderDto[]>('/media/folders', {
        query: parentId ? { parentId } : undefined,
      }),
    enabled,
  })
}

export function useFolder(id: string | null) {
  return useQuery({
    queryKey: id ? mediaKeys.folder(id) : ['media', 'folders', 'none'],
    queryFn: () => api.get<MediaFolderDto>(`/media/folders/${id}`),
    enabled: !!id,
  })
}

// ── Asset listing ────────────────────────────────────────────────────────────

/** Paginated assets directly inside one folder (real server pagination). */
export function useFolderAssets(folderId: string | null, page: number, limit: number) {
  return useQuery({
    queryKey: folderId ? mediaKeys.folderAssets(folderId, page, limit) : ['media', 'folderAssets', 'none'],
    queryFn: () => api.list<MediaAssetDto>(`/media/folders/${folderId}/assets`, { query: { page, limit } }),
    enabled: !!folderId,
    placeholderData: (prev) => prev,
  })
}

export interface SearchBody {
  text?: string
  mode?: MediaSearchMode
  kind?: MediaKind[]
  anyTags?: string[]
  allTags?: string[]
  locale?: string
  license?: string[]
  ageRating?: string[]
  folderId?: string
  limit?: number
  /** Staff-only facet; the server ignores it for everyone else (R5). */
  moderation?: ModerationStatus[]
}
export interface SearchResult {
  mode: MediaSearchMode
  hits: MediaAssetDto[]
}

/** Hybrid search — returns up to `limit` hits (server caps at 100, no cursor). */
export function useSearch(body: SearchBody, enabled = true) {
  return useQuery({
    queryKey: mediaKeys.search(body),
    queryFn: () => api.post<SearchResult>('/media/search', body),
    enabled,
    placeholderData: (prev) => prev,
  })
}

export interface NlSearchResult {
  query: SearchBody
  mode: MediaSearchMode
  hits: MediaAssetDto[]
}

/** Natural-language search: the LLM parses a sentence into a structured query
 *  (echoed back as `query`), then runs the same hybrid search. One LLM call per
 *  request → drive from an explicit submit, not a live keystroke. */
export function useNlSearch(q: string, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ['media', 'search', 'nl', q, limit] as const,
    queryFn: () => api.post<NlSearchResult>('/media/search/nl', { q, limit }),
    enabled: enabled && q.trim().length > 0,
    placeholderData: (prev) => prev,
  })
}

/** Full asset (all renditions signed) — used by the detail panel. */
export function useAsset(id: string | null, options?: Partial<UseQueryOptions<MediaAssetDto>>) {
  return useQuery({
    queryKey: id ? mediaKeys.asset(id) : ['media', 'assets', 'none'],
    queryFn: () => api.get<MediaAssetDto>(`/media/assets/${id}`),
    enabled: !!id,
    ...options,
  })
}

export function useTags(kind?: string) {
  return useQuery({
    queryKey: mediaKeys.tags(kind),
    queryFn: () => api.get<TagDto[]>('/media/tags', { query: kind ? { kind } : undefined }),
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export interface CreateAssetInput {
  kind: MediaKind
  title: Record<string, string>
  description?: Record<string, string>
  folderId?: string
  visibility?: string
  mimeType?: string
  locale?: string
  license?: string
  ageRating?: string
}
export interface CreateAssetResult {
  asset: MediaAssetDto
  upload: UploadSlot
}

/** Step 1 of upload: create the asset row + mint a presigned PUT slot. */
export function useCreateAsset() {
  return useMutation({
    mutationFn: (input: CreateAssetInput) => api.post<CreateAssetResult>('/media/assets', input),
  })
}

export interface CompleteAssetInput {
  byteSize?: number
  checksum?: string
  width?: number
  height?: number
  durationMs?: number
  pageCount?: number
}

/** Step 3 of upload: finalize after the bytes land (triggers auto-enrich). */
export function useCompleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CompleteAssetInput }) =>
      api.post<MediaAssetDto>(`/media/assets/${id}/complete`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export interface PatchAssetInput {
  title?: Record<string, string>
  description?: Record<string, string> | null
  altText?: Record<string, string> | null
  folderId?: string | null
  visibility?: string
  license?: string | null
  ageRating?: string | null
  locale?: string | null
}

export function usePatchAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PatchAssetInput }) =>
      api.patch<MediaAssetDto>(`/media/assets/${id}`, input),
    onSuccess: (asset) => {
      qc.setQueryData(mediaKeys.asset(asset.id), asset)
      void qc.invalidateQueries({ queryKey: ['media', 'folders'] })
      void qc.invalidateQueries({ queryKey: ['media', 'search'] })
    },
  })
}

export function useDeleteAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.del<{ deleted: boolean }>(`/media/assets/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export function useAttachTags() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, slugs }: { id: string; slugs: string[] }) =>
      api.post<{ keywords: string[] }>(`/media/assets/${id}/tags`, { slugs }),
    onSuccess: (_r, { id }) => void qc.invalidateQueries({ queryKey: mediaKeys.asset(id) }),
  })
}

export function useRemoveTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, tagId }: { id: string; tagId: string }) =>
      api.del<{ keywords: string[] }>(`/media/assets/${id}/tags/${tagId}`),
    onSuccess: (_r, { id }) => void qc.invalidateQueries({ queryKey: mediaKeys.asset(id) }),
  })
}

// ── Moderation (MODERATOR|ADMIN — the server re-enforces, gate the UI too) ────

export type ModerationDecision = Exclude<ModerationStatus, 'PENDING'>

export interface ModerateInput {
  decision: ModerationDecision
  /** Required by the UI for REJECTED/FLAGGED — the asset owner needs to know why. */
  reason?: string
}

/** A decision moves the asset between the status filter's buckets → refetch lists. */
function invalidateLists(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['media', 'folders'] })
  void qc.invalidateQueries({ queryKey: ['media', 'search'] })
}

export function useModerateAsset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: ModerateInput & { id: string }) =>
      api.post<MediaAssetDto>(`/media/assets/${id}/moderate`, input),
    onSuccess: (asset) => {
      qc.setQueryData(mediaKeys.asset(asset.id), asset)
      invalidateLists(qc)
    },
  })
}

/** One decision over a selection (server caps the batch at 200). */
export function useModerateAssets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assetIds, ...input }: ModerateInput & { assetIds: string[] }) =>
      api.post<{ moderated: number; decision: ModerationDecision }>('/media/assets/moderate-bulk', {
        assetIds,
        ...input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: mediaKeys.all }),
  })
}

export type { PageMeta }
