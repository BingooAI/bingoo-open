'use client'

import type { ContentBlock } from '@bingoo.ai/core'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { ContentBlocks } from './content-blocks'
import { cn } from './lib/cn'

export interface CommunityPostCardProps {
  authorName: string
  authorAvatarSrc?: string | null
  /** e.g. "Giáo viên · 2 giờ trước" (pre-composed, localized). */
  authorMeta?: ReactNode
  /** Post body: shared ContentBlocks (moderated before render, §R5)… */
  blocks?: ContentBlock[]
  /** …or plain children. */
  children?: ReactNode
  likeCount?: number
  commentCount?: number
  liked?: boolean
  onLike?: () => void
  onComment?: () => void
  onShare?: () => void
  likeLabel?: string
  commentLabel?: string
  shareLabel?: string
  /** Header trailing slot (menu…). */
  trailing?: ReactNode
  className?: string
}

/** A community post: author header, ContentBlocks body (same schema as lessons
 * and feed — one source of truth), reaction bar. i18n-free. */
export function CommunityPostCard({
  authorName,
  authorAvatarSrc,
  authorMeta,
  blocks,
  children,
  likeCount,
  commentCount,
  liked,
  onLike,
  onComment,
  onShare,
  likeLabel,
  commentLabel,
  shareLabel,
  trailing,
  className,
}: CommunityPostCardProps) {
  return (
    <article
      className={cn(
        'flex w-full flex-col gap-4 rounded-[var(--radius-card,2rem)] border border-border bg-surface p-5 shadow-sm',
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <Avatar name={authorName} src={authorAvatarSrc} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-foreground">{authorName}</p>
          {authorMeta ? <p className="truncate text-xs text-foreground-muted">{authorMeta}</p> : null}
        </div>
        {trailing}
      </header>
      {blocks ? <ContentBlocks blocks={blocks} /> : children}
      <footer className="flex items-center gap-1 border-t border-border pt-3">
        <ReactionButton
          icon={<Heart className={cn('size-4', liked && 'fill-danger text-danger')} />}
          count={likeCount}
          label={likeLabel}
          active={liked}
          onClick={onLike}
        />
        <ReactionButton
          icon={<MessageCircle className="size-4" />}
          count={commentCount}
          label={commentLabel}
          onClick={onComment}
        />
        {onShare ? (
          <ReactionButton icon={<Share2 className="size-4" />} label={shareLabel} onClick={onShare} />
        ) : null}
      </footer>
    </article>
  )
}

function ReactionButton({
  icon,
  count,
  label,
  active,
  onClick,
}: {
  icon: ReactNode
  count?: number
  label?: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold outline-none transition-colors hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring',
        active ? 'text-danger' : 'text-foreground-muted',
      )}
    >
      {icon}
      {count != null ? <span className="tabular-nums">{count}</span> : null}
    </button>
  )
}
