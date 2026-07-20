'use client'

import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Calculator,
  FlaskConical,
  Languages,
  Palette,
  Puzzle,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState, type ComponentType } from 'react'
import { Logo } from '@/components/brand/logo'
import { LocaleSwitcher } from '@/components/brand/locale-switcher'
import { Mascot } from '@/components/brand/mascot'
import { ThemeToggle } from '@/components/brand/theme-toggle'
import {
  Button,
  Field,
  IconChip,
  type IconChipColor,
  Input,
  OptionCard,
  Progress,
  SegmentedControl,
  Switch,
} from '@bingoo.ai/ui-web'
import { Link, useRouter } from '@/i18n/navigation'
import { type MascotEmotion } from '@bingoo.ai/core'

type Icon = ComponentType<{ className?: string }>
type Role = 'student' | 'parent'
const CONTENT_STEPS = 5

const SUBJECTS: { key: string; Icon: Icon; color: IconChipColor }[] = [
  { key: 'math', Icon: Calculator, color: 'primary' },
  { key: 'vietnamese', Icon: BookOpenText, color: 'coral' },
  { key: 'english', Icon: Languages, color: 'teal' },
  { key: 'science', Icon: FlaskConical, color: 'sunbeam' },
  { key: 'logic', Icon: Puzzle, color: 'success' },
  { key: 'art', Icon: Palette, color: 'primary' },
]

const GRADES = ['g1', 'g2', 'g3', 'g4', 'g5'] as const
const GOALS = [
  { key: 'relaxed', minutes: 10 },
  { key: 'regular', minutes: 20 },
  { key: 'serious', minutes: 30 },
  { key: 'intense', minutes: 45 },
] as const
const AVATARS: MascotEmotion[] = ['happy', 'excited', 'proud', 'celebrate', 'graduate', 'idea']

export default function OnboardingPage() {
  const t = useTranslations('onboarding')
  const tSub = useTranslations('landing.subjects.items')
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [role, setRole] = useState<Role | null>(null)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState<(typeof GRADES)[number]>('g1')
  const [subjects, setSubjects] = useState<string[]>([])
  const [goal, setGoal] = useState<string | null>(null)
  const [reminder, setReminder] = useState(true)
  const [avatar, setAvatar] = useState<MascotEmotion | null>(null)

  const canNext = useMemo(() => {
    switch (step) {
      case 0:
        return role !== null
      case 1:
        return name.trim().length >= 2
      case 2:
        return subjects.length >= 1
      case 3:
        return goal !== null
      case 4:
        return avatar !== null
      default:
        return true
    }
  }, [step, role, name, subjects, goal, avatar])

  const toggleSubject = (key: string) =>
    setSubjects((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]))

  const finish = () => router.push(role === 'parent' ? '/parent' : '/student')

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* top bar */}
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" aria-label="Bingoo">
            <Logo height={28} />
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <ThemeToggle />
            {step < CONTENT_STEPS && (
              <Button variant="ghost" size="sm" onClick={finish}>
                {t('skip')}
              </Button>
            )}
          </div>
        </div>
        {step < CONTENT_STEPS && (
          <div className="mx-auto w-full max-w-3xl px-5 pb-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground-muted">
              <span>{t('progress', { current: step + 1, total: CONTENT_STEPS })}</span>
            </div>
            <Progress value={((step + 1) / CONTENT_STEPS) * 100} label="Onboarding progress" />
          </div>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-10">
        {/* Step 0 — Role */}
        {step === 0 && (
          <StepShell title={t('role.title')} subtitle={t('role.subtitle')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <OptionCard
                selected={role === 'student'}
                onClick={() => setRole('student')}
                media={<Mascot emotion="studying" size={44} alt="" />}
                title={t('role.student')}
                description={t('role.studentDesc')}
              />
              <OptionCard
                selected={role === 'parent'}
                onClick={() => setRole('parent')}
                media={<Mascot emotion="care" size={44} alt="" />}
                title={t('role.parent')}
                description={t('role.parentDesc')}
              />
            </div>
          </StepShell>
        )}

        {/* Step 1 — Profile */}
        {step === 1 && (
          <StepShell title={t('profile.title')} subtitle={t('profile.subtitle')}>
            <div className="flex flex-col gap-5">
              <Field label={t('profile.nameLabel')}>
                <Input
                  inputSize="lg"
                  placeholder={t('profile.namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field label={t('profile.gradeLabel')}>
                <SegmentedControl
                  aria-label={t('profile.gradeLabel')}
                  value={grade}
                  onChange={setGrade}
                  options={GRADES.map((g) => ({ value: g, label: t(`profile.grades.${g}`) }))}
                />
              </Field>
            </div>
          </StepShell>
        )}

        {/* Step 2 — Subjects */}
        {step === 2 && (
          <StepShell title={t('subjects.title')} subtitle={t('subjects.subtitle')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUBJECTS.map(({ key, Icon, color }) => (
                <OptionCard
                  key={key}
                  mode="multiple"
                  selected={subjects.includes(key)}
                  onClick={() => toggleSubject(key)}
                  media={
                    <IconChip color={color} size="md">
                      <Icon />
                    </IconChip>
                  }
                  title={tSub(key)}
                />
              ))}
            </div>
            <p className="mt-4 text-center text-sm font-medium text-foreground-muted">
              {t('subjects.hint', { count: subjects.length })}
            </p>
          </StepShell>
        )}

        {/* Step 3 — Goals */}
        {step === 3 && (
          <StepShell title={t('goals.title')} subtitle={t('goals.subtitle')}>
            <div className="grid gap-3 sm:grid-cols-2">
              {GOALS.map(({ key, minutes }) => (
                <OptionCard
                  key={key}
                  selected={goal === key}
                  onClick={() => setGoal(key)}
                  title={t(`goals.options.${key}`)}
                  description={t('goals.perDay', { minutes })}
                />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
              <span className="text-sm font-medium text-foreground">{t('goals.reminder')}</span>
              <Switch checked={reminder} onChange={(e) => setReminder(e.target.checked)} />
            </div>
          </StepShell>
        )}

        {/* Step 4 — Avatar */}
        {step === 4 && (
          <StepShell title={t('avatar.title')} subtitle={t('avatar.subtitle')}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {AVATARS.map((emotion) => (
                <OptionCard
                  key={emotion}
                  layout="stacked"
                  selected={avatar === emotion}
                  onClick={() => setAvatar(emotion)}
                  media={<Mascot emotion={emotion} size={72} alt="" />}
                  title={emotion === avatar ? 'Bingoo ✨' : 'Bingoo'}
                />
              ))}
            </div>
          </StepShell>
        )}

        {/* Step 5 — Done */}
        {step === CONTENT_STEPS && (
          <div className="flex animate-pop-in flex-col items-center text-center">
            <Mascot emotion={avatar ?? 'celebrate'} size={160} float alt="" />
            <h1 className="mt-6 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {t('done.title')}
            </h1>
            <p className="mt-3 max-w-md text-lg text-foreground-muted">
              {t('done.subtitle', { name: name.trim() || 'Bingoo' })}
            </p>
            <Button size="xl" className="mt-8" onClick={finish} rightIcon={<ArrowRight className="size-5" />}>
              {t('done.cta')}
            </Button>
          </div>
        )}
      </main>

      {/* footer controls */}
      {step < CONTENT_STEPS && (
        <footer className="sticky bottom-0 border-t border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-5 py-4">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              leftIcon={<ArrowLeft className="size-4" />}
            >
              {t('back')}
            </Button>
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              rightIcon={<ArrowRight className="size-4" />}
            >
              {t('next')}
            </Button>
          </div>
        </footer>
      )}
    </div>
  )
}

function StepShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-2 text-foreground-muted">{subtitle}</p>
      <div className="mt-8">{children}</div>
    </div>
  )
}
