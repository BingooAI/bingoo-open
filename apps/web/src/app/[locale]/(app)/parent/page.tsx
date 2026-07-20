'use client'

import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Flame,
  Plus,
  Target,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState, type ComponentType } from 'react'
import { Mascot } from '@/components/brand/mascot'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  IconChip,
  Progress,
  ProgressRing,
  StatCard,
} from '@bingoo/ui-web'
import { cn } from '@/lib/cn'
import { activities, children, parent, recommendations, weeklySubjects } from '@/lib/demo-data'

type Icon = ComponentType<{ className?: string }>
const ACTIVITY_ICON: Record<string, Icon> = {
  completed: CheckCircle2,
  badge: Award,
  quiz: ClipboardCheck,
  practice: Target,
}

export default function ParentDashboard() {
  const t = useTranslations('parent')
  const tSub = useTranslations('landing.subjects.items')

  const [childId, setChildId] = useState(children[0]!.id)
  const child = children.find((c) => c.id === childId) ?? children[0]!
  const { stats, screentime } = parent

  const activityText = (a: (typeof activities)[number]) => {
    switch (a.type) {
      case 'completed':
        return t('activity.completed', { lesson: a.arg })
      case 'badge':
        return t('activity.badge', { badge: a.arg })
      case 'quiz':
        return t('activity.quiz', { subject: tSub(a.arg) })
      case 'practice':
        return t('activity.practice', { subject: tSub(a.arg) })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            {t('header.title')}
          </h1>
          <p className="mt-1 text-foreground-muted">{t('header.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color="neutral" tone="outline">
            {t('header.period')}
          </Badge>
          <Button variant="secondary" size="sm" leftIcon={<Plus className="size-4" />}>
            {t('header.addChild')}
          </Button>
        </div>
      </div>

      {/* Child switcher */}
      <div className="flex flex-wrap gap-3">
        {children.map((c) => {
          const selected = c.id === childId
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setChildId(c.id)}
              aria-pressed={selected}
              className={cn(
                'flex items-center gap-3 rounded-2xl border-2 bg-surface p-3 pr-5 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected ? 'border-primary shadow-sm' : 'border-border hover:border-border-strong',
              )}
            >
              <span className="grid size-11 place-items-center rounded-full bg-surface-muted">
                <Mascot emotion={c.emotion} size={38} alt="" />
              </span>
              <span>
                <span className="flex items-center gap-2">
                  <span className="font-display font-semibold text-foreground">{c.name}</span>
                  {c.active && <span className="size-2 rounded-full bg-success" aria-hidden />}
                </span>
                <span className="block text-xs text-foreground-muted">
                  {t('children.grade', { grade: c.grade })} ·{' '}
                  {c.active ? t('children.activeNow') : t('children.lastActive', { time: c.lastActive })}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Clock />}
          color="primary"
          value={t('stats.timeValue', { hours: stats.hours, minutes: stats.minutes })}
          label={t('stats.time')}
          trend={{ value: '+8%', direction: 'up' }}
        />
        <StatCard icon={<BookOpen />} color="teal" value={stats.lessons} label={t('stats.lessons')} />
        <StatCard
          icon={<Target />}
          color="success"
          value={`${stats.accuracy}%`}
          label={t('stats.accuracy')}
        />
        <StatCard icon={<Flame />} color="coral" value={stats.streak} label={t('stats.streak')} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Weekly progress */}
          <Card>
            <CardHeader>
              <CardTitle>{t('weekly.title')}</CardTitle>
              <p className="text-sm text-foreground-muted">{t('weekly.subtitle')}</p>
            </CardHeader>
            <div className="space-y-5 px-6 pb-6">
              {weeklySubjects.map((s) => (
                <div key={s.key}>
                  <div className="mb-2 flex items-center gap-3">
                    <IconChip color={s.color} size="sm">
                      <BookOpen />
                    </IconChip>
                    <span className="font-medium text-foreground">{tSub(s.key)}</span>
                    <span
                      className={cn(
                        'ml-auto inline-flex items-center gap-0.5 text-xs font-semibold',
                        s.direction === 'up' ? 'text-success' : 'text-danger',
                      )}
                    >
                      {s.direction === 'up' ? (
                        <TrendingUp className="size-3.5" />
                      ) : (
                        <TrendingDown className="size-3.5" />
                      )}
                      {s.direction === 'up'
                        ? t('weekly.up', { value: s.delta })
                        : t('weekly.down', { value: s.delta })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress
                      value={s.percent}
                      color={s.color as 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'}
                      className="flex-1"
                    />
                    <span className="w-28 text-right text-xs text-foreground-muted">
                      {t('weekly.mastery', { percent: s.percent })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('activity.title')}</CardTitle>
              <button className="text-sm font-semibold text-primary hover:underline">
                {t('activity.seeAll')}
              </button>
            </CardHeader>
            <ul className="flex flex-col gap-1 px-4 pb-4">
              {activities.map((a) => {
                const ActIcon = ACTIVITY_ICON[a.type]!
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl px-2.5 py-2.5 hover:bg-surface-muted"
                  >
                    <IconChip color={a.color} size="sm">
                      <ActIcon />
                    </IconChip>
                    <span className="flex-1 text-sm text-foreground">{activityText(a)}</span>
                    <span className="text-xs text-foreground-subtle">{a.time}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Screen time */}
          <Card className="p-6 text-center">
            <CardTitle className="mb-1">{t('screentime.title')}</CardTitle>
            <p className="mb-4 text-sm text-foreground-muted">{t('screentime.subtitle')}</p>
            <ProgressRing
              value={(screentime.done / screentime.total) * 100}
              size={132}
              strokeWidth={12}
              color="teal"
              className="mx-auto"
            >
              <div className="text-center">
                <Timer className="mx-auto size-5 text-foreground-muted" />
                <div className="mt-1 font-display text-xl font-bold text-foreground">
                  {t('screentime.ofLimit', { done: screentime.done, total: screentime.total })}
                </div>
              </div>
            </ProgressRing>
            <Button variant="secondary" size="sm" className="mt-5">
              {t('screentime.edit')}
            </Button>
          </Card>

          {/* Message from Bingoo */}
          <Card variant="muted" className="p-6">
            <div className="flex items-center gap-3">
              <Mascot emotion="care" size={48} float alt="" />
              <CardTitle>{t('message.title')}</CardTitle>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-foreground">
              {t('message.body', { name: child.name })}
            </p>
            <Button variant="link" className="mt-3 text-sm">
              {t('message.cta')} →
            </Button>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>{t('recommendations.title')}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-3 px-6 pb-6">
              {recommendations.map((r) => (
                <li key={r.lesson} className="flex items-center gap-3 rounded-2xl border border-border p-3">
                  <IconChip color={r.color} size="md">
                    <BookOpen />
                  </IconChip>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-foreground">{r.lesson}</div>
                    <div className="text-xs text-foreground-muted">
                      {tSub(r.subjectKey)} · +{r.xp} XP
                    </div>
                  </div>
                  <Button size="sm" variant="soft">
                    {t('recommendations.cta')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
