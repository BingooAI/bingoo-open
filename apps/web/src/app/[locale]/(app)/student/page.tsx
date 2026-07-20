// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ArrowRight, Calculator, Check, Clock, Crown, Flame, Play, Target, Trophy, Zap } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Mascot } from '@/components/brand/mascot'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  IconChip,
  Progress,
  ProgressRing,
  StatCard,
} from '@bingoo.ai/ui-web'
import { cn } from '@/lib/cn'
import {
  achievements,
  continueLesson,
  leaderboard,
  student,
  subjectProgress,
  todayQuests,
} from '@/lib/demo-data'
import { greetingKey } from '@bingoo.ai/core'

export default function StudentDashboard() {
  const t = useTranslations('student')
  const tc = useTranslations('common')
  const tSub = useTranslations('landing.subjects.items')
  const format = useFormatter()

  const [done, setDone] = useState(() => todayQuests.map((q) => q.done))
  const goalPct = Math.round((student.minutesToday / student.goalMinutes) * 100)
  const goalMet = student.minutesToday >= student.goalMinutes

  return (
    <div className="space-y-6">
      {/* Welcome hero */}
      <Card
        variant="gradient"
        className="relative overflow-hidden p-6 shadow-pop ring-1 ring-inset ring-white/15 sm:p-8"
      >
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_88%_-10%,rgba(255,255,255,0.35),transparent_55%)]"
        />
        <div aria-hidden className="absolute inset-0 bg-dots opacity-10" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <Badge tone="solid" className="bg-white/20 text-white backdrop-blur-sm">
              <Flame className="size-3.5" />
              {t('hero.streakValue', { count: student.streak })}
            </Badge>
            <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-white sm:text-[2rem]">
              {t('hero.greeting', {
                greeting: tc(`greeting.${greetingKey()}`),
                name: student.name,
              })}
            </h1>
            <p className="mt-1.5 text-white/85">{t('hero.subtitle')}</p>
            <Button variant="secondary" className="mt-5" rightIcon={<ArrowRight className="size-4" />}>
              {t('hero.cta')}
            </Button>
          </div>
          <Mascot emotion={student.avatar} size={160} float alt="" className="hidden shrink-0 sm:block" />
        </div>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Zap />}
          color="sunbeam"
          value={format.number(student.xpWeek)}
          label={t('stats.xp')}
          trend={{ value: '+12%', direction: 'up' }}
        />
        <StatCard
          icon={<Clock />}
          color="teal"
          value={`${student.minutesToday} ${tc('unit.minutesShort')}`}
          label={t('stats.minutes')}
        />
        <StatCard icon={<Trophy />} color="primary" value={student.lessonsDone} label={t('stats.lessons')} />
        <StatCard
          icon={<Target />}
          color="success"
          value={`${student.accuracy}%`}
          label={t('stats.accuracy')}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Continue learning */}
          <Card>
            <CardHeader>
              <CardTitle>{t('continue.title')}</CardTitle>
            </CardHeader>
            <div className="px-6 pb-6">
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-muted/50 p-4">
                <IconChip color="primary" size="lg">
                  <Calculator />
                </IconChip>
                <div className="min-w-0 flex-1">
                  <div className="font-display font-semibold text-foreground">{tSub('math')}</div>
                  <div className="text-sm text-foreground-muted">
                    {t('continue.lessonLabel', { number: continueLesson.number })}
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={continueLesson.percent} size="sm" className="flex-1" />
                    <span className="text-xs font-semibold text-foreground-muted">
                      {t('continue.progress', { percent: continueLesson.percent })}
                    </span>
                  </div>
                </div>
                <Button size="icon" aria-label={t('continue.resume')}>
                  <Play className="size-5 fill-current" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Today's quests */}
          <Card>
            <CardHeader>
              <CardTitle>{t('today.title')}</CardTitle>
              <p className="text-sm text-foreground-muted">{t('today.subtitle')}</p>
            </CardHeader>
            <ul className="flex flex-col gap-2 px-6 pb-6">
              {todayQuests.map((quest, i) => (
                <li key={quest.key}>
                  <button
                    type="button"
                    onClick={() => setDone((d) => d.map((v, idx) => (idx === i ? !v : v)))}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border p-3 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-full border-2 transition-colors',
                        done[i] ? 'border-success bg-success text-white' : 'border-border-strong',
                      )}
                    >
                      {done[i] && <Check className="size-4" strokeWidth={3} />}
                    </span>
                    <span
                      className={cn(
                        'flex-1 font-medium text-foreground',
                        done[i] && 'text-foreground-muted line-through',
                      )}
                    >
                      {t(`today.items.${quest.key}`)}
                    </span>
                    <Badge color="sunbeam" tone="soft">
                      {t('today.reward', { xp: quest.xp })}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Subjects */}
          <Card>
            <CardHeader>
              <CardTitle>{t('subjects.title')}</CardTitle>
            </CardHeader>
            <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2">
              {subjectProgress.map((s) => (
                <div key={s.key} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display font-semibold text-foreground">{tSub(s.key)}</span>
                    <span className="ml-auto text-sm font-semibold text-foreground-muted">{s.percent}%</span>
                  </div>
                  <Progress
                    value={s.percent}
                    color={s.color as 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success'}
                    className="mt-3"
                  />
                  <p className="mt-2 text-xs text-foreground-muted">
                    {t('subjects.progressLabel', { percent: s.percent })}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Daily goal */}
          <Card className="p-6 text-center">
            <CardTitle className="mb-4">{t('goal.title')}</CardTitle>
            <ProgressRing
              value={goalPct}
              size={140}
              strokeWidth={12}
              color={goalMet ? 'success' : 'primary'}
              className="mx-auto"
            >
              <div className="text-center">
                <div className="font-display text-2xl font-bold text-foreground">{student.minutesToday}</div>
                <div className="text-xs text-foreground-muted">
                  {t('goal.value', { done: student.minutesToday, total: student.goalMinutes })}
                </div>
              </div>
            </ProgressRing>
            <p className="mt-4 text-sm font-medium text-foreground-muted">
              {goalMet
                ? t('goal.done')
                : t('goal.remaining', { minutes: student.goalMinutes - student.minutesToday })}
            </p>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>{t('achievements.title')}</CardTitle>
              <button className="text-sm font-semibold text-primary hover:underline">
                {t('achievements.seeAll')}
              </button>
            </CardHeader>
            <div className="grid grid-cols-2 gap-3 px-6 pb-6">
              {achievements.map((a) => (
                <div
                  key={a.key}
                  className="flex flex-col items-center gap-2 rounded-2xl border border-border p-3 text-center"
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-surface-muted text-2xl">
                    {a.icon}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {t(`achievements.items.${a.key}`)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle>{t('leaderboard.title')}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col gap-1 px-4 pb-4">
              {leaderboard.map((row, i) => (
                <li
                  key={row.name}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-2.5 py-2',
                    row.you && 'bg-primary-soft/60',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
                      i === 0 ? 'bg-accent-sunbeam text-accent-sunbeam-foreground' : 'text-foreground-muted',
                    )}
                  >
                    {i === 0 ? <Crown className="size-3.5" /> : i + 1}
                  </span>
                  <Avatar name={row.name} size="xs" />
                  <span
                    className={cn(
                      'flex-1 truncate text-sm',
                      row.you ? 'font-bold text-primary' : 'text-foreground',
                    )}
                  >
                    {row.you ? t('leaderboard.you') : row.name}
                  </span>
                  <span className="text-sm font-semibold text-foreground-muted">
                    {t('leaderboard.xp', { xp: format.number(row.xp) })}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Mascot tip */}
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-accent-teal-soft/60 p-4">
            <Mascot emotion="idea" size={48} float alt="" />
            <p className="text-sm font-medium text-foreground">{t('mascotTip')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
