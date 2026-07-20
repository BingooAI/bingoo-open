'use client';

import {
  AXES,
  AXIS_VALUES,
  type Axis,
  checkCompatibility,
  deriveCapabilities,
  type ExperienceDescriptor,
} from '@bingoo/learning-experience';
import { Callout } from './callout';
import { type LearningExperienceLabels } from './learning-experience-card';
import { cn } from './lib/cn';
import { Tag } from './tag';

/** Nhãn của một GIÁ TRỊ trục cụ thể (không phải theo descriptor). */
function valueLabel(labels: LearningExperienceLabels, axis: Axis, value: string): string {
  // labels[axis] là một trong 5 map trục (keys trùng tên trục) → tra trực tiếp.
  const map = labels[axis] as Record<string, string>;
  return map[value] ?? value;
}

const VERDICT_VARIANT = {
  VALID: 'success',
  DISCOURAGED: 'warning',
  INVALID: 'danger',
} as const;

export interface LearningExperiencePickerProps {
  value: ExperienceDescriptor;
  onChange: (next: ExperienceDescriptor) => void;
  labels: LearningExperienceLabels;
  className?: string;
}

/**
 * Bộ chọn 5 trục (controlled). Mỗi trục một hàng chip; chip nào — nếu chọn — gây MÂU THUẪN CỨNG với
 * 4 trục còn lại sẽ được đánh dấu (viền cảnh báo) nhưng vẫn bấm được: engine KHÔNG ép, chỉ cảnh báo.
 * Dưới cùng: verdict tương thích + dải năng lực host cần mount (suy từ engine).
 */
export function LearningExperiencePicker({
  value,
  onChange,
  labels,
  className,
}: LearningExperiencePickerProps) {
  const result = checkCompatibility(value);
  const capabilities = deriveCapabilities(value);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {AXES.map((axis) => {
        const current = value[axis];
        return (
          <div key={axis} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              {labels.axis[axis]}
            </span>
            <div role="radiogroup" aria-label={labels.axis[axis]} className="flex flex-wrap gap-2">
              {AXIS_VALUES[axis].map((option) => {
                const active = option === current;
                // Cast an toàn: option đến từ AXIS_VALUES[axis] nên khớp đúng kiểu trục.
                const candidate = { ...value, [axis]: option } as ExperienceDescriptor;
                const conflict = checkCompatibility(candidate).verdict === 'INVALID';
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => onChange(candidate)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-semibold outline-none transition-colors',
                      'focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : conflict
                          ? 'border-danger/40 bg-surface text-foreground-muted/70 hover:border-danger'
                          : 'border-border bg-surface text-foreground-muted hover:border-primary',
                    )}
                  >
                    {valueLabel(labels, axis, option)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <Callout variant={VERDICT_VARIANT[result.verdict]} title={labels.verdict[result.verdict]}>
        <div className="flex flex-wrap gap-1.5">
          {capabilities.map((cap) => (
            <Tag key={cap} color="neutral">
              {labels.capability[cap]}
            </Tag>
          ))}
        </div>
      </Callout>
    </div>
  );
}
