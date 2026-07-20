'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeColor } from '@bingoo/ui-web';
import type { ModerationStatus, MediaStatus } from '@bingoo/core';

const MODERATION_COLOR: Record<ModerationStatus, BadgeColor> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  FLAGGED: 'coral',
};

/** Moderation state chip (R5-visible state). Text localized via `admin.moderation.state.*`. */
export function ModerationBadge({
  status,
  size,
}: {
  status: ModerationStatus;
  size?: 'sm' | 'md';
}) {
  const t = useTranslations('admin.moderation.state');
  return (
    <Badge color={MODERATION_COLOR[status]} tone="soft" size={size} dot>
      {t(status)}
    </Badge>
  );
}

const STATUS_COLOR: Record<MediaStatus, BadgeColor> = {
  DRAFT: 'neutral',
  UPLOADING: 'info',
  PROCESSING: 'info',
  READY: 'success',
  FAILED: 'danger',
  ARCHIVED: 'neutral',
};

/** Lifecycle status chip. Text localized via `admin.status.*`. */
export function StatusBadge({ status, size }: { status: MediaStatus; size?: 'sm' | 'md' }) {
  const t = useTranslations('admin.status');
  return (
    <Badge color={STATUS_COLOR[status]} tone="outline" size={size}>
      {t(status)}
    </Badge>
  );
}
