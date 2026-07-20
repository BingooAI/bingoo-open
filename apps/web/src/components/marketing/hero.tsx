import { FlaskConical, Palette, Play, ShieldCheck } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { Mascot } from '@/components/brand/mascot'
import { buttonVariants, Container, IconChip, type IconChipColor } from '@bingoo/ui-web'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'

/** A small floating subject tile — white card + 3D colored icon (the DS look). */
function FloatTile({
  className,
  color,
  icon,
  label,
}: {
  className: string
  color: IconChipColor
  icon: ReactNode
  label: ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute flex animate-float items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-lg',
        className,
      )}
    >
      <IconChip color={color} tone="gradient">
        {icon}
      </IconChip>
      <span className="font-display text-sm font-bold text-foreground">{label}</span>
    </div>
  )
}

export function Hero() {
  const t = useTranslations('landing.hero')
  const ts = useTranslations('landing.subjects.items')

  return (
    <section id="hero" className="relative overflow-hidden">
      {/* soft playful wash */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-0 size-72 rounded-full bg-primary-soft blur-3xl" />
        <div className="absolute right-0 top-24 size-72 rounded-full bg-accent-teal-soft blur-3xl" />
        <div className="absolute bottom-0 left-1/3 size-72 rounded-full bg-accent-sunbeam-soft blur-3xl" />
      </div>

      <Container size="xl" className="relative py-16 sm:py-20 lg:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* copy */}
          <div className="flex flex-col items-start gap-5">
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-primary-soft px-3.5 py-1.5 font-display text-xs font-bold text-primary-soft-foreground">
              🎒 {t('badge')}
            </span>

            <h1 className="animate-fade-up font-display text-[2.6rem] font-extrabold leading-[1.02] tracking-tight text-foreground sm:text-5xl lg:text-[3.4rem]">
              {t('title')} <span className="text-primary">{t('titleHighlight')}</span>
            </h1>

            <p className="max-w-lg animate-fade-up text-lg leading-relaxed text-foreground-muted">
              {t('subtitle')}
            </p>

            <div className="flex animate-fade-up flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/register" className={buttonVariants({ variant: 'primary', size: 'lg' })}>
                {t('ctaPrimary')}
              </Link>
              <a href="#how" className={buttonVariants({ variant: 'secondary', size: 'lg' })}>
                <Play className="size-5" />
                {t('ctaSecondary')}
              </a>
            </div>

            <Link
              href="/safety"
              className="inline-flex items-center gap-1.5 rounded text-sm font-semibold text-accent-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ShieldCheck className="size-4" />
              {t('safe')}
            </Link>
          </div>

          {/* visual — mascot stage + floating subject tiles */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="relative grid aspect-square place-items-center rounded-[2.5rem] border border-border bg-surface shadow-lg">
              <div aria-hidden className="absolute inset-10 rounded-full bg-primary-soft blur-2xl" />
              <Mascot emotion="excited" size={248} float alt="" />
              <span className="absolute bottom-4 right-4 rounded-full bg-accent-sunbeam px-3 py-1.5 font-display text-xs font-extrabold text-accent-sunbeam-foreground shadow-md">
                +20 XP
              </span>
            </div>

            <FloatTile
              className="-left-4 top-8"
              color="primary"
              icon={<span className="text-lg leading-none">÷</span>}
              label={ts('math')}
            />
            <FloatTile
              className="-right-3 top-28"
              color="teal"
              icon={<FlaskConical className="size-5" />}
              label={ts('science')}
            />
            <FloatTile
              className="-bottom-2 left-10"
              color="sunbeam"
              icon={<Palette className="size-5" />}
              label={ts('art')}
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
