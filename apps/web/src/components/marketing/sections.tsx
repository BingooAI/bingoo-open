// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import {
  ArrowRight,
  Blocks,
  BookOpenText,
  Check,
  ClipboardList,
  Cloud,
  Gauge,
  Github,
  GitPullRequest,
  Globe,
  Layers,
  ListChecks,
  Network,
  Plus,
  Scale,
  ScrollText,
  Server,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ComponentType } from 'react'
import {
  Badge,
  buttonVariants,
  Card,
  Container,
  IconChip,
  type IconChipColor,
  Section,
} from '@bingoo.ai/ui-web'
import { cn } from '@/lib/cn'

type Icon = ComponentType<{ className?: string }>

const REPO_URL = 'https://github.com/BingooAI/bingoo-open'

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && (
        <Badge color="primary" tone="soft" className="mb-4">
          {eyebrow}
        </Badge>
      )}
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg leading-relaxed text-foreground-muted">{subtitle}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Stats band                                                                 */
/* -------------------------------------------------------------------------- */
/**
 * Numbers a reader can check by opening the repository: kit count, question types, locales,
 * licence. The adoption and satisfaction figures that used to sit here are gone — on a page
 * whose argument is "verify this yourself", an unverifiable statistic undoes the argument.
 */
const STATS = [
  { value: '67', key: 'kits' },
  { value: '6', key: 'questionTypes' },
  { value: '2', key: 'languages' },
  { value: '100%', key: 'licence' },
] as const

export function Stats() {
  const t = useTranslations('landing.stats')
  return (
    <Section className="py-10 sm:py-12">
      <Container size="xl">
        <div className="grid grid-cols-2 gap-6 rounded-3xl border border-border bg-surface p-8 sm:grid-cols-4">
          {STATS.map(({ value, key }) => (
            <div key={key} className="text-center">
              <div className="font-display text-3xl font-extrabold text-primary sm:text-4xl">{value}</div>
              <div className="mt-1 text-sm text-foreground-muted">{t(key)}</div>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Five frameworks                                                            */
/* -------------------------------------------------------------------------- */
const FRAMEWORKS: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'knowledge', Icon: Network, color: 'primary' },
  { key: 'pedagogy', Icon: ClipboardList, color: 'coral' },
  { key: 'teaching', Icon: Blocks, color: 'teal' },
  { key: 'content', Icon: BookOpenText, color: 'sunbeam' },
  { key: 'learning', Icon: Sparkles, color: 'success' },
]

export function Frameworks() {
  const t = useTranslations('landing.frameworks')
  return (
    <Section id="frameworks">
      <Container size="xl">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FRAMEWORKS.map(({ key, Icon, color }) => (
            <Card key={key} interactive className="p-6 hover:border-primary/30">
              <IconChip color={color} size="lg" tone="gradient">
                <Icon />
              </IconChip>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">
                {t(`items.${key}.name`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{t(`items.${key}.desc`)}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Measurement                                                                */
/* -------------------------------------------------------------------------- */
const MEASURE: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'evidence', Icon: ListChecks, color: 'primary' },
  { key: 'rightTool', Icon: Gauge, color: 'teal' },
  { key: 'disposition', Icon: Scale, color: 'coral' },
  { key: 'explain', Icon: ScrollText, color: 'sunbeam' },
]

export function Measure() {
  const t = useTranslations('landing.measure')
  return (
    <Section id="measure" className="bg-surface-muted/40">
      <Container size="xl">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {MEASURE.map(({ key, Icon, color }) => (
            <Card key={key} className="p-6">
              <div className="flex items-start gap-4">
                <IconChip color={color} size="lg" tone="gradient">
                  <Icon />
                </IconChip>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">{t(`items.${key}.name`)}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                    {t(`items.${key}.desc`)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Editions — open / cloud / network                                          */
/* -------------------------------------------------------------------------- */
/**
 * The open edition leads and is visually primary, because on this page it *is* the product.
 * Cloud and Network are described plainly rather than pitched: a repository that sells its paid
 * tiers to the people reading its source teaches them to distrust the free one.
 */
const EDITIONS = [
  { key: 'open', Icon: Server, color: 'primary' as IconChipColor, href: '#start', primary: true },
  {
    key: 'cloud',
    Icon: Cloud,
    color: 'teal' as IconChipColor,
    href: 'https://bingoo.ai/cloud',
    primary: false,
  },
  {
    key: 'network',
    Icon: Globe,
    color: 'sunbeam' as IconChipColor,
    href: 'https://bingoo.ai/network',
    primary: false,
  },
]

export function Editions() {
  const t = useTranslations('landing.editions')
  return (
    <Section id="editions">
      <Container size="xl">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {EDITIONS.map(({ key, Icon, color, href, primary }) => (
            <Card
              key={key}
              className={cn('flex flex-col p-6', primary && 'border-primary/40 ring-1 ring-primary/20')}
            >
              <div className="flex items-center gap-3">
                <IconChip color={color} size="lg" tone="gradient">
                  <Icon />
                </IconChip>
                <div>
                  <h3 className="font-display text-lg font-bold text-foreground">{t(`${key}.name`)}</h3>
                  <Badge color={primary ? 'primary' : 'neutral'} tone="soft" className="mt-1">
                    {t(`${key}.tag`)}
                  </Badge>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground-muted">{t(`${key}.desc`)}</p>
              <ul className="mt-5 flex-1 space-y-2">
                {(['a', 'b', 'c'] as const).map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm text-foreground-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    <span>{t(`${key}.points.${p}`)}</span>
                  </li>
                ))}
              </ul>
              <a
                href={href}
                className={cn(
                  buttonVariants({ variant: primary ? 'primary' : 'outline', size: 'md' }),
                  'mt-6 w-full justify-center',
                )}
              >
                {t(`${key}.cta`)}
              </a>
            </Card>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-foreground-muted">{t('note')}</p>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Curriculum transfer                                                        */
/* -------------------------------------------------------------------------- */
const TRANSFER = [
  { key: 'kept', Icon: Check, color: 'success' as IconChipColor },
  { key: 'missing', Icon: Plus, color: 'coral' as IconChipColor },
  { key: 'extra', Icon: Sparkles, color: 'sunbeam' as IconChipColor },
]

export function Transfer() {
  const t = useTranslations('landing.transfer')
  return (
    <Section id="transfer" className="bg-surface-muted/40">
      <Container size="xl">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {TRANSFER.map(({ key, Icon, color }) => (
            <Card key={key} className="p-6">
              <IconChip color={color} size="lg" tone="gradient">
                <Icon />
              </IconChip>
              <h3 className="mt-5 font-display text-base font-bold text-foreground">{t(`${key}.name`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{t(`${key}.desc`)}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Why open                                                                   */
/* -------------------------------------------------------------------------- */
const OPENNESS: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'standards', Icon: Shuffle, color: 'primary' },
  { key: 'swap', Icon: Layers, color: 'teal' },
  { key: 'audit', Icon: ShieldCheck, color: 'success' },
  { key: 'contribute', Icon: GitPullRequest, color: 'coral' },
]

export function Openness() {
  const t = useTranslations('landing.openness')
  return (
    <Section id="openness">
      <Container size="xl">
        <SectionHeading eyebrow={t('eyebrow')} title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OPENNESS.map(({ key, Icon, color }) => (
            <Card key={key} className="p-6">
              <IconChip color={color} size="lg" tone="gradient">
                <Icon />
              </IconChip>
              <h3 className="mt-5 font-display text-base font-bold text-foreground">
                {t(`items.${key}.name`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{t(`items.${key}.desc`)}</p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  )
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                     */
/* -------------------------------------------------------------------------- */
export function CtaBand() {
  const t = useTranslations('landing.cta')
  return (
    <Section id="start" className="pb-24">
      <Container size="lg">
        <div className="rounded-3xl border border-border bg-surface p-10 text-center sm:p-14">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-foreground-muted">
            {t('subtitle')}
          </p>
          <pre className="mx-auto mt-8 max-w-md overflow-x-auto rounded-2xl bg-surface-muted px-5 py-4 text-left text-sm text-foreground">
            <code>
              git clone {REPO_URL}.git{'\n'}
              cd bingoo-open{'\n'}
              pnpm install && pnpm dev
            </code>
          </pre>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={`${REPO_URL}#quickstart`}
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }))}
              rel="noreferrer"
            >
              {t('primary')}
              <ArrowRight className="size-4" aria-hidden />
            </a>
            <a
              href={REPO_URL}
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
              rel="noreferrer"
            >
              <Github className="size-4" aria-hidden />
              {t('secondary')}
            </a>
          </div>
        </div>
      </Container>
    </Section>
  )
}
