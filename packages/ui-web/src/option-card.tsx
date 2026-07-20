import { Check } from 'lucide-react'
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from './lib/cn'
import { tile } from './lib/interactive'

export interface OptionCardProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onSelect' | 'title'> {
  selected?: boolean
  /** `single` => radio semantics, `multiple` => checkbox semantics. */
  mode?: 'single' | 'multiple'
  media?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** Layout: stacked (media on top) or inline (media on the left). */
  layout?: 'stacked' | 'inline'
}

/**
 * A large, tappable selectable tile — the workhorse for onboarding choices
 * (role, subjects, goals, avatar). Fully keyboard + screen-reader accessible.
 */
export const OptionCard = forwardRef<HTMLButtonElement, OptionCardProps>(function OptionCard(
  { className, selected, mode = 'single', media, title, description, layout = 'inline', ...props },
  ref,
) {
  const a11y =
    mode === 'single'
      ? ({ role: 'radio', 'aria-checked': selected } as const)
      : ({ role: 'checkbox', 'aria-checked': selected } as const)

  return (
    <button
      ref={ref}
      type="button"
      {...a11y}
      className={cn(
        tile({ state: selected ? 'selected' : 'idle', size: 'none' }),
        'group flex w-full gap-3 p-4 text-left',
        layout === 'stacked' ? 'flex-col items-center text-center' : 'items-center',
        className,
      )}
      {...props}
    >
      {media && (
        <span
          className={cn('grid shrink-0 place-items-center', layout === 'stacked' ? 'size-14' : 'size-11')}
        >
          {media}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-display font-semibold text-foreground">{title}</span>
        {description && <span className="text-sm text-foreground-muted">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all',
          layout === 'stacked' && 'absolute right-3 top-3',
          selected ? 'border-primary bg-primary text-white' : 'border-border-strong',
          mode === 'single' && !selected && 'rounded-full',
        )}
      >
        <Check
          className={cn('size-3.5 transition-transform', selected ? 'scale-100' : 'scale-0')}
          strokeWidth={3.5}
        />
      </span>
    </button>
  )
})
