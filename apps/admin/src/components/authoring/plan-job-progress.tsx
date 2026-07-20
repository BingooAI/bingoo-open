'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@bingoo/ui-web';
import { AlertTriangle, Ban, X } from 'lucide-react';
import type { PlanJobDto } from '@/lib/authoring-queries';

/**
 * THANH TIẾN TRÌNH + kết quả cho job SINH kế hoạch (chạy nền ~2 phút).
 *
 * Không có % thật từ LLM (một call đơn) → progress theo THỜI GIAN TRÔI vs ETA server gợi ý: đầy dần
 * tới ~95% rồi dừng, khi 'done' plan tự hiện (component trả null, để hàng kế hoạch hiển thị kết quả).
 * 'error'/'cancelled' → nêu rõ lý do. Có nút HỦY (abort LLM thật) khi đang chạy.
 */
export function PlanJobProgress({
  job,
  onCancel,
  canceling,
}: {
  job: PlanJobDto | undefined;
  onCancel?: () => void;
  canceling?: boolean;
}) {
  const t = useTranslations('admin.authoring');
  const running = job?.state === 'running';

  // Nhịp lại mỗi 0.5s để thanh tiến trình + đồng hồ trôi mượt trong khi chờ.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [running]);

  if (!job || job.state === 'idle' || job.state === 'done') return null;

  if (job.state === 'error') {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft/10 p-2.5 text-xs text-danger">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <b>{t('jobFailed')}</b> {job.error ?? ''}
        </span>
      </div>
    );
  }

  if (job.state === 'cancelled') {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-surface-muted/40 p-2.5 text-xs text-foreground-muted">
        <Ban className="size-3.5 shrink-0" /> {t('jobCancelled')}
      </div>
    );
  }

  // running — progress theo elapsed/eta (chặn ở 95% để không "đầy" trước khi thật xong).
  const elapsed = job.startedAt ? Math.max(0, Date.now() - job.startedAt) : 0;
  const etaMs = job.etaMs && job.etaMs > 0 ? job.etaMs : 120_000;
  const pct = Math.min(95, Math.round((elapsed / etaMs) * 100));
  const sec = Math.round(elapsed / 1000);
  const etaSec = Math.round(etaMs / 1000);

  return (
    <div className="mt-3 rounded-lg border border-primary/30 bg-primary-soft/5 p-2.5">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">{t('jobGenerating', { sec })}</span>
        <span className="text-foreground-subtle">{t('jobEta', { sec: etaSec })}</span>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] text-foreground-subtle">{t('jobBackground')}</span>
        {onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel} loading={canceling}>
            <X className="size-3.5" /> {t('jobCancel')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
