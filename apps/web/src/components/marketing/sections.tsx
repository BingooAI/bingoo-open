import {
  ArrowRight,
  BookOpenText,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileBarChart,
  FlaskConical,
  Gamepad2,
  Languages,
  LineChart,
  Palette,
  Puzzle,
  Repeat2,
  Rocket,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  UserPlus,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ComponentType } from 'react';
import { Mascot } from '@/components/brand/mascot';
import {
  Avatar,
  Badge,
  buttonVariants,
  Card,
  IconChip,
  type IconChipColor,
  Container,
  Section,
} from '@bingoo/ui-web';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/cn';

type Icon = ComponentType<{ className?: string }>;

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
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
  );
}

/* -------------------------------------------------------------------------- */
/* Stats band                                                                 */
/* -------------------------------------------------------------------------- */
const STATS = [
  { value: '500K+', key: 'learners' },
  { value: '2,000+', key: 'lessons' },
  { value: '4.9/5', key: 'rating' },
  { value: '+35%', key: 'improvement' },
] as const;

export function Stats() {
  const t = useTranslations('landing.stats');
  return (
    <Container size="xl" className="-mt-8 pb-4">
      <Card
        variant="raised"
        className="grid grid-cols-2 gap-y-8 p-8 sm:grid-cols-4 sm:divide-x sm:divide-border"
      >
        {STATS.map((s) => (
          <div key={s.key} className="px-2 text-center">
            <div className="text-gradient-brand font-display text-3xl font-extrabold sm:text-4xl">
              {s.value}
            </div>
            <div className="mt-1.5 text-sm font-medium text-foreground-muted">{t(s.key)}</div>
          </div>
        ))}
      </Card>
    </Container>
  );
}

/* -------------------------------------------------------------------------- */
/* Features                                                                   */
/* -------------------------------------------------------------------------- */
const FEATURES: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'personalized', Icon: Route, color: 'primary' },
  { key: 'gamified', Icon: Gamepad2, color: 'coral' },
  { key: 'mascot', Icon: Sparkles, color: 'sunbeam' },
  { key: 'reports', Icon: LineChart, color: 'teal' },
  { key: 'safe', Icon: ShieldCheck, color: 'success' },
  { key: 'adaptive', Icon: Repeat2, color: 'primary' },
];

export function Features() {
  const t = useTranslations('landing.features');
  return (
    <Section id="features">
      <Container size="xl">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, Icon, color }) => (
            <Card key={key} interactive className="p-6 hover:border-primary/30">
              <IconChip color={color} size="lg" tone="gradient">
                <Icon />
              </IconChip>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">
                {t(`items.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {t(`items.${key}.desc`)}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Subjects                                                                    */
/* -------------------------------------------------------------------------- */
const SUBJECTS: { key: string; Icon: Icon; color: IconChipColor; count: number }[] = [
  { key: 'math', Icon: Calculator, color: 'primary', count: 320 },
  { key: 'vietnamese', Icon: BookOpenText, color: 'coral', count: 280 },
  { key: 'english', Icon: Languages, color: 'teal', count: 240 },
  { key: 'science', Icon: FlaskConical, color: 'sunbeam', count: 180 },
  { key: 'logic', Icon: Puzzle, color: 'success', count: 150 },
  { key: 'art', Icon: Palette, color: 'primary', count: 120 },
];

export function Subjects() {
  const t = useTranslations('landing.subjects');
  return (
    <Section id="subjects" className="bg-surface-muted/40">
      <Container size="xl">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SUBJECTS.map(({ key, Icon, color, count }) => (
            <Card key={key} interactive className="flex items-center gap-4 p-5">
              <IconChip color={color} size="lg" tone="gradient">
                <Icon />
              </IconChip>
              <div>
                <h3 className="font-display font-semibold text-foreground">{t(`items.${key}`)}</h3>
                <p className="text-sm text-foreground-muted">{t('lessonsCount', { count })}</p>
              </div>
              <ArrowRight className="ml-auto size-5 text-foreground-subtle" />
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* How it works                                                                */
/* -------------------------------------------------------------------------- */
const STEPS: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'signup', Icon: UserPlus, color: 'primary' },
  { key: 'assess', Icon: ClipboardList, color: 'teal' },
  { key: 'learn', Icon: Rocket, color: 'coral' },
];

export function HowItWorks() {
  const t = useTranslations('landing.how');
  return (
    <Section id="how">
      <Container size="xl">
        <SectionHeading title={t('title')} subtitle={t('subtitle')} />
        <div className="relative mt-14 grid gap-6 md:grid-cols-3">
          <div
            aria-hidden
            className="absolute left-0 right-0 top-9 hidden border-t-2 border-dashed border-border md:block"
          />
          {STEPS.map(({ key, Icon, color }, i) => (
            <div key={key} className="relative flex flex-col items-center text-center">
              <div className="relative grid size-18 place-items-center rounded-2xl border border-border bg-surface shadow-sm">
                <IconChip color={color} size="lg" tone="gradient">
                  <Icon />
                </IconChip>
                <span className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground shadow-sm">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-foreground">
                {t(`steps.${key}.title`)}
              </h3>
              <p className="mt-2 max-w-xs text-sm text-foreground-muted">
                {t(`steps.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Parents                                                                     */
/* -------------------------------------------------------------------------- */
const PARENT_POINTS: { key: string; Icon: Icon }[] = [
  { key: 'reports', Icon: FileBarChart },
  { key: 'screentime', Icon: Timer },
  { key: 'safe', Icon: ShieldCheck },
  { key: 'multi', Icon: Users },
];

export function Parents() {
  const t = useTranslations('landing.parents');
  const tSub = useTranslations('landing.subjects.items');
  return (
    <Section id="parents" className="bg-surface-muted/40">
      <Container size="xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Badge color="teal" tone="soft" className="mb-4">
              {t('badge')}
            </Badge>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {t('title')}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground-muted">{t('subtitle')}</p>

            <ul className="mt-8 flex flex-col gap-4">
              {PARENT_POINTS.map(({ key, Icon }) => (
                <li key={key} className="flex items-start gap-3">
                  <IconChip color="teal" size="sm">
                    <Icon />
                  </IconChip>
                  <span className="pt-1 text-foreground">{t(`points.${key}`)}</span>
                </li>
              ))}
            </ul>

            <Link
              href="/register"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-8')}
            >
              {t('cta')}
              <ArrowRight className="size-5" />
            </Link>
          </div>

          <Card variant="raised" className="p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <Mascot emotion="care" size={56} float alt="" />
              <div>
                <div className="font-display font-semibold text-foreground">Bingoo</div>
                <div className="text-sm text-foreground-muted">{t('report')}</div>
              </div>
              <Badge color="success" className="ml-auto">
                +12%
              </Badge>
            </div>
            <div className="mt-6 space-y-4">
              {[
                { key: 'math', value: 82, color: 'primary' as const },
                { key: 'vietnamese', value: 68, color: 'coral' as const },
                { key: 'english', value: 74, color: 'teal' as const },
              ].map((row) => (
                <div key={row.key}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{tSub(row.key)}</span>
                    <span className="text-foreground-muted">{row.value}%</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        row.color === 'primary' && 'bg-primary',
                        row.color === 'coral' && 'bg-accent-coral',
                        row.color === 'teal' && 'bg-accent-teal',
                      )}
                      style={{ width: `${row.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonials                                                                */
/* -------------------------------------------------------------------------- */
const TESTIMONIALS = ['one', 'two', 'three'] as const;

export function Testimonials() {
  const t = useTranslations('landing.testimonials');
  return (
    <Section>
      <Container size="xl">
        <SectionHeading title={t('title')} />
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {TESTIMONIALS.map((key) => (
            <Card key={key} className="flex flex-col p-6">
              <div className="flex gap-0.5 text-accent-sunbeam">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-foreground">“{t(`items.${key}.quote`)}”</p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar name={t(`items.${key}.author`)} size="md" />
                <div>
                  <div className="font-display text-sm font-semibold text-foreground">
                    {t(`items.${key}.author`)}
                  </div>
                  <div className="text-xs text-foreground-muted">{t(`items.${key}.role`)}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */
/* Final CTA                                                                   */
/* -------------------------------------------------------------------------- */
export function CtaBand() {
  const t = useTranslations('landing.cta');
  const tHero = useTranslations('landing.hero');
  return (
    <Section>
      <Container size="xl">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-brand px-6 py-16 text-center shadow-pop sm:px-16">
          {/* Drifting dotted texture — `bg-dots` with a white dot color for the
              colored band, animated via the `dots` motion token. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-dots animate-dots [--dots-color:rgb(255_255_255/0.16)]"
          />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <Mascot emotion="celebrate" size={128} float alt="" />
            <h2 className="mt-6 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              {t('title')}
            </h2>
            <p className="mt-3 text-lg text-white/85">{t('subtitle')}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className={buttonVariants({ variant: 'inverse', size: 'lg' })}>
                {t('button')}
                <ArrowRight className="size-5" />
              </Link>
              <a
                href="#features"
                className={buttonVariants({ variant: 'inverse-outline', size: 'lg' })}
              >
                {t('secondary')}
              </a>
            </div>
            <p className="mt-6 inline-flex items-center gap-1.5 text-sm text-white/80">
              <CheckCircle2 className="size-4" />
              {tHero('note')}
            </p>
          </div>
        </div>
      </Container>
    </Section>
  );
}
