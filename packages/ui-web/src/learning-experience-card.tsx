import {
  AXES,
  type Axis,
  type Companion,
  type CompatibilityVerdict,
  type Capability,
  type Delivery,
  type Experience,
  type ExperienceDescriptor,
  type Scale,
  type Time,
} from '@bingoo.ai/learning-experience'
import type { ReactNode } from 'react'
import { IconChip, type IconChipColor } from './icon-chip'
import { cn } from './lib/cn'
import { Tag, type TagColor } from './tag'

/**
 * Nhãn hiển thị cho toàn bộ 5 trục + năng lực + verdict. Package i18n-free (R4): host dựng object này
 * từ `@bingoo.ai/i18n` rồi truyền xuống — giống pattern `QuizLabels`/`discussLabels` trong lib.
 */
export interface LearningExperienceLabels {
  axis: Record<Axis, string>
  experience: Record<Experience, string>
  delivery: Record<Delivery, string>
  companion: Record<Companion, string>
  scale: Record<Scale, string>
  time: Record<Time, string>
  capability: Record<Capability, string>
  verdict: Record<CompatibilityVerdict, string>
}

/** Nhãn của giá trị trục theo descriptor. */
export function axisValueLabel(
  labels: LearningExperienceLabels,
  axis: Axis,
  d: ExperienceDescriptor,
): string {
  switch (axis) {
    case 'experience':
      return labels.experience[d.experience]
    case 'delivery':
      return labels.delivery[d.delivery]
    case 'companion':
      return labels.companion[d.companion]
    case 'scale':
      return labels.scale[d.scale]
    case 'time':
      return labels.time[d.time]
  }
}

/** Màu tag theo trục — mỗi trục một sắc để đọc nhanh, đọc semantic token (không hardcode hex). */
const AXIS_TAG_COLOR: Record<Axis, TagColor> = {
  experience: 'primary',
  delivery: 'teal',
  companion: 'coral',
  scale: 'sunbeam',
  time: 'success',
}

export interface LearningExperienceBadgeProps {
  descriptor: ExperienceDescriptor
  labels: LearningExperienceLabels
  className?: string
}

/** Hàng 5 chip tóm tắt một descriptor — mỗi trục một tag màu. */
export function LearningExperienceBadge({ descriptor, labels, className }: LearningExperienceBadgeProps) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {AXES.map((axis) => (
        <Tag key={axis} color={AXIS_TAG_COLOR[axis]}>
          {axisValueLabel(labels, axis, descriptor)}
        </Tag>
      ))}
    </div>
  )
}

export interface LearningExperienceCardProps {
  descriptor: ExperienceDescriptor
  labels: LearningExperienceLabels
  /** Tên trải nghiệm (vd nhãn blueprint). Không có thì chỉ hiện dải chip. */
  name?: ReactNode
  description?: ReactNode
  icon?: ReactNode
  accent?: IconChipColor
  cta?: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}

/** Thẻ một trải nghiệm học — icon + tên + dải 5 trục + CTA. Chọn được (radio-like) hoặc tĩnh. */
export function LearningExperienceCard({
  descriptor,
  labels,
  name,
  description,
  icon,
  accent = 'primary',
  cta,
  selected,
  onClick,
  className,
}: LearningExperienceCardProps) {
  const interactive = onClick != null
  const Wrapper = interactive ? 'button' : 'div'
  return (
    <Wrapper
      {...(interactive ? { type: 'button' as const, onClick, 'aria-pressed': selected } : {})}
      className={cn(
        'flex w-full flex-col gap-3 rounded-[var(--radius-card,1.5rem)] border bg-surface p-4 text-left',
        interactive &&
          'outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border shadow-sm',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {icon != null ? (
          <IconChip color={accent} tone="gradient">
            {icon}
          </IconChip>
        ) : null}
        {name != null ? (
          <div className="flex flex-col">
            <span className="font-display font-bold text-foreground">{name}</span>
            {description != null ? (
              <span className="text-xs text-foreground-muted">{description}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      <LearningExperienceBadge descriptor={descriptor} labels={labels} />
      {cta != null ? <div className="mt-1">{cta}</div> : null}
    </Wrapper>
  )
}
