'use client'

import type { ExperienceDescriptor } from '@bingoo/learning-experience'
import { LearnExperience, type ExperienceLabels } from '@bingoo/experiences'
import { Avatar, BadgeTile, DailyGoalRing, StreakBadge, SubjectCard, XPBar } from '@bingoo/ui-web'
import { BookOpen, Compass, Flame, Home, Palette, Star, Swords, Trophy, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { LocaleSwitcher } from '@/components/brand/locale-switcher'
import { ThemeToggle } from '@/components/brand/theme-toggle'
import { buildExperienceLabels } from '@/lib/experience-labels'
import {
  buildArena,
  buildCourse,
  buildParticipants,
  buildProject,
  buildQuiz,
  buildRichSteps,
  buildTopics,
  makeRenderActivity,
} from './content'

type TabId = 'home' | 'feed' | 'arena' | 'me'

const DESCR: Record<Exclude<TabId, 'me'>, ExperienceDescriptor> = {
  home: {
    experience: 'learn',
    delivery: 'async',
    companion: 'ai',
    scale: 'solo',
    time: 'on-demand',
  },
  feed: {
    experience: 'feed',
    delivery: 'async',
    companion: 'self',
    scale: 'solo',
    time: 'on-demand',
  },
  arena: { experience: 'arena', delivery: 'live', companion: 'peer', scale: 'class', time: 'live' },
}

export default function LearnPage() {
  const t = useTranslations('learn')
  const exp = useTranslations('kitchenSink.experiences')
  const [tab, setTab] = useState<TabId>('home')

  const expLabels = useMemo(() => buildExperienceLabels(exp), [exp])
  const surfaceLabels = useMemo<ExperienceLabels>(() => buildSurfaceLabels(t), [t])

  const steps = useMemo(() => buildRichSteps(t), [t])
  const topics = useMemo(() => buildTopics(t), [t])
  const course = useMemo(() => buildCourse(t), [t])
  const quiz = useMemo(() => buildQuiz(t), [t])
  const arena = useMemo(() => buildArena(t), [t])
  const project = useMemo(() => buildProject(t), [t])
  const participants = useMemo(() => buildParticipants(t), [t])
  const renderActivity = useMemo(() => makeRenderActivity(t), [t])

  const TABS: { id: TabId; icon: typeof Home; label: string }[] = [
    { id: 'home', icon: Home, label: t('tabs.home') },
    { id: 'feed', icon: Compass, label: t('tabs.feed') },
    { id: 'arena', icon: Swords, label: t('tabs.arena') },
    { id: 'me', icon: User, label: t('tabs.me') },
  ]

  return (
    <div
      data-pack="playful"
      className="mx-auto flex h-dvh max-w-[520px] flex-col overflow-hidden bg-background sm:border-x sm:border-border"
    >
      <main className="min-h-0 flex-1">
        {tab === 'me' ? (
          <ProfileScreen t={t} />
        ) : (
          <LearnExperience
            key={tab}
            descriptor={DESCR[tab]}
            format="course"
            content={{
              steps,
              topics,
              course,
              quiz,
              leaderboard: arena.leaderboard,
              opponents: arena.opponents,
              participants,
              project,
            }}
            labels={surfaceLabels}
            modeLabel={expLabels.experience[DESCR[tab].experience]}
            renderActivity={renderActivity}
            hud={{ xp: 620, streak: 5, hearts: { left: 4, max: 5 } }}
            companionSlot={<p className="text-sm text-foreground-muted">{t('surface.companion')}</p>}
          />
        )}
      </main>

      {/* Bottom tab bar — app-style, thumb zone, safe-area */}
      <nav
        className="grid shrink-0 grid-cols-4 border-t border-border bg-surface/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ id, icon: Icon, label }) => {
          const on = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={on ? 'page' : undefined}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 pt-1.5 outline-none"
            >
              <span
                className={cn(
                  'grid size-9 place-items-center rounded-2xl transition',
                  on ? 'bg-primary-soft text-primary' : 'text-foreground-subtle',
                )}
              >
                <Icon className={cn('size-[22px]', on && 'scale-110')} strokeWidth={on ? 2.6 : 2} />
              </span>
              <span className={cn('text-[10px] font-bold', on ? 'text-primary' : 'text-foreground-subtle')}>
                {label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/* ─────────────────────────── Profile (mobile) ─────────────────────────── */
function ProfileScreen({ t }: { t: (k: string) => string }) {
  const p = (k: string) => t(`profile.${k}`)
  return (
    <div className="h-full overflow-y-auto" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Hero */}
      <div className="relative overflow-hidden bg-[radial-gradient(120%_80%_at_50%_-20%,color-mix(in_srgb,var(--color-primary),transparent_80%),transparent)] px-5 pb-6 pt-8 text-center">
        <div className="mx-auto w-fit">
          <Avatar name="Minh An" size="xl" ring />
        </div>
        <h1 className="mt-3 font-display text-xl font-extrabold text-foreground">Minh An</h1>
        <p className="text-sm text-foreground-muted">{p('grade')}</p>
        <div className="mx-auto mt-4 w-full max-w-xs">
          <XPBar level={4} xp={620} nextXp={1000} />
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <Stat icon={<Flame className="size-5" />} value="5" label={p('streak')} color="coral" />
          <Stat icon={<Star className="size-5" />} value="12" label={p('badges')} color="sunbeam" />
          <Stat icon={<Trophy className="size-5" />} value="#2" label={p('rank')} color="primary" />
        </div>

        {/* Daily goal */}
        <div className="flex items-center gap-4 rounded-3xl border border-border bg-surface p-4">
          <DailyGoalRing value={3} goal={5} size={72} />
          <div className="flex flex-col">
            <span className="font-display font-bold text-foreground">{p('goalTitle')}</span>
            <span className="text-sm text-foreground-muted">{p('goalSub')}</span>
            <StreakBadge days={5} label={p('days')} className="mt-1.5" />
          </div>
        </div>

        {/* Badges */}
        <Section title={p('badges')}>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <BadgeTile icon={<Trophy className="size-5" />} title={p('badgeMath')} color="sunbeam" />
            <BadgeTile icon={<Flame className="size-5" />} title={p('badgeStreak')} color="coral" />
            <BadgeTile icon={<BookOpen className="size-5" />} title={p('badgeRead')} color="teal" />
            <BadgeTile icon={<Star className="size-5" />} title={p('badgeLocked')} locked />
          </div>
        </Section>

        {/* Subjects */}
        <Section title={p('subjects')}>
          <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <SubjectCard
              icon={<span className="text-lg">➗</span>}
              name={p('subjMath')}
              color="primary"
              progress={62}
            />
            <SubjectCard
              icon={<span className="text-lg">📖</span>}
              name={p('subjViet')}
              color="coral"
              progress={40}
            />
            <SubjectCard
              icon={<span className="text-lg">🔬</span>}
              name={p('subjSci')}
              color="teal"
              progress={25}
            />
          </div>
        </Section>

        {/* Settings */}
        <Section title={p('settings')}>
          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="size-4 text-foreground-muted" /> {p('appearance')}
            </span>
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Stat({
  icon,
  value,
  label,
  color,
}: {
  icon: ReactNode
  value: string
  label: string
  color: 'coral' | 'sunbeam' | 'primary' | 'teal'
}) {
  const tint = {
    coral: 'bg-accent-coral-soft text-accent-coral',
    sunbeam: 'bg-accent-sunbeam-soft text-accent-sunbeam',
    primary: 'bg-primary-soft text-primary',
    teal: 'bg-accent-teal-soft text-accent-teal',
  }[color]
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-surface py-3">
      <span className={cn('grid size-9 place-items-center rounded-xl', tint)}>{icon}</span>
      <span className="font-display text-lg font-extrabold text-foreground">{value}</span>
      <span className="text-[11px] text-foreground-muted">{label}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-sm font-bold text-foreground">{title}</h2>
      {children}
    </section>
  )
}

/* build ExperienceLabels từ i18n (giữ như cũ) */
function buildSurfaceLabels(t: (k: string) => string): ExperienceLabels {
  return {
    prev: t('surface.prev'),
    next: t('surface.next'),
    finish: t('surface.finish'),
    loadMore: t('surface.loadMore'),
    completed: t('surface.completed'),
    restart: t('surface.restart'),
    start: t('surface.start'),
    empty: t('surface.empty'),
    exit: t('surface.exit'),
    action: {
      check: t('action.check'),
      next: t('action.next'),
      correct: t('action.correct'),
      incorrect: t('action.incorrect'),
    },
    chrome: {
      live: t('chrome.live'),
      scheduled: t('chrome.scheduled'),
      participants: t('chrome.participants'),
      opponents: t('chrome.opponents'),
    },
    arena: {
      start: t('arenaUi.start'),
      difficultyLabel: t('arenaUi.difficultyLabel'),
      diffEasy: t('arenaUi.diffEasy'),
      diffMid: t('arenaUi.diffMid'),
      diffHard: t('arenaUi.diffHard'),
      pillarLearn: t('arenaUi.pillarLearn'),
      pillarPlay: t('arenaUi.pillarPlay'),
      you: t('arenaUi.you'),
      enemy: t('arenaUi.enemy'),
      boss: t('arenaUi.boss'),
      ally: t('arenaUi.ally'),
      won: t('arenaUi.won'),
      lost: t('arenaUi.lost'),
      combo: t('arenaUi.combo'),
      special: t('arenaUi.special'),
      score: t('arenaUi.score'),
      modes: {
        practice: { title: t('arenaUi.practiceTitle'), desc: t('arenaUi.practiceDesc') },
        coop: { title: t('arenaUi.coopTitle'), desc: t('arenaUi.coopDesc') },
        solo: { title: t('arenaUi.soloTitle'), desc: t('arenaUi.soloDesc') },
        vsAI: { title: t('arenaUi.vsTitle'), desc: t('arenaUi.vsDesc') },
      },
    },
    feed: { swipe: t('feedUi.swipe'), forYou: t('feedUi.forYou') },
    classroom: {
      live: t('classroom.live'),
      title: t('classroom.title'),
      you: t('classroom.you'),
      whiteboard: t('classroom.whiteboard'),
      participants: t('classroom.participants'),
      teacher: t('classroom.teacher'),
      penTool: t('classroom.penTool'),
      clearTool: t('classroom.clearTool'),
      chatTitle: t('classroom.chatTitle'),
      chatPlaceholder: t('classroom.chatPlaceholder'),
      send: t('classroom.send'),
      raiseHand: t('classroom.raiseHand'),
      leave: t('classroom.leave'),
      muteToggle: t('classroom.muteToggle'),
      camToggle: t('classroom.camToggle'),
      share: t('classroom.share'),
      people: t('classroom.people'),
      chat: t('classroom.chat'),
      grid: t('classroom.grid'),
      present: t('classroom.present'),
      reactions: t('classroom.reactions'),
    },
  }
}

function cn(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ')
}
