// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { Confetti, cn, ContentBlocks, type InteractiveBlock } from '@bingoo.ai/ui-web'
import { Bookmark, ChevronUp, Heart, Share2, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { playSfx } from '../arena/sfx'
import { EmptyState } from '../shared'
import type { ExperienceLabels, FeedTopic, LearnStep, TopicAccent } from '../types'

const AVAR: Record<TopicAccent, string> = {
  primary: '--color-primary',
  teal: '--color-accent-teal',
  sunbeam: '--color-accent-sunbeam',
  coral: '--color-accent-coral',
  success: '--color-success',
}
const CHIP: Record<TopicAccent, string> = {
  primary: 'bg-primary-soft text-primary',
  teal: 'bg-accent-teal-soft text-accent-teal',
  sunbeam: 'bg-accent-sunbeam-soft text-accent-sunbeam',
  coral: 'bg-accent-coral-soft text-accent-coral',
  success: 'bg-success-soft text-success',
}
const KF = `@keyframes exp-floaty{50%{transform:translateX(-28%) rotate(-6deg) translateY(-9px)}}@keyframes exp-rise{to{opacity:1;transform:none}}`
const THRESH = 60 // px vượt ngưỡng mới sang trang
const LOCK = 12 // px để khoá trục kéo

/**
 * Feed học 2 TRỤC — điều hướng bằng PAGED TRANSFORM + gesture (không dùng scroll tự do): mỗi lần vuốt
 * ngang = đổi topic, vuốt dọc = đổi bài, LUÔN dứt khoát đúng 1 trang. Kéo theo tay + bật lại nếu chưa
 * đủ ngưỡng. Nền động theo topic, node (explainer/manipulative) full-bleed, blocks gom đáy. i18n-free.
 */
export function FeedMode({
  steps,
  topics,
  labels,
  renderActivity,
}: {
  steps: LearnStep[]
  topics?: FeedTopic[]
  labels: ExperienceLabels
  renderActivity?: (b: InteractiveBlock) => ReactNode
}) {
  const chans: FeedTopic[] =
    topics && topics.length ? topics : steps.length ? [{ id: 'all', name: '', accent: 'primary', steps }] : []

  const [tp, setTp] = useState(0)
  const [items, setItems] = useState<number[]>(() => chans.map(() => 0))
  const [drag, setDrag] = useState<{ axis: 'x' | 'y' | null; dx: number; dy: number }>({
    axis: null,
    dx: 0,
    dy: 0,
  })
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const [sound, setSound] = useState(true)
  const [pop, setPop] = useState(0)

  const start = useRef<{ x: number; y: number; free: boolean } | null>(null)
  const wheelLock = useRef(false)
  const sfx = useCallback(
    (k: Parameters<typeof playSfx>[0]) => {
      if (sound) playSfx(k)
    },
    [sound],
  )

  const it = items[tp] ?? 0
  const cur = chans[tp]

  const goTopic = useCallback(
    (d: number) => {
      setTp((v) => {
        const n = Math.max(0, Math.min(chans.length - 1, v + d))
        if (n !== v) sfx('round')
        return n
      })
    },
    [chans.length, sfx],
  )
  const goItem = useCallback(
    (d: number) => {
      setItems((arr) => {
        const max = (chans[tp]?.steps.length ?? 1) - 1
        const n = Math.max(0, Math.min(max, (arr[tp] ?? 0) + d))
        if (n !== (arr[tp] ?? 0)) sfx('tap')
        const next = [...arr]
        next[tp] = n
        return next
      })
    },
    [chans, tp, sfx],
  )

  // bàn phím
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goTopic(1)
      else if (e.key === 'ArrowLeft') goTopic(-1)
      else if (e.key === 'ArrowDown') goItem(1)
      else if (e.key === 'ArrowUp') goItem(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTopic, goItem])

  if (chans.length === 0 || !cur) return <EmptyState>{labels.empty}</EmptyState>

  const isInteractive = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest('input,button,a,[role="slider"],textarea,select')

  const onPointerDown = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, free: isInteractive(e.target) }
  }
  const onPointerMove = (e: PointerEvent) => {
    const s = start.current
    if (!s || s.free) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    setDrag((d) => {
      let axis = d.axis
      if (!axis && (Math.abs(dx) > LOCK || Math.abs(dy) > LOCK))
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      return { axis, dx, dy }
    })
  }
  const endDrag = () => {
    const s = start.current
    start.current = null
    setDrag((d) => {
      if (d.axis === 'x' && Math.abs(d.dx) > THRESH) goTopic(d.dx < 0 ? 1 : -1)
      else if (d.axis === 'y' && Math.abs(d.dy) > THRESH) goItem(d.dy < 0 ? 1 : -1)
      return { axis: null, dx: 0, dy: 0 }
    })
    void s
  }

  const onWheel = (e: React.WheelEvent) => {
    if (wheelLock.current) return
    const ax = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? 'x' : 'y'
    const val = ax === 'x' ? e.deltaX : e.deltaY
    if (Math.abs(val) < 24) return
    wheelLock.current = true
    if (ax === 'x') goTopic(val > 0 ? 1 : -1)
    else goItem(val > 0 ? 1 : -1)
    window.setTimeout(() => (wheelLock.current = false), 420)
  }

  const dragX = drag.axis === 'x' ? drag.dx : 0
  const like = (key: string) => {
    setLiked((s) => {
      const on = !s[key]
      if (on) {
        setPop(Date.now())
        window.setTimeout(() => setPop(0), 1100)
        sfx('combo')
      } else sfx('tap')
      return { ...s, [key]: on }
    })
  }
  const curKey = `${cur.id}:${cur.steps[it]?.id ?? it}`

  return (
    <div
      className="relative flex h-full min-h-0 touch-none select-none justify-center overflow-hidden"
      style={{
        background: `radial-gradient(90% 60% at 50% 0%, color-mix(in srgb, var(${AVAR[cur.accent]}), transparent 88%), var(--color-background))`,
      }}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => start.current && endDrag()}
    >
      <style>{KF}</style>

      <div className="relative h-full w-full max-w-[460px] overflow-hidden bg-background shadow-2xl sm:border-x sm:border-border">
        {/* Track NGANG (topic) */}
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(-${tp} * 100% + ${dragX}px))`,
            transition: drag.axis ? 'none' : 'transform .34s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          {chans.map((topic, ti) => {
            const dragY = drag.axis === 'y' && ti === tp ? drag.dy : 0
            const tIt = items[ti] ?? 0
            return (
              <div key={topic.id} className="relative h-full w-full shrink-0 overflow-hidden">
                {/* Track DỌC (item) */}
                <div
                  className="h-full"
                  style={{
                    transform: `translateY(calc(-${tIt} * 100% + ${dragY}px))`,
                    transition:
                      drag.axis === 'y' && ti === tp ? 'none' : 'transform .34s cubic-bezier(.22,.61,.36,1)',
                  }}
                >
                  {topic.steps.map((step, si) => (
                    <Moment
                      key={step.id}
                      step={step}
                      topicAccent={topic.accent}
                      labels={labels}
                      renderActivity={renderActivity}
                      active={ti === tp && si === tIt}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Tabs (ngang) */}
        {chans.length > 1 ? (
          <div className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex gap-1.5 overflow-x-auto px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chans.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTp(i)
                  sfx('round')
                }}
                style={
                  i === tp ? { background: `var(${AVAR[t.accent]})`, borderColor: 'transparent' } : undefined
                }
                className={cn(
                  'shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold backdrop-blur transition',
                  i === tp
                    ? 'text-white shadow-sm'
                    : 'border-border bg-surface/60 text-foreground-muted hover:text-foreground',
                )}
              >
                {t.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Dots (item) */}
        <div className="pointer-events-none absolute left-2 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-1.5">
          {cur.steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                'w-1 rounded-full transition-all',
                i === it ? 'h-5 bg-foreground' : 'h-1 bg-foreground/25',
              )}
            />
          ))}
        </div>

        {/* Sound */}
        <button
          type="button"
          onClick={() => setSound((v) => !v)}
          aria-label="sound"
          className="absolute right-3 top-2 z-30 grid size-8 place-items-center rounded-full border border-border bg-surface/60 text-foreground-muted backdrop-blur"
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>

        {/* Rail (toàn cục, tác động item hiện tại) */}
        <div className="absolute bottom-16 right-3 z-30 flex flex-col items-center gap-3">
          <RailBtn onClick={() => like(curKey)} active={liked[curKey]} activeClass="text-danger">
            <Heart className={cn('size-6', liked[curKey] && 'fill-danger')} />
          </RailBtn>
          <RailBtn
            onClick={() => {
              setSaved((s) => ({ ...s, [curKey]: !s[curKey] }))
              sfx('tap')
            }}
            active={saved[curKey]}
            activeClass="text-accent-sunbeam"
          >
            <Bookmark className={cn('size-6', saved[curKey] && 'fill-accent-sunbeam')} />
          </RailBtn>
          <RailBtn onClick={() => sfx('tap')}>
            <Share2 className="size-6" />
          </RailBtn>
        </div>

        {/* Gợi ý vuốt — ẩn khi item hiện tại là node (có control riêng) */}
        {cur.steps[it]?.node ? null : (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 flex items-center justify-center gap-1 text-xs font-semibold text-foreground-muted">
            <ChevronUp className="size-4 motion-safe:animate-bounce" /> {labels.feed.swipe}
          </div>
        )}

        {pop ? <Confetti key={pop} /> : null}
      </div>
    </div>
  )
}

function Moment({
  step,
  topicAccent,
  labels,
  renderActivity,
  active,
}: {
  step: LearnStep
  topicAccent: TopicAccent
  labels: ExperienceLabels
  renderActivity?: (b: InteractiveBlock) => ReactNode
  active: boolean
}) {
  const acc = step.accent ?? topicAccent
  return (
    <section
      data-accent={acc}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: `radial-gradient(120% 70% at 50% 0%, color-mix(in srgb, var(${AVAR[acc]}), transparent 80%), var(--color-background))`,
      }}
    >
      {step.emoji && !step.node ? (
        <div
          className="pointer-events-none absolute left-1/2 top-[13vh] z-0 select-none text-[clamp(7rem,30vw,13rem)] leading-none opacity-50 drop-shadow-xl motion-safe:[animation:exp-floaty_5s_ease-in-out_infinite] dark:opacity-30"
          style={{ transform: 'translateX(-28%) rotate(-6deg)' }}
        >
          {step.emoji}
        </div>
      ) : null}

      {step.node ? (
        <div className="absolute inset-0 z-0 grid place-items-center overflow-hidden [&>.exw]:h-full [&>.exw]:w-full [&_.exw]:h-full [&_.exw]:w-full">
          {active ? step.node : null}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-background/60 to-transparent" />
        </div>
      ) : (
        <div className="absolute inset-0 z-10 flex flex-col justify-end gap-3 px-4 pb-[clamp(4.5rem,12vh,5.6rem)] pl-6 pr-[clamp(4.9rem,15vw,6rem)] pt-16">
          {step.eyebrow ? (
            <span
              className={cn(
                'w-fit rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide',
                CHIP[acc],
              )}
            >
              {step.eyebrow}
            </span>
          ) : null}
          <div className="rounded-2xl bg-surface/70 p-4 shadow-lg ring-1 ring-border backdrop-blur">
            <ContentBlocks
              blocks={step.blocks}
              discussLabels={labels.discuss}
              renderActivity={renderActivity}
            />
          </div>
        </div>
      )}
    </section>
  )
}

function RailBtn({
  children,
  onClick,
  active,
  activeClass,
}: {
  children: ReactNode
  onClick?: () => void
  active?: boolean
  activeClass?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'grid size-12 place-items-center rounded-full border border-border bg-surface/75 text-foreground-muted shadow-md backdrop-blur transition hover:scale-110 active:scale-95',
        active && activeClass,
      )}
    >
      {children}
    </button>
  )
}
