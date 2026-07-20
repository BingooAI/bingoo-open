// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { CheckSquare, FolderTree as FolderTreeIcon, Info, Sparkles, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { locales } from '@bingoo.ai/i18n'
import { Pagination } from '@bingoo.ai/ui-web'
import { pickText } from '@/lib/i18n-text'
import type { StaffCapabilities } from '@/lib/roles'
import { useFolderAssets, useNlSearch, useSearch } from '@/lib/media-queries'
import type { MediaAssetDto, MediaFolderDto } from '@/lib/api-types'
import { AssetDetailPanel } from './asset-detail-panel'
import { AssetGrid } from './asset-grid'
import { Drawer } from './drawer'
import { FolderTree } from './folder-tree'
import { BulkModerationBar } from './moderation-actions'
import { EMPTY_SEARCH, isSearchActive, SearchToolbar, type SearchState } from './search-toolbar'
import { UploadDialog } from './upload-dialog'

const SEARCH_LIMIT = 60
const PAGE_SIZE = 24

function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return v
}

export function MediaBrowser({ caps }: { caps: StaffCapabilities }) {
  const t = useTranslations('admin.library')
  const tk = useTranslations('admin.kind')
  const locale = useLocale()

  const [folderId, setFolderId] = useState<string | null>(null)
  const [folder, setFolder] = useState<MediaFolderDto | null>(null)
  const [search, setSearch] = useState<SearchState>(EMPTY_SEARCH)
  const [nlSubmitted, setNlSubmitted] = useState('')
  const [page, setPage] = useState(1)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<ReadonlySet<string>>(new Set())
  const [treeOpen, setTreeOpen] = useState(false)

  const debouncedText = useDebounced(search.text)
  const effectiveSearch = useMemo<SearchState>(
    () => ({ ...search, text: debouncedText }),
    [search, debouncedText],
  )

  // Toolbar change — turning NL mode off clears the committed NL query.
  function onSearchChange(next: SearchState) {
    if (!next.nl && search.nl) setNlSubmitted('')
    setSearch(next)
  }

  // Data-source decision:
  //  · NL mode → LLM-parsed search (POST /search/nl), run on explicit submit.
  //  · text/facet or "All assets" root → capped hybrid search.
  //  · a selected folder with no filters → real server-paginated folder browse.
  const nlMode = search.nl
  const searchMode = !nlMode && (isSearchActive(effectiveSearch) || folderId === null)

  // A new result set invalidates the selection — leaving ids checked that are no
  // longer on screen would make the bulk bar act on assets nobody can see.
  useEffect(() => {
    setPage(1)
    setCheckedIds(new Set())
  }, [folderId, effectiveSearch])

  const nlSearch = useNlSearch(nlSubmitted, SEARCH_LIMIT, nlMode)
  const searchQuery = useSearch(
    {
      text: effectiveSearch.text.trim() || undefined,
      kind: effectiveSearch.kind.length ? effectiveSearch.kind : undefined,
      locale: effectiveSearch.locale || undefined,
      moderation: effectiveSearch.moderation ? [effectiveSearch.moderation] : undefined,
      folderId: folderId ?? undefined,
      limit: SEARCH_LIMIT,
    },
    searchMode,
  )
  const folderAssets = useFolderAssets(folderId, page, PAGE_SIZE)

  let assets: MediaAssetDto[] | undefined
  let isLoading: boolean
  let isError: boolean
  let retry: () => void
  if (nlMode) {
    assets = nlSubmitted ? nlSearch.data?.hits : []
    isLoading = nlSearch.isFetching && !!nlSubmitted
    isError = nlSearch.isError
    retry = () => void nlSearch.refetch()
  } else if (searchMode) {
    assets = searchQuery.data?.hits
    isLoading = searchQuery.isLoading
    isError = searchQuery.isError
    retry = () => void searchQuery.refetch()
  } else {
    assets = folderAssets.data?.data
    isLoading = folderAssets.isLoading
    isError = folderAssets.isError
    retry = () => void folderAssets.refetch()
  }

  const totalPages = folderAssets.data?.meta.totalPages ?? 1
  const capped =
    (searchMode && (searchQuery.data?.hits.length ?? 0) >= SEARCH_LIMIT) ||
    (nlMode && (nlSearch.data?.hits.length ?? 0) >= SEARCH_LIMIT)

  const parsed = nlMode && nlSubmitted ? nlSearch.data?.query : undefined

  function selectFolder(id: string | null, f: MediaFolderDto | null) {
    setFolderId(id)
    setFolder(f)
    setTreeOpen(false)
  }

  function toggleCheck(a: MediaAssetDto) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(a.id)) next.add(a.id)
      return next
    })
  }

  const allChecked = !!assets?.length && assets.every((a) => checkedIds.has(a.id))
  function toggleAll() {
    setCheckedIds(allChecked ? new Set() : new Set((assets ?? []).map((a) => a.id)))
  }

  const heading = folder ? pickText(folder.name, locale, folder.slug ?? '') : t('allAssets')
  const tree = <FolderTree selectedId={folderId} onSelect={selectFolder} />

  return (
    <div className="lg:grid lg:grid-cols-[248px_1fr] lg:gap-6">
      {/* Folder tree — sidebar on desktop, drawer on mobile */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 rounded-2xl border border-border bg-surface p-3">{tree}</div>
      </aside>

      {treeOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label={t('closeFolders')}
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            onClick={() => setTreeOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 animate-fade-up overflow-y-auto border-r border-border bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-bold">{t('folders')}</span>
              <button
                type="button"
                onClick={() => setTreeOpen(false)}
                aria-label={t('closeFolders')}
                className="grid size-8 place-items-center rounded-full hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            {tree}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTreeOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground-muted hover:bg-surface-muted lg:hidden"
            >
              <FolderTreeIcon className="size-4" />
              {t('folders')}
            </button>
            <h2 className="font-display text-xl font-bold text-foreground">
              {nlMode ? t('nlResults') : heading}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {caps.canModerate && !!assets?.length && (
              <button
                type="button"
                onClick={toggleAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <CheckSquare className="size-4" />
                {allChecked ? t('deselectAll') : t('selectAll')}
              </button>
            )}
            {caps.canManageContent && <UploadDialog folderId={folderId} />}
          </div>
        </div>

        <SearchToolbar
          value={search}
          onChange={onSearchChange}
          onSubmit={() => setNlSubmitted(search.text.trim())}
          locales={[...locales]}
        />

        {parsed && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-primary-soft/60 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1 font-semibold text-primary-soft-foreground">
              <Sparkles className="size-3.5" />
              {t('nlUnderstood')}
            </span>
            {parsed.text ? (
              <span className="rounded-full bg-surface px-2 py-0.5 text-foreground-muted">
                “{parsed.text}”
              </span>
            ) : null}
            {parsed.kind?.map((k) => (
              <span key={k} className="rounded-full bg-surface px-2 py-0.5 text-foreground-muted">
                {tk(k)}
              </span>
            ))}
            {parsed.locale ? (
              <span className="rounded-full bg-surface px-2 py-0.5 text-foreground-muted">
                {parsed.locale.toUpperCase()}
              </span>
            ) : null}
          </div>
        )}

        {capped && (
          <p className="flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2 text-xs text-info">
            <Info className="size-4 shrink-0" />
            {t('cappedNote', { limit: SEARCH_LIMIT })}
          </p>
        )}

        <AssetGrid
          assets={assets}
          isLoading={isLoading}
          isError={isError}
          onRetry={retry}
          selectedId={selectedAssetId}
          onSelect={(a: MediaAssetDto) => setSelectedAssetId(a.id)}
          checkedIds={caps.canModerate ? checkedIds : undefined}
          onToggleCheck={caps.canModerate ? toggleCheck : undefined}
          emptyTitle={nlMode && !nlSubmitted ? t('nlPrompt') : t('empty')}
          emptyDescription={nlMode ? undefined : caps.canManageContent ? t('emptyHint') : undefined}
          footer={
            !searchMode && !nlMode && totalPages > 1 ? (
              <div className="flex justify-center pt-2">
                <Pagination page={page} total={totalPages} onChange={setPage} />
              </div>
            ) : null
          }
        />

        {caps.canModerate && checkedIds.size > 0 && (
          <BulkModerationBar assetIds={[...checkedIds]} onClear={() => setCheckedIds(new Set())} />
        )}
      </div>

      {/* Detail drawer */}
      <Drawer
        isOpen={selectedAssetId !== null}
        onClose={() => setSelectedAssetId(null)}
        title={t('detailTitle')}
        closeAriaLabel={t('close')}
        width="max-w-lg"
      >
        {selectedAssetId && (
          <AssetDetailPanel
            assetId={selectedAssetId}
            canEdit={caps.canManageContent}
            canModerate={caps.canModerate}
            onDeleted={() => setSelectedAssetId(null)}
          />
        )}
      </Drawer>
    </div>
  )
}
