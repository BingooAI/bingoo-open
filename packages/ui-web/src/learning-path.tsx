import { Check, Lock } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { cn } from './lib/cn'

export type PathStatus = 'done' | 'current' | 'locked'

export interface PathNode {
  id: string
  status: PathStatus
  label?: ReactNode
}

export interface LearningPathProps {
  nodes: PathNode[]
  className?: string
}

/** Gamified lesson path — done / current / locked nodes with connectors. */
export function LearningPath({ nodes, className }: LearningPathProps) {
  return (
    <div className={cn('flex items-start', className)}>
      {nodes.map((n, i) => (
        <Fragment key={n.id}>
          <div className="flex flex-col items-center gap-1">
            <span
              className={cn(
                'grid size-10 place-items-center rounded-full font-display text-sm font-bold',
                n.status === 'done' && 'bg-success text-white',
                n.status === 'current' &&
                  'bg-accent-sunbeam text-accent-sunbeam-foreground ring-4 ring-accent-sunbeam-soft',
                n.status === 'locked' && 'bg-surface-muted text-foreground-subtle',
              )}
            >
              {n.status === 'done' ? (
                <Check className="size-5" />
              ) : n.status === 'locked' ? (
                <Lock className="size-4" />
              ) : (
                '★'
              )}
            </span>
            {n.label ? (
              <span className="max-w-16 text-center text-[11px] text-foreground-muted">{n.label}</span>
            ) : null}
          </div>
          {i < nodes.length - 1 ? (
            <span
              className={cn(
                'mt-5 h-1 w-8 shrink-0 rounded-full',
                n.status === 'done' ? 'bg-success' : 'bg-border-strong',
              )}
            />
          ) : null}
        </Fragment>
      ))}
    </div>
  )
}
