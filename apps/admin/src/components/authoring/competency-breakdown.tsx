'use client';

import { useTranslations } from 'next-intl';
import { Target, Lock, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { useLevelInsights, type PlanLevel } from '@/lib/authoring-queries';
import { cn } from '@/lib/cn';

/**
 * BẢN ĐỒ NĂNG LỰC của một cấp (khoá/unit/bài) — TÍNH từ graph, KHÔNG author:
 *   · KC nhóm theo LOẠI: Kiến thức / Kỹ năng / Quy trình / Phẩm chất / Thái độ / Hành vi
 *   · MỤC TIÊU (khung) mà cấp phục vụ (ngược MAPS_TO)
 *   · TIÊN QUYẾT cần biết trước (KC nền ngoài cấp)
 * Giúp giáo án nói rõ "xây tri thức gì, kỹ năng gì, phục vụ mục tiêu nào" — thay vì danh sách KC phẳng.
 */

// Màu chấm theo loại tri thức (không phải i18n) — nhãn chữ lấy từ catalog `bdKind.*`.
const KIND_DOT: Record<string, string> = {
  KNOWLEDGE: 'bg-accent-teal',
  SKILL: 'bg-primary',
  PROCEDURE: 'bg-accent-coral',
  DISPOSITION: 'bg-warning',
  ATTITUDE: 'bg-warning',
  BEHAVIOR: 'bg-foreground-subtle',
};

const loc = (t: Record<string, string>): string => t.vi ?? t.en ?? '';

function Head({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground-subtle">
      {children}
    </h5>
  );
}

export function CompetencyBreakdown({
  courseSlug,
  level,
  refSlug,
  className,
}: {
  courseSlug: string;
  level: PlanLevel;
  refSlug: string;
  className?: string;
}) {
  const t = useTranslations('admin.authoring');
  // Enum → nhãn qua catalog; value lạ chưa có key thì hiện raw (tín hiệu để bổ sung), không nổ.
  const enumLabel = (ns: string, k: string): string => (t.has(`${ns}.${k}`) ? t(`${ns}.${k}`) : k);

  const { data } = useLevelInsights(courseSlug, level, refSlug);
  if (!data || data.kcCount === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* KC theo LOẠI */}
      {data.byKind.map((g) => (
        <div key={g.kind}>
          <Head>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn('size-1.5 rounded-full', KIND_DOT[g.kind] ?? 'bg-foreground-subtle')}
              />
              {enumLabel('bdKind', g.kind)} · {g.items.length}
            </span>
          </Head>
          <div className="flex flex-wrap gap-1">
            {g.items.map((it) => (
              <span
                key={it.slug}
                title={it.slug}
                className="rounded-md border border-border bg-surface px-1.5 py-0.5 text-[12px] text-foreground-muted"
              >
                {loc(it.title) || it.slug}
              </span>
            ))}
          </div>
        </div>
      ))}

      {/* MỤC TIÊU phục vụ */}
      {data.objectives.length ? (
        <div>
          <Head>
            <span className="inline-flex items-center gap-1.5">
              <Target className="size-3 text-primary" /> {t('bdObjectivesServed')} ·{' '}
              {data.objectives.length}
            </span>
          </Head>
          <ul className="space-y-1">
            {data.objectives.map((o) => (
              <li
                key={o.slug}
                className="flex gap-2 text-[12px] leading-snug text-foreground-muted"
              >
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-primary/50" />
                <span title={o.slug}>{loc(o.title) || o.slug}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* TIÊN QUYẾT cần trước */}
      {data.prerequisites.length ? (
        <div>
          <Head>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3 text-foreground-subtle" /> {t('bdPrerequisites')} ·{' '}
              {data.prerequisites.length}
            </span>
          </Head>
          <div className="flex flex-wrap gap-1">
            {data.prerequisites.map((p) => (
              <span
                key={p.slug}
                title={p.slug}
                className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[12px] text-foreground-subtle"
              >
                {loc(p.title) || p.slug}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* HIỂU-SAI gom từ kế hoạch bài đã sinh (rỗng nếu chưa sinh bài) */}
      {data.misconceptions.length ? (
        <div>
          <Head>
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="size-3 text-danger" /> {t('bdMisconceptions')} ·{' '}
              {data.misconceptions.length}
            </span>
          </Head>
          <ul className="space-y-1">
            {data.misconceptions.map((m, i) => (
              <li
                key={`${m.kc}-${i}`}
                className="flex gap-2 text-[12px] leading-snug text-foreground-muted"
              >
                <span className="mt-[6px] size-1 shrink-0 rounded-full bg-danger/50" />
                <span>
                  <span className="text-foreground-subtle">
                    [{enumLabel('bdMiscType', m.type)}]
                  </span>{' '}
                  {loc(m.wrong)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* BẢN ĐỒ BẰNG CHỨNG: concept → bài nào đo, bao nhiêu item (UbD Stage 2) */}
      {data.evidence.length ? (
        <div>
          <Head>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCheck className="size-3 text-accent-teal" /> {t('bdEvidence')} ·{' '}
              {data.evidence.length}
            </span>
          </Head>
          <ul className="space-y-1">
            {data.evidence.map((e) => (
              <li key={e.concept} className="flex items-baseline gap-2 text-[12px] leading-snug">
                <span className="text-foreground-muted" title={e.concept}>
                  {loc(e.title) || e.concept}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-foreground-subtle">
                  {e.itemCount} {t('bdItemsUnit')} ·{' '}
                  {e.modes.map((md) => enumLabel('bdMode', md)).join('/')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
