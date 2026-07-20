import { Avatar, type AvatarProps } from './avatar'
import { cn } from './lib/cn'

export interface AvatarGroupProps {
  avatars: { name: string; src?: string | null }[]
  max?: number
  size?: AvatarProps['size']
  className?: string
}

/** Overlapping stack of avatars with a `+N` overflow chip. */
export function AvatarGroup({ avatars, max = 4, size = 'sm', className }: AvatarGroupProps) {
  const shown = avatars.slice(0, max)
  const extra = avatars.length - shown.length
  return (
    <div className={cn('flex items-center', className)}>
      {shown.map((a, i) => (
        <div key={i} className="-ml-2 rounded-full ring-2 ring-surface first:ml-0">
          <Avatar name={a.name} src={a.src} size={size} />
        </div>
      ))}
      {extra > 0 ? (
        <div className="-ml-2 grid size-8 place-items-center rounded-full bg-surface-muted text-xs font-semibold text-foreground-muted ring-2 ring-surface">
          +{extra}
        </div>
      ) : null}
    </div>
  )
}
