// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { buildTreePath, type LocalizedText } from '@bingoo.ai/core'
import { db } from '@bingoo.ai/db'
import type { MediaScope, MediaVisibility } from '@bingoo.ai/db'

/**
 * Media folder tree (docs/media-library-design.md §3.2) — the human navigation
 * axis. Same materialised-path scheme as Organization (`path` = "root.child.self."
 * → O(1) subtree via prefix). A folder is ONE physical location (M4); meaning
 * lives on tags, not here.
 */

export interface CreateFolderInput {
  name: LocalizedText
  parentId?: string | null
  scope?: MediaScope
  scopeId?: string | null
  visibility?: MediaVisibility
  description?: LocalizedText
  createdById?: string | null
}

export async function createFolder(input: CreateFolderInput) {
  let parentPath = ''
  let scope: MediaScope = input.scope ?? 'GLOBAL'
  let scopeId = input.scopeId ?? null

  if (input.parentId) {
    const parent = await db.mediaFolder.findUnique({
      where: { id: input.parentId },
      select: { path: true, scope: true, scopeId: true },
    })
    if (!parent) throw new Error('parent folder not found')
    parentPath = parent.path
    // A child inherits its parent's scope unless explicitly overridden — keeps a
    // subtree within one tenant boundary.
    if (input.scope === undefined) {
      scope = parent.scope
      scopeId = parent.scopeId
    }
  }

  const created = await db.mediaFolder.create({
    data: {
      name: input.name,
      description: input.description ?? undefined,
      parentId: input.parentId ?? null,
      scope,
      scopeId,
      visibility: input.visibility ?? 'SCOPE',
      createdById: input.createdById ?? null,
    },
  })
  return db.mediaFolder.update({
    where: { id: created.id },
    data: { path: buildTreePath(parentPath, created.id) },
  })
}

export function getFolder(id: string) {
  return db.mediaFolder.findUnique({ where: { id } })
}

/** Self + descendants (subtree) via path prefix. */
export async function getFolderTree(id: string) {
  const folder = await db.mediaFolder.findUnique({ where: { id }, select: { path: true } })
  if (!folder) return []
  return db.mediaFolder.findMany({
    where: { path: { startsWith: folder.path } },
    orderBy: { path: 'asc' },
  })
}

export function listChildFolders(parentId: string | null) {
  return db.mediaFolder.findMany({
    where: { parentId },
    orderBy: { createdAt: 'asc' },
  })
}

export interface UpdateFolderInput {
  name?: LocalizedText
  description?: LocalizedText
  visibility?: MediaVisibility
}

export function updateFolder(id: string, input: UpdateFolderInput) {
  return db.mediaFolder.update({
    where: { id },
    data: {
      name: input.name ?? undefined,
      description: input.description ?? undefined,
      visibility: input.visibility ?? undefined,
    },
  })
}

/** Ancestor folder ids of a folder (root→self), decoded from its path. */
export async function folderAncestorIds(folderId: string): Promise<string[]> {
  const folder = await db.mediaFolder.findUnique({
    where: { id: folderId },
    select: { path: true },
  })
  if (!folder) return []
  return folder.path.split('.').filter(Boolean)
}

/** Delete an empty folder (no child folders, no assets). Caller checks access. */
export async function deleteFolder(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  const [childCount, assetCount] = await Promise.all([
    db.mediaFolder.count({ where: { parentId: id } }),
    db.mediaAsset.count({ where: { folderId: id } }),
  ])
  if (childCount > 0) return { ok: false, reason: 'has_subfolders' }
  if (assetCount > 0) return { ok: false, reason: 'has_assets' }
  await db.mediaFolder.delete({ where: { id } })
  return { ok: true }
}
