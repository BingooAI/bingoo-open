import { cn } from './lib/cn'
import { Progress } from './progress'

export interface XPBarProps {
  level: number
  xp: number
  nextXp: number
  /** Prefix before the level number, e.g. "Lv." (universal). */
  levelPrefix?: string
  className?: string
}

/** Level chip + XP progress toward the next level. */
export function XPBar({ level, xp, nextXp, levelPrefix = 'Lv.', className }: XPBarProps) {
  const pct = nextXp > 0 ? Math.max(0, Math.min(100, (xp / nextXp) * 100)) : 0
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="shrink-0 rounded-full bg-primary px-2.5 py-1 font-display text-xs font-bold text-primary-foreground">
        {levelPrefix}
        {level}
      </span>
      <div className="flex-1">
        <Progress value={pct} label={`${xp}/${nextXp} XP`} />
        <div className="mt-1 text-right text-[11px] tabular-nums text-foreground-muted">
          {xp}/{nextXp} XP
        </div>
      </div>
    </div>
  )
}
