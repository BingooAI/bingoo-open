'use client';

import { Check } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/i18n-text';
import type { MediaAssetDto } from '@/lib/api-types';
import { KindIcon } from './kind-icon';
import { ModerationBadge } from './media-badges';

/** Rendition kinds that are an image BY DEFINITION, whatever the asset's kind is. */
const IMAGE_RENDITIONS = new Set(['THUMBNAIL', 'POSTER']);

/**
 * Best <img>-able url for a list-serialized asset, or null to fall back to the kind
 * icon.
 *
 * Nothing generates derived thumbnails yet, so the list serializer hands us whatever
 * single rendition it has — for an audio/document/archive asset that is the ORIGINAL,
 * i.e. an .mp3 or .docx. Putting that in an <img> renders a broken-image glyph (and
 * spills the alt text across the card), which is exactly what it used to do. Only an
 * asset whose bytes really ARE an image may use its ORIGINAL as the thumbnail.
 */
function thumbUrl(asset: MediaAssetDto): string | null {
  const derived = asset.renditions.find((r) => IMAGE_RENDITIONS.has(r.kind) && r.url);
  if (derived?.url) return derived.url;
  const isImage = asset.mimeType ? asset.mimeType.startsWith('image/') : asset.kind === 'IMAGE';
  if (!isImage) return null;
  return asset.renditions.find((r) => r.url)?.url ?? null;
}

export function AssetCard({
  asset,
  selected,
  onSelect,
  checked,
  onToggleCheck,
}: {
  asset: MediaAssetDto;
  selected: boolean;
  onSelect: (asset: MediaAssetDto) => void;
  /** Multi-select (moderators only) — omit `onToggleCheck` to hide the checkbox. */
  checked?: boolean;
  onToggleCheck?: (asset: MediaAssetDto) => void;
}) {
  const t = useTranslations('admin.library');
  const locale = useLocale();
  const title = pickText(asset.title, locale, asset.publicId);
  const url = thumbUrl(asset);

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition-all',
        selected || checked
          ? 'border-primary ring-2 ring-ring'
          : 'border-border hover:border-border-strong hover:shadow-sm',
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(asset)}
        aria-pressed={selected}
        className="flex flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <div className="relative aspect-square w-full overflow-hidden bg-surface-muted">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              // The card's own title labels it; a redundant alt here just repeats it
              // (and a long transcript title used to overflow the tile).
              alt={pickText(asset.altText, locale, '')}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="grid size-full place-items-center text-foreground-subtle">
              <KindIcon kind={asset.kind} className="size-10" />
            </div>
          )}
          <div className={cn('absolute top-2', onToggleCheck ? 'left-9' : 'left-2')}>
            <ModerationBadge status={asset.moderation} size="sm" />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1 p-2.5">
          <p className="truncate text-sm font-semibold text-foreground" title={title}>
            {title}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
            <KindIcon kind={asset.kind} className="size-3.5" />
            <span>{asset.kind}</span>
            {asset.locale ? <span>· {asset.locale.toUpperCase()}</span> : null}
          </div>
        </div>
      </button>

      {/* Sibling of the card button, not a child — a button inside a button is invalid. */}
      {onToggleCheck && (
        <button
          type="button"
          role="checkbox"
          aria-checked={!!checked}
          aria-label={t('selectAsset', { title })}
          onClick={() => onToggleCheck(asset)}
          className={cn(
            'absolute left-2 top-2 grid size-6 place-items-center rounded-md border transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            checked
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-surface/90 text-transparent hover:border-border-strong',
          )}
        >
          <Check className="size-4" strokeWidth={3} />
        </button>
      )}
    </div>
  );
}
