import { AlertTriangle, Check } from 'lucide-react'
import type { HTMLAttributes, ReactNode } from 'react'
import { Card } from './card'
import { cn } from './lib/cn'
import { Spinner } from './spinner'

/* -------------------------------------------------------------------------- */
/* PageHeader — app page title block (breadcrumbs + title + description + actions) */
/* -------------------------------------------------------------------------- */
export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, description, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 border-b border-border pb-5', className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {description ? <p className="mt-1 text-foreground-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* SectionHeader — in-page section heading (eyebrow + title + subtitle + action) */
/* -------------------------------------------------------------------------- */
export interface SectionHeaderProps {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex flex-col gap-1">
        {eyebrow ? (
          <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="text-sm text-foreground-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Toolbar / FilterBar — a row of filters + actions                            */
/* -------------------------------------------------------------------------- */
export function Toolbar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-2',
        className,
      )}
      {...props}
    />
  )
}

/* -------------------------------------------------------------------------- */
/* StatGrid — responsive grid for StatCards                                    */
/* -------------------------------------------------------------------------- */
const STAT_COLS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
}

export interface StatGridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 2 | 3 | 4
}

export function StatGrid({ columns = 4, className, ...props }: StatGridProps) {
  return <div className={cn('grid grid-cols-1 gap-4', STAT_COLS[columns], className)} {...props} />
}

/* -------------------------------------------------------------------------- */
/* DashboardWidget — a card with a header (title + action) + content           */
/* -------------------------------------------------------------------------- */
export interface DashboardWidgetProps {
  title: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function DashboardWidget({ title, action, children, className }: DashboardWidgetProps) {
  return (
    <Card className={cn('flex flex-col overflow-hidden p-0', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold text-foreground">{title}</h3>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  )
}

/* -------------------------------------------------------------------------- */
/* ErrorState — full error placeholder                                         */
/* -------------------------------------------------------------------------- */
export interface ErrorStateProps {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function ErrorState({ icon, title, description, action, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger-soft p-8 text-center',
        className,
      )}
    >
      <div className="grid size-14 place-items-center rounded-2xl bg-danger text-danger-foreground">
        {icon ?? <AlertTriangle className="size-6" />}
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-display text-base font-bold text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-foreground-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* LoadingScreen — centered spinner + optional label                           */
/* -------------------------------------------------------------------------- */
export interface LoadingScreenProps {
  label?: ReactNode
  className?: string
}

export function LoadingScreen({ label, className }: LoadingScreenProps) {
  return (
    <div className={cn('grid min-h-64 place-items-center', className)}>
      <div className="flex flex-col items-center gap-3">
        <Spinner size={28} />
        {label ? <p className="text-sm text-foreground-muted">{label}</p> : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stepper — horizontal wizard step indicator                                  */
/* -------------------------------------------------------------------------- */
export interface StepperStep {
  id: string
  label: ReactNode
}

export interface StepperProps {
  steps: StepperStep[]
  /** 0-based index of the active step. */
  current: number
  className?: string
}

export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center', className)}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.id} className={cn('flex items-center', i < steps.length - 1 && 'flex-1')}>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold transition-colors',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-primary text-primary-foreground ring-4 ring-primary-soft',
                  !done && !active && 'bg-surface-muted text-foreground-muted',
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-sm font-medium',
                  active ? 'text-foreground' : 'text-foreground-muted',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 ? (
              <span className={cn('mx-3 h-0.5 flex-1 rounded-full', done ? 'bg-primary' : 'bg-border')} />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
