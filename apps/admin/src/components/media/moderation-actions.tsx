'use client'

import { CheckCircle2, Flag, X, XCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ReactNode } from 'react'
import { Button, Dialog, Field, Textarea, useToast } from '@bingoo/ui-web'
import type { ModerationStatus } from '@bingoo/core'
import { ApiError } from '@/lib/api-client'
import { useModerateAsset, useModerateAssets, type ModerationDecision } from '@/lib/media-queries'

/**
 * The R5 decision surface: approve / reject / flag, for one asset (in the detail
 * panel) or for a grid selection (the bulk bar). Both call the same endpoints and
 * both are gated on `canModerate` — the server re-enforces it regardless.
 *
 * Approving is one click. Rejecting or flagging demands a reason: it is stored on
 * the asset and is the only thing that tells whoever made it what to fix.
 */

const TOAST_KEY: Record<ModerationDecision, 'approvedToast' | 'rejectedToast' | 'flaggedToast'> = {
  APPROVED: 'approvedToast',
  REJECTED: 'rejectedToast',
  FLAGGED: 'flaggedToast',
}

/** Confirm + capture a reason. Resolves the dialog only when the call succeeded. */
function ReasonDialog({
  decision,
  label,
  icon,
  variant,
  title,
  pending,
  onConfirm,
}: {
  decision: Exclude<ModerationDecision, 'APPROVED'>
  label: string
  icon: ReactNode
  variant: 'danger' | 'coral'
  title: string
  pending: boolean
  onConfirm: (reason: string) => Promise<boolean>
}) {
  const t = useTranslations('admin.moderation')
  const [reason, setReason] = useState('')

  return (
    <Dialog
      role="alertdialog"
      trigger={
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {label}
        </span>
      }
      triggerVariant={variant}
      title={title}
      description={t('reasonHint')}
      closeAriaLabel={t('cancel')}
      footer={(close) => (
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            variant={variant}
            loading={pending}
            disabled={!reason.trim()}
            onClick={async () => {
              if (await onConfirm(reason.trim())) {
                setReason('')
                close()
              }
            }}
          >
            {label}
          </Button>
        </div>
      )}
    >
      <Field label={t('reason')}>
        <Textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t(`reasonPlaceholder.${decision === 'REJECTED' ? 'reject' : 'flag'}`)}
        />
      </Field>
    </Dialog>
  )
}

/** Approve / reject / flag one asset. The current state's own button is disabled. */
export function ModerationActions({
  assetId,
  moderation,
  moderationReason,
}: {
  assetId: string
  moderation: ModerationStatus
  moderationReason: string | null
}) {
  const t = useTranslations('admin.moderation')
  const { toast } = useToast()
  const moderate = useModerateAsset()

  async function decide(decision: ModerationDecision, reason?: string): Promise<boolean> {
    try {
      await moderate.mutateAsync({ id: assetId, decision, reason })
      toast({ variant: 'success', title: t(TOAST_KEY[decision]) })
      return true
    } catch (err) {
      toast({
        variant: 'danger',
        title: t('error'),
        description: err instanceof ApiError ? err.message : undefined,
      })
      return false
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-surface-muted/50 p-3">
      <h3 className="font-display text-sm font-bold text-foreground">{t('title')}</h3>

      {moderationReason && moderation !== 'APPROVED' && (
        <p className="rounded-xl bg-surface px-3 py-2 text-xs text-foreground-muted">
          <span className="font-semibold text-foreground">{t('reason')}: </span>
          {moderationReason}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          loading={moderate.isPending}
          disabled={moderation === 'APPROVED'}
          leftIcon={<CheckCircle2 className="size-4" />}
          onClick={() => void decide('APPROVED')}
        >
          {t('approve')}
        </Button>
        {moderation !== 'REJECTED' && (
          <ReasonDialog
            decision="REJECTED"
            label={t('reject')}
            icon={<XCircle className="size-4" />}
            variant="danger"
            title={t('rejectTitle')}
            pending={moderate.isPending}
            onConfirm={(reason) => decide('REJECTED', reason)}
          />
        )}
        {moderation !== 'FLAGGED' && (
          <ReasonDialog
            decision="FLAGGED"
            label={t('flag')}
            icon={<Flag className="size-4" />}
            variant="coral"
            title={t('flagTitle')}
            pending={moderate.isPending}
            onConfirm={(reason) => decide('FLAGGED', reason)}
          />
        )}
      </div>
    </section>
  )
}

/** Sticky bar over the grid: one decision applied to every checked asset. */
export function BulkModerationBar({ assetIds, onClear }: { assetIds: string[]; onClear: () => void }) {
  const t = useTranslations('admin.moderation')
  const { toast } = useToast()
  const moderate = useModerateAssets()

  async function decide(decision: ModerationDecision, reason?: string): Promise<boolean> {
    try {
      const res = await moderate.mutateAsync({ assetIds, decision, reason })
      toast({ variant: 'success', title: t('bulkDone', { count: res.moderated }) })
      onClear()
      return true
    } catch (err) {
      toast({
        variant: 'danger',
        title: t('error'),
        description: err instanceof ApiError ? err.message : undefined,
      })
      return false
    }
  }

  return (
    <div className="sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3 shadow-lg">
      <span className="text-sm font-semibold text-foreground">
        {t('selected', { count: assetIds.length })}
      </span>
      <div className="flex-1" />
      <Button
        variant="primary"
        size="sm"
        loading={moderate.isPending}
        leftIcon={<CheckCircle2 className="size-4" />}
        onClick={() => void decide('APPROVED')}
      >
        {t('approve')}
      </Button>
      <ReasonDialog
        decision="REJECTED"
        label={t('reject')}
        icon={<XCircle className="size-4" />}
        variant="danger"
        title={t('bulkRejectTitle', { count: assetIds.length })}
        pending={moderate.isPending}
        onConfirm={(reason) => decide('REJECTED', reason)}
      />
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<X className="size-4" />}
        onClick={onClear}
        disabled={moderate.isPending}
      >
        {t('clearSelection')}
      </Button>
    </div>
  )
}
