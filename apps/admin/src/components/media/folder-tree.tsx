'use client'

import { ChevronRight, Folder, FolderOpen, Images, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { cn } from '@/lib/cn'
import { pickText } from '@/lib/i18n-text'
import { useFolderChildren } from '@/lib/media-queries'
import type { MediaFolderDto } from '@/lib/api-types'

export interface FolderTreeProps {
  selectedId: string | null
  onSelect: (id: string | null, folder: MediaFolderDto | null) => void
}

/** Lazy folder tree. "All assets" (null) sits at the top; real roots load from
 *  GET /media/folders, children load on expand. */
export function FolderTree({ selectedId, onSelect }: FolderTreeProps) {
  const t = useTranslations('admin.library')
  const roots = useFolderChildren(null)

  return (
    <nav aria-label={t('folders')} className="space-y-0.5 text-sm">
      <button
        type="button"
        onClick={() => onSelect(null, null)}
        aria-current={selectedId === null ? 'true' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 font-semibold transition-colors',
          selectedId === null
            ? 'bg-primary-soft text-primary-soft-foreground'
            : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        )}
      >
        <Images className="size-4 shrink-0" />
        {t('allAssets')}
      </button>

      {roots.isLoading ? (
        <div className="flex items-center gap-2 px-2 py-1.5 text-foreground-subtle">
          <Loader2 className="size-4 animate-spin" /> {t('loading')}
        </div>
      ) : roots.isError ? (
        <button
          type="button"
          onClick={() => void roots.refetch()}
          className="px-2 py-1.5 text-left text-danger hover:underline"
        >
          {t('loadError')}
        </button>
      ) : roots.data && roots.data.length > 0 ? (
        roots.data.map((f) => (
          <FolderNode key={f.id} folder={f} depth={0} selectedId={selectedId} onSelect={onSelect} />
        ))
      ) : (
        <p className="px-2 py-1.5 text-xs text-foreground-subtle">{t('noFolders')}</p>
      )}
    </nav>
  )
}

function FolderNode({
  folder,
  depth,
  selectedId,
  onSelect,
}: {
  folder: MediaFolderDto
  depth: number
  selectedId: string | null
  onSelect: (id: string | null, folder: MediaFolderDto | null) => void
}) {
  const locale = useLocale()
  const [expanded, setExpanded] = useState(false)
  const children = useFolderChildren(folder.id, expanded)
  const isSelected = selectedId === folder.id
  const name = pickText(folder.name, locale, folder.slug ?? folder.id)

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-lg pr-2 transition-colors',
          isSelected
            ? 'bg-primary-soft text-primary-soft-foreground'
            : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground',
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="grid size-6 shrink-0 place-items-center rounded text-foreground-subtle hover:text-foreground"
        >
          <ChevronRight className={cn('size-4 transition-transform', expanded && 'rotate-90')} />
        </button>
        <button
          type="button"
          onClick={() => onSelect(folder.id, folder)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left"
        >
          {expanded ? <FolderOpen className="size-4 shrink-0" /> : <Folder className="size-4 shrink-0" />}
          <span className="truncate font-medium">{name}</span>
        </button>
      </div>

      {expanded && (
        <div>
          {children.isLoading ? (
            <div
              className="flex items-center gap-2 py-1 text-xs text-foreground-subtle"
              style={{ paddingLeft: (depth + 1) * 14 + 10 }}
            >
              <Loader2 className="size-3.5 animate-spin" />
            </div>
          ) : children.data && children.data.length > 0 ? (
            children.data.map((child) => (
              <FolderNode
                key={child.id}
                folder={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
              />
            ))
          ) : null}
        </div>
      )}
    </div>
  )
}
