'use client';

import { ImageOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { EmptyState, Spinner } from '@bingoo/ui-web';
import type { MediaAssetDto } from '@/lib/api-types';
import { AssetCard } from './asset-card';

/**
 * Responsive asset grid with explicit loading / error / empty states. Pagination
 * or "top-N cap" indicators are passed in as `footer` by the parent, which owns
 * the data-source decision (paginated folder browse vs capped search).
 */
export function AssetGrid({
  assets,
  isLoading,
  isError,
  onRetry,
  selectedId,
  onSelect,
  checkedIds,
  onToggleCheck,
  emptyTitle,
  emptyDescription,
  footer,
}: {
  assets: MediaAssetDto[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (asset: MediaAssetDto) => void;
  /** Multi-select — omit `onToggleCheck` to hide the checkboxes entirely. */
  checkedIds?: ReadonlySet<string>;
  onToggleCheck?: (asset: MediaAssetDto) => void;
  emptyTitle: string;
  emptyDescription?: string;
  footer?: ReactNode;
}) {
  const t = useTranslations('admin.library');

  if (isLoading && !assets) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<ImageOff className="size-7" />}
        title={t('loadError')}
        action={
          <button
            type="button"
            onClick={onRetry}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-strong"
          >
            {t('retry')}
          </button>
        }
      />
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <EmptyState
        icon={<ImageOff className="size-7" />}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5"
        aria-busy={isLoading}
      >
        {assets.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            selected={asset.id === selectedId}
            onSelect={onSelect}
            checked={checkedIds?.has(asset.id)}
            onToggleCheck={onToggleCheck}
          />
        ))}
      </div>
      {footer}
    </div>
  );
}
