// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react'
import { Avatar } from './avatar'
import { cn } from './lib/cn'

export interface CommentData {
  id: string
  authorName: string
  authorAvatarSrc?: string | null
  /** Pre-formatted relative time. */
  time?: ReactNode
  /** Moderated text (§R5). */
  text: ReactNode
  /** One level of nested replies. */
  replies?: CommentData[]
}

export interface CommentThreadProps {
  comments: CommentData[]
  onReply?: (commentId: string) => void
  replyLabel?: ReactNode
  className?: string
}

/** A comment thread with one level of nested replies. i18n-free; content is
 * moderated upstream before it reaches kids (§R5). */
export function CommentThread({ comments, onReply, replyLabel, className }: CommentThreadProps) {
  return (
    <ul className={cn('flex w-full flex-col gap-4', className)}>
      {comments.map((c) => (
        <li key={c.id}>
          <Comment comment={c} onReply={onReply} replyLabel={replyLabel} />
          {c.replies && c.replies.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-3 border-l-2 border-border pl-4 sm:pl-6">
              {c.replies.map((r) => (
                <li key={r.id}>
                  <Comment comment={r} onReply={onReply} replyLabel={replyLabel} />
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function Comment({
  comment,
  onReply,
  replyLabel,
}: {
  comment: CommentData
  onReply?: (id: string) => void
  replyLabel?: ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={comment.authorName} src={comment.authorAvatarSrc} size="xs" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-surface-muted px-3.5 py-2.5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-foreground">{comment.authorName}</span>
            {comment.time ? <span className="text-xs text-foreground-subtle">{comment.time}</span> : null}
          </div>
          <p className="mt-0.5 text-sm text-foreground">{comment.text}</p>
        </div>
        {onReply && replyLabel ? (
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="mt-1 rounded px-1.5 text-xs font-semibold text-foreground-muted outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
          >
            {replyLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
