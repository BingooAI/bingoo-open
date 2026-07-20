import { AnswerOption, AvatarGroup, Button, cn, Confetti, IconChip, Leaderboard } from '@bingoo.ai/ui-web'
import {
  Crown,
  GraduationCap,
  Heart,
  HeartPulse,
  Music,
  Swords,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  initMatch,
  MAX_HEARTS,
  resolveRound,
  specialReady,
  useSpecial,
  type ArenaMode as ArenaModeKind,
  type Difficulty,
  type MatchState,
} from '../arena/engine'
import { playSfx, startBgm, stopBgm } from '../arena/sfx'
import { EmptyState } from '../shared'
import type { ArenaConfig, ExperienceLabels, LearnQuizItem, Participant } from '../types'
import type { LeaderboardEntry } from '@bingoo.ai/ui-web'

const MODES: ArenaModeKind[] = ['practice', 'coop', 'solo', 'vsAI']
const MODE_ICON = { practice: GraduationCap, coop: Users, solo: HeartPulse, vsAI: Swords } as const
const FOE_EMOJI: Record<ArenaModeKind, string> = { vsAI: '🤖', coop: '🐲', solo: '', practice: '' }
const isPlay = (m: ArenaModeKind) => m === 'solo' || m === 'vsAI'
const ROUND_MS = 12_000

// Keyframes cho FX — inject 1 lần, chạy được cả dark/light (không phụ thuộc màu).
const FX_CSS = `
@keyframes exp-shake{0%,100%{transform:translateX(0)}15%{transform:translateX(-7px)}30%{transform:translateX(7px)}45%{transform:translateX(-5px)}60%{transform:translateX(5px)}80%{transform:translateX(-2px)}}
@keyframes exp-lunge{0%,100%{transform:translateX(0) scale(1)}45%{transform:translateX(-22px) scale(1.06)}}
@keyframes exp-float{0%{transform:translateY(0) scale(.9);opacity:0}12%{opacity:1}100%{transform:translateY(-64px) scale(1.15);opacity:0}}
@keyframes exp-flash{0%{opacity:.55}100%{opacity:0}}
@keyframes exp-banner{0%{transform:scale(.6) translateY(8px);opacity:0}25%{transform:scale(1.05);opacity:1}70%{transform:scale(1);opacity:1}100%{transform:scale(1.1);opacity:0}}
@keyframes exp-pop{0%{transform:scale(.4);opacity:0}55%{transform:scale(1.25)}100%{transform:scale(1);opacity:1}}
`

export function ArenaMode({
  quiz = [],
  leaderboard,
  opponents,
  labels,
  config,
}: {
  quiz?: LearnQuizItem[]
  leaderboard?: LeaderboardEntry[]
  opponents?: Participant[]
  labels: ExperienceLabels
  config?: ArenaConfig
}) {
  const [started, setStarted] = useState<{ mode: ArenaModeKind; difficulty: Difficulty } | null>(null)
  const [difficulty, setDifficulty] = useState<Difficulty>('mid')
  const a = labels.arena

  if (quiz.length === 0) return <EmptyState>{labels.empty}</EmptyState>
  if (started)
    return (
      <ArenaBattle
        mode={started.mode}
        difficulty={started.difficulty}
        quiz={quiz}
        labels={labels}
        config={config}
        onExit={() => setStarted(null)}
      />
    )

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-[radial-gradient(130%_90%_at_50%_-20%,color-mix(in_srgb,var(--color-accent-coral),transparent_84%),transparent)]">
      <div className="mx-auto w-full max-w-lg px-4 py-6">
        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <IconChip color="coral" tone="gradient" size="lg">
            <Swords className="size-7" />
          </IconChip>
          {opponents && opponents.length > 0 ? <AvatarGroup avatars={opponents} max={4} /> : null}
        </div>
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          {MODES.map((md) => {
            const Icon = MODE_ICON[md]
            return (
              <div
                key={md}
                className="flex flex-col gap-1.5 rounded-2xl border border-border bg-surface/80 px-3.5 py-3 text-left shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:border-accent-coral hover:shadow-md"
              >
                <span className="flex items-center justify-between">
                  <IconChip color={isPlay(md) ? 'coral' : 'primary'} size="sm" tone="soft">
                    <Icon className="size-4" />
                  </IconChip>
                  <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-foreground-muted">
                    {isPlay(md) ? a.pillarPlay : a.pillarLearn}
                  </span>
                </span>
                <span className="font-display font-bold leading-tight text-foreground">
                  {a.modes[md].title}
                </span>
                <span className="text-[11px] leading-snug text-foreground-muted">{a.modes[md].desc}</span>
                <button
                  type="button"
                  onClick={() => setStarted({ mode: md, difficulty })}
                  className="mt-1 inline-flex w-fit rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {a.start}
                </button>
              </div>
            )
          })}
        </div>
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground-muted">
          {a.difficultyLabel}
        </div>
        <div className="mb-5 flex gap-2">
          {(['easy', 'mid', 'hard'] as Difficulty[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={cn(
                'flex-1 rounded-xl border py-2 text-sm font-bold transition',
                difficulty === d
                  ? 'border-accent-coral bg-accent-coral-soft text-accent-coral'
                  : 'border-border bg-surface text-foreground-muted hover:border-accent-coral/60',
              )}
            >
              {d === 'easy' ? a.diffEasy : d === 'mid' ? a.diffMid : a.diffHard}
            </button>
          ))}
        </div>
        {leaderboard && leaderboard.length > 0 ? (
          <div className="rounded-2xl border border-border bg-surface/80 p-3 shadow-sm backdrop-blur">
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground-muted">
              <Trophy className="size-3.5 text-accent-sunbeam" /> {a.score}
            </div>
            <Leaderboard entries={leaderboard} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Practice = battle mode 'practice', tự khởi động lại khi xong (không có màn chọn mode). */
export function PracticeBattle({
  quiz = [],
  labels,
  config,
}: {
  quiz?: LearnQuizItem[]
  labels: ExperienceLabels
  config?: ArenaConfig
}) {
  const [n, setN] = useState(0)
  if (quiz.length === 0) return <EmptyState>{labels.empty}</EmptyState>
  return (
    <ArenaBattle
      key={n}
      mode="practice"
      difficulty="mid"
      quiz={quiz}
      labels={labels}
      config={config}
      onExit={() => setN((x) => x + 1)}
    />
  )
}

/* ─────────────────────────── BATTLE ─────────────────────────── */
interface Fx {
  id: number
  side: 'you' | 'foe'
  text: string
  tone: 'good' | 'bad' | 'combo'
}

function HpBar({
  value,
  max,
  tone,
  shake,
}: {
  value: number
  max: number
  tone: 'you' | 'foe'
  shake?: number
}) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0))
  return (
    <div
      key={shake}
      className="h-3.5 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-border"
      style={shake ? { animation: 'exp-shake .4s' } : undefined}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out',
          tone === 'you'
            ? 'bg-gradient-to-r from-success to-accent-teal'
            : 'bg-gradient-to-r from-accent-coral to-danger',
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function CountRing({ ms, index }: { ms: number; index: number }) {
  const pct = Math.max(0, Math.min(1, ms / ROUND_MS))
  const r = 16
  const circ = 2 * Math.PI * r
  const low = ms <= 3000
  return (
    <div className="relative grid size-11 place-items-center" title={String(Math.ceil(ms / 1000))}>
      <svg viewBox="0 0 40 40" className="size-11 -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--color-surface-muted)" strokeWidth="4" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={low ? 'var(--color-danger)' : 'var(--color-primary)'}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          style={{ transition: 'stroke-dashoffset .2s linear' }}
        />
      </svg>
      <span
        className={cn(
          'absolute text-xs font-bold tabular-nums',
          low ? 'text-danger motion-safe:animate-pulse' : 'text-foreground',
        )}
      >
        {index + 1}
      </span>
    </div>
  )
}

function Fighter({
  emoji,
  label,
  color,
  boss,
  hitKey,
  attackKey,
  fx,
}: {
  emoji: string
  label: ReactNode
  color: string
  boss?: boolean
  hitKey: number
  attackKey: number
  fx: Fx[]
}) {
  return (
    <div className="relative flex flex-col items-center gap-1">
      {boss ? <Crown className="size-5 text-accent-sunbeam" /> : null}
      <div
        key={`${hitKey}-${attackKey}`}
        className={cn(
          'grid size-16 place-items-center rounded-2xl text-3xl shadow-md sm:size-20 sm:text-4xl',
          color,
        )}
        style={
          attackKey ? { animation: 'exp-lunge .4s' } : hitKey ? { animation: 'exp-shake .4s' } : undefined
        }
      >
        {emoji}
      </div>
      <span className="text-xs font-bold text-foreground">{label}</span>
      {/* Số sát thương bay */}
      <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center">
        {fx.map((f) => (
          <span
            key={f.id}
            className={cn(
              'absolute font-display text-xl font-extrabold drop-shadow',
              f.tone === 'good' ? 'text-success' : f.tone === 'combo' ? 'text-accent-sunbeam' : 'text-danger',
            )}
            style={{ animation: 'exp-float .9s forwards' }}
          >
            {f.text}
          </span>
        ))}
      </div>
    </div>
  )
}

export function ArenaBattle({
  mode,
  difficulty,
  quiz,
  labels,
  config,
  onExit,
}: {
  mode: ArenaModeKind
  difficulty: Difficulty
  quiz: LearnQuizItem[]
  leaderboard?: LeaderboardEntry[]
  labels: ExperienceLabels
  config?: ArenaConfig
  onExit: () => void
}) {
  const a = labels.arena
  const versus = mode === 'vsAI' || mode === 'coop'
  const youEmoji = config?.youEmoji ?? '🧑‍🎓'
  const allyEmoji = config?.allyEmoji ?? '🐣'
  const foeEmoji =
    mode === 'coop' ? (config?.bossEmoji ?? '🐲') : (config?.enemyEmoji ?? FOE_EMOJI[mode] ?? '🤖')
  const [match, setMatch] = useState<MatchState>(() =>
    initMatch({ mode, difficulty, totalRounds: config?.rounds ?? Math.max(quiz.length, 6) }),
  )
  const [qIndex, setQIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(ROUND_MS)
  const [fx, setFx] = useState<Fx[]>([])
  const [foeHit, setFoeHit] = useState(0)
  const [foeAtk, setFoeAtk] = useState(0)
  const [youHit, setYouHit] = useState(0)
  const [flash, setFlash] = useState<{ k: number; tone: 'good' | 'bad' } | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [musicOn, setMusicOn] = useState(true)
  const fxId = useRef(0)
  const soundRef = useRef(soundOn)
  soundRef.current = soundOn

  const question = quiz[qIndex % quiz.length]!
  const revealed = picked != null
  const done = match.status !== 'playing'
  const sfx = (k: Parameters<typeof playSfx>[0]) => {
    if (soundRef.current) playSfx(k)
  }

  // Nhạc nền
  useEffect(() => {
    if (musicOn) startBgm()
    else stopBgm()
    return () => stopBgm()
  }, [musicOn])

  // Beat vòng mới: banner + reset đồng hồ
  useEffect(() => {
    setTimeLeft(ROUND_MS)
    sfx('round')
  }, [qIndex])

  // Đồng hồ đếm ngược mỗi vòng
  useEffect(() => {
    if (revealed || done) return
    if (timeLeft <= 0) {
      answer(null)
      return
    }
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 100)), 100)
    return () => clearTimeout(id)
  }, [timeLeft, revealed, done])

  // Kết thúc: nhạc thắng/thua
  useEffect(() => {
    if (done) {
      stopBgm()
      sfx(match.status === 'won' ? 'win' : match.status === 'lost' ? 'lose' : 'win')
    }
  }, [done])

  function pushFx(side: 'you' | 'foe', text: string, tone: Fx['tone']) {
    const id = ++fxId.current
    setFx((f) => [...f, { id, side, text, tone }])
    setTimeout(() => setFx((f) => f.filter((x) => x.id !== id)), 900)
  }

  function answer(choiceId: string | null) {
    if (revealed || done) return
    const correct = choiceId === question.answerId
    setPicked(choiceId ?? '__timeout__')
    const before = match
    const after = resolveRound(before, { correct, timeMs: ROUND_MS - timeLeft })
    setMatch(after)
    const foeDmg = before.foe.hp - after.foe.hp
    const youDmg = before.you.hp - after.you.hp
    setFlash({ k: Date.now(), tone: correct ? 'good' : 'bad' })
    if (correct) {
      sfx('correct')
      if (foeDmg > 0) {
        pushFx('foe', `-${foeDmg}`, 'good')
        setFoeHit((n) => n + 1)
        sfx('hit')
      }
      if (after.you.combo >= 2) {
        pushFx('you', `x${after.you.combo}`, 'combo')
        sfx('combo')
      }
    } else {
      sfx('wrong')
    }
    if (youDmg > 0) {
      pushFx('you', `-${youDmg}`, 'bad')
      setYouHit((n) => n + 1)
      setFoeAtk((n) => n + 1)
    }
    if (mode === 'solo' && !correct) setYouHit((n) => n + 1)
    // Tự chuyển vòng sau khi lộ đáp án (nhịp)
    window.setTimeout(() => {
      setPicked(null)
      setQIndex((i) => i + 1)
    }, 1300)
  }

  function special() {
    if (!specialReady(match) || done) return
    const before = match
    const after = useSpecial(before)
    setMatch(after)
    sfx('special')
    const foeDmg = before.foe.hp - after.foe.hp
    if (foeDmg > 0) {
      pushFx('foe', `-${foeDmg}`, 'good')
      setFoeHit((n) => n + 1)
    }
  }

  if (done) {
    const won = match.status === 'won' || match.status === 'done'
    return (
      <div className="relative grid h-full place-items-center overflow-hidden bg-[radial-gradient(120%_90%_at_50%_-10%,color-mix(in_srgb,var(--color-accent-coral),transparent_84%),transparent)] p-6">
        <style>{FX_CSS}</style>
        {won ? <Confetti /> : null}
        <div
          className="flex flex-col items-center gap-4 rounded-3xl border border-border bg-surface/90 p-10 text-center shadow-xl backdrop-blur"
          style={{ animation: 'exp-pop .5s' }}
        >
          <div className="text-6xl" style={{ animation: 'exp-pop .6s' }}>
            {won ? '🏆' : '💥'}
          </div>
          <p className="font-display text-2xl font-extrabold text-foreground">
            {mode === 'practice' ? labels.completed : won ? a.won : a.lost}
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full bg-accent-sunbeam-soft px-3 py-1 text-sm font-bold text-accent-sunbeam">
            <Trophy className="size-4" /> {a.score}: {match.score}
          </p>
          <Button onClick={onExit}>{labels.restart}</Button>
        </div>
      </div>
    )
  }

  const youFx = fx.filter((f) => f.side === 'you')
  const foeFx = fx.filter((f) => f.side === 'foe')

  return (
    <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(130%_80%_at_50%_-15%,color-mix(in_srgb,var(--color-accent-coral),transparent_86%),transparent)]">
      <style>{FX_CSS}</style>

      {/* Flash đúng/sai */}
      {flash ? (
        <div
          key={flash.k}
          className={cn(
            'pointer-events-none absolute inset-0 z-20',
            flash.tone === 'good' ? 'bg-success/30' : 'bg-danger/30',
          )}
          style={{ animation: 'exp-flash .45s forwards' }}
        />
      ) : null}

      {/* Banner vòng (beat) */}
      <div key={qIndex} className="pointer-events-none absolute inset-x-0 top-16 z-20 flex justify-center">
        <span
          className="rounded-full bg-foreground/85 px-5 py-1.5 font-display text-lg font-extrabold text-background"
          style={{ animation: 'exp-banner 1.1s forwards' }}
        >
          {a.modes[mode].title} · {qIndex + 1}/{match.totalRounds}
        </span>
      </div>

      {/* HP + countdown */}
      <header className="z-10 shrink-0 border-b border-border bg-surface/70 px-4 py-3 backdrop-blur">
        {versus ? (
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="truncate text-xs font-bold text-success">{a.you}</span>
              <HpBar value={match.you.hp} max={match.you.maxHp} tone="you" shake={youHit} />
            </div>
            <CountRing ms={timeLeft} index={qIndex} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="inline-flex items-center justify-end gap-1 truncate text-xs font-bold text-danger">
                {mode === 'coop' ? <Crown className="size-3.5" /> : null}
                {mode === 'coop' ? a.boss : a.enemy}
              </span>
              <HpBar value={match.foe.hp} max={match.foe.maxHp} tone="foe" shake={foeHit} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            {mode === 'solo' ? (
              <span className="inline-flex items-center gap-1">
                {Array.from({ length: MAX_HEARTS }).map((_, i) => (
                  <Heart
                    key={i}
                    className={cn(
                      'size-6 transition',
                      i < match.hearts ? 'fill-danger text-danger' : 'text-border',
                    )}
                  />
                ))}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground-muted">
                <IconChip color="primary" size="sm" tone="soft">
                  <GraduationCap className="size-4" />
                </IconChip>
                {a.modes.practice.title}
              </span>
            )}
            <CountRing ms={timeLeft} index={qIndex} />
            {match.you.combo >= 2 ? (
              <span
                className="rounded-full bg-accent-sunbeam-soft px-2.5 py-1 text-sm font-extrabold text-accent-sunbeam"
                style={{ animation: 'exp-pop .3s' }}
              >
                {a.combo} ×{match.you.combo}
              </span>
            ) : (
              <span className="w-16" />
            )}
          </div>
        )}
      </header>

      {/* Sân khấu nhân vật */}
      {versus ? (
        <div className="z-10 flex shrink-0 items-end justify-center gap-6 px-4 py-4 sm:gap-12">
          <Fighter
            emoji={youEmoji}
            label={a.you}
            color="bg-gradient-to-br from-success/25 to-accent-teal/15"
            hitKey={youHit}
            attackKey={0}
            fx={youFx}
          />
          {mode === 'coop' ? (
            <Fighter
              emoji={allyEmoji}
              label={a.ally}
              color="bg-gradient-to-br from-primary/25 to-accent-teal/15"
              hitKey={0}
              attackKey={0}
              fx={[]}
            />
          ) : null}
          <div className="pb-6 text-2xl text-foreground-muted">
            <Swords className="size-6" />
          </div>
          <Fighter
            emoji={foeEmoji}
            label={mode === 'coop' ? a.boss : a.enemy}
            color="bg-gradient-to-br from-accent-coral/25 to-danger/15"
            boss={mode === 'coop'}
            hitKey={foeHit}
            attackKey={foeAtk}
            fx={foeFx}
          />
        </div>
      ) : (
        <div className="z-10 flex shrink-0 items-center justify-center py-3">
          <Fighter
            emoji={mode === 'solo' ? youEmoji : '📚'}
            label={a.you}
            color="bg-gradient-to-br from-primary/20 to-accent-teal/10"
            hitKey={youHit}
            attackKey={0}
            fx={youFx}
          />
        </div>
      )}

      {/* Câu hỏi */}
      <div className="z-10 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3">
          {specialReady(match) ? (
            <button
              type="button"
              onClick={special}
              className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-sunbeam to-accent-coral px-4 py-2 text-sm font-extrabold text-white shadow-lg motion-safe:animate-pulse"
            >
              <Zap className="size-4" /> {a.special}
            </button>
          ) : null}
          <p className="font-display text-xl font-bold text-foreground">{question.prompt}</p>
          <div className="flex flex-col gap-2">
            {question.choices.map((c, i) => {
              const state = !revealed
                ? 'default'
                : c.id === question.answerId
                  ? 'correct'
                  : picked === c.id
                    ? 'incorrect'
                    : 'default'
              return (
                <AnswerOption
                  key={c.id}
                  letter={String.fromCharCode(65 + i)}
                  label={c.label}
                  state={state}
                  disabled={revealed}
                  onClick={() => answer(c.id)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Điều khiển: âm thanh / nhạc / rời */}
      <footer className="z-10 flex shrink-0 items-center justify-center gap-2 border-t border-border bg-surface/70 px-4 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setSoundOn((v) => !v)}
          aria-label="sound"
          className="grid size-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted"
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMusicOn((v) => !v)}
          aria-label="music"
          className={cn(
            'grid size-8 place-items-center rounded-full hover:bg-surface-muted',
            musicOn ? 'text-primary' : 'text-foreground-muted',
          )}
        >
          <Music className="size-4" />
        </button>
        <span className="grow" />
        <span className="inline-flex items-center gap-1 text-sm font-bold text-accent-sunbeam">
          <Trophy className="size-4" /> {match.score}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit}>
          {labels.exit ?? 'Exit'}
        </Button>
      </footer>
    </div>
  )
}
