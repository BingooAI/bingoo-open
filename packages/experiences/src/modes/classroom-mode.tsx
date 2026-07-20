import type { DrawStroke } from '@bingoo/core'
import { Button, cn, DrawingCanvas, Input } from '@bingoo/ui-web'
import {
  Hand,
  LayoutGrid,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Presentation,
  Radio,
  Send,
  Smile,
  Trash2,
  Users,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ExperienceLabels, Participant } from '../types'

const PEN_COLORS = ['#2e62ec', '#f74c6c', '#18b862', '#ffaf0c', '#f8fafc']
const REACTIONS = ['👍', '❤️', '👏', '🎉', '😮']
type View = 'grid' | 'present'
type Panel = 'chat' | 'people' | null
interface ChatMsg {
  id: number
  name: string
  text: string
}
interface Float {
  id: number
  emoji: string
  left: number
}

const two = (n: number) => String(n).padStart(2, '0')

/**
 * Lớp LIVE kiểu Zoom/Google Meet — sân khấu video tối (speaker + filmstrip / lưới), thanh điều khiển
 * nổi (mic·cam·chia sẻ·cảm xúc·giơ tay·người·chat·rời), panel trượt chat/người, đồng hồ + LIVE, và
 * BẢNG TRẮNG VẼ THẬT (DrawingCanvas) khi "chia sẻ". Mọi tương tác thật; chỉ thiếu backend WebRTC.
 */
export function ClassroomMode({
  participants,
  labels,
  onExit,
}: {
  participants: Participant[]
  labels: ExperienceLabels
  onExit?: () => void
}) {
  const c = labels.classroom
  const you = String(c.you)
  // Toàn bộ danh sách + trạng thái đến TỪ DỮ LIỆU (host/engine). View không bịa theo index.
  const teacher = participants.find((p) => p.role === 'teacher')
  const roster: Participant[] = participants.filter((p) => p.role !== 'teacher')

  const [view, setView] = useState<View>('present')
  const [panel, setPanel] = useState<Panel>('chat')
  const [sharing, setSharing] = useState(true)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [hand, setHand] = useState(false)
  const [sec, setSec] = useState(0)
  const [strokes, setStrokes] = useState<DrawStroke[]>([])
  const [color, setColor] = useState(PEN_COLORS[0]!)
  const [msgs, setMsgs] = useState<ChatMsg[]>([])
  const [draft, setDraft] = useState('')
  const [floats, setFloats] = useState<Float[]>([])
  const [pickReact, setPickReact] = useState(false)
  const floatId = useRef(0)

  useEffect(() => {
    const id = setInterval(() => setSec((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMsgs((m) => [...m, { id: m.length, name: you, text }])
    setDraft('')
  }
  const react = (emoji: string) => {
    const id = ++floatId.current
    setFloats((f) => [...f, { id, emoji, left: 20 + ((id * 37) % 60) }])
    setPickReact(false)
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 2200)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0b1120] text-white">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#ef4444] px-2 py-0.5 text-[11px] font-bold text-white">
          <Radio className="size-3 motion-safe:animate-pulse" /> {c.live}
        </span>
        <span className="truncate text-sm font-semibold">{c.title}</span>
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs tabular-nums text-white/80">
          {two(Math.floor(sec / 60))}:{two(sec % 60)}
        </span>
        <span className="grow" />
        <div className="flex items-center gap-1 rounded-full bg-white/10 p-0.5">
          {(['grid', 'present'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                view === v ? 'bg-white text-[#0b1120]' : 'text-white/80 hover:text-white',
              )}
            >
              {v === 'grid' ? <LayoutGrid className="size-3.5" /> : <Presentation className="size-3.5" />}
              <span className="hidden sm:inline">{v === 'grid' ? c.grid : c.present}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Stage + panel */}
      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col p-3">
          {view === 'present' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="min-h-0 flex-1">
                {sharing ? (
                  <Whiteboard
                    labels={labels}
                    strokes={strokes}
                    onStrokes={setStrokes}
                    color={color}
                    onColor={setColor}
                  />
                ) : (
                  <Tile p={teacher ?? roster[0]!} you={you} big />
                )}
              </div>
              {/* Filmstrip */}
              <div className="flex shrink-0 gap-2 overflow-x-auto">
                {roster.map((p) => (
                  <div key={p.name} className="w-32 shrink-0">
                    <Tile p={p} you={you} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 md:grid-cols-3">
              {(teacher ? [teacher, ...roster] : roster).map((p) => (
                <Tile key={p.name} p={p} you={you} />
              ))}
            </div>
          )}

          {/* Floating reactions */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {floats.map((f) => (
              <span
                key={f.id}
                className="absolute bottom-4 text-3xl motion-safe:animate-fade-up"
                style={{ left: `${f.left}%` }}
              >
                {f.emoji}
              </span>
            ))}
          </div>
        </main>

        {panel ? (
          <aside className="flex w-72 shrink-0 flex-col border-l border-white/10 bg-surface text-foreground">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-sm font-bold">{panel === 'chat' ? c.chatTitle : c.participants}</span>
              <button
                type="button"
                onClick={() => setPanel(null)}
                aria-label={String(c.leave)}
                className="grid size-7 place-items-center rounded-full text-foreground-muted hover:bg-surface-muted"
              >
                <X className="size-4" />
              </button>
            </div>
            {panel === 'chat' ? (
              <ChatPanel labels={labels} msgs={msgs} draft={draft} setDraft={setDraft} onSend={send} />
            ) : (
              <PeoplePanel teacher={teacher} roster={roster} you={you} labels={labels} />
            )}
          </aside>
        ) : null}
      </div>

      {/* Control bar */}
      <div className="relative flex shrink-0 items-center justify-center py-3">
        {pickReact ? (
          <div className="absolute bottom-16 flex gap-1 rounded-full bg-[#1b2436] p-1.5 shadow-xl">
            {REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className="grid size-9 place-items-center rounded-full text-xl hover:bg-white/10"
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex items-center gap-1.5 rounded-2xl bg-[#111827] px-2 py-1.5 shadow-xl ring-1 ring-white/10">
          <Ctrl label={c.muteToggle} on={!muted} danger={muted} onClick={() => setMuted((v) => !v)}>
            {muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </Ctrl>
          <Ctrl label={c.camToggle} on={!camOff} danger={camOff} onClick={() => setCamOff((v) => !v)}>
            {camOff ? <VideoOff className="size-5" /> : <Video className="size-5" />}
          </Ctrl>
          <Ctrl
            label={c.share}
            active={sharing}
            onClick={() => {
              setSharing((v) => !v)
              setView('present')
            }}
          >
            <MonitorUp className="size-5" />
          </Ctrl>
          <Ctrl label={c.reactions} active={pickReact} onClick={() => setPickReact((v) => !v)}>
            <Smile className="size-5" />
          </Ctrl>
          <Ctrl label={c.raiseHand} active={hand} onClick={() => setHand((v) => !v)}>
            <Hand className="size-5" />
          </Ctrl>
          <Ctrl
            label={c.people}
            active={panel === 'people'}
            badge={participants.length}
            onClick={() => setPanel((p) => (p === 'people' ? null : 'people'))}
          >
            <Users className="size-5" />
          </Ctrl>
          <Ctrl
            label={c.chat}
            active={panel === 'chat'}
            onClick={() => setPanel((p) => (p === 'chat' ? null : 'chat'))}
          >
            <MessageSquare className="size-5" />
          </Ctrl>
          <button
            type="button"
            onClick={onExit}
            className="ml-1 inline-flex items-center gap-1.5 rounded-xl bg-[#ef4444] px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-110"
          >
            <PhoneOff className="size-4" /> <span className="hidden sm:inline">{c.leave}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function Ctrl({
  children,
  label,
  onClick,
  on = true,
  active,
  danger,
  badge,
}: {
  children: ReactNode
  label: string
  onClick?: () => void
  on?: boolean
  active?: boolean
  danger?: boolean
  badge?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'relative grid size-11 place-items-center rounded-xl text-white transition',
        danger
          ? 'bg-[#ef4444] hover:brightness-110'
          : active
            ? 'bg-white text-[#0b1120]'
            : 'bg-white/10 hover:bg-white/20',
        !on && !danger && 'text-white/60',
      )}
    >
      {children}
      {badge != null ? (
        <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  )
}

function Tile({ p, you, big }: { p: Participant; you: string; big?: boolean }) {
  const isYou = p.name === you
  const { speaking, handRaised: raised, muted } = p
  return (
    <div
      className={cn(
        'relative grid h-full min-h-24 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(160deg,#243049,#141c2e)] ring-1 ring-white/10',
        speaking && 'ring-2 ring-[#22c55e]',
      )}
    >
      <div
        className={cn(
          'grid place-items-center rounded-full bg-white/10 font-bold text-white',
          big ? 'size-24 text-3xl' : 'size-12 text-base',
        )}
      >
        {p.name.slice(0, 2)}
      </div>
      <span className="absolute bottom-1.5 left-2 inline-flex items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-[11px] font-semibold text-white">
        {muted ? <MicOff className="size-3 text-[#f87171]" /> : null}
        {isYou ? you : p.name}
      </span>
      {raised ? (
        <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[#ffaf0c] text-sm">
          ✋
        </span>
      ) : null}
    </div>
  )
}

function Whiteboard({
  labels,
  strokes,
  onStrokes,
  color,
  onColor,
}: {
  labels: ExperienceLabels
  strokes: DrawStroke[]
  onStrokes: (s: DrawStroke[]) => void
  color: string
  onColor: (c: string) => void
}) {
  const c = labels.classroom
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-white ring-1 ring-white/10">
      <div className="flex shrink-0 items-center gap-2 border-b border-slate-200 px-3 py-2">
        <span className="mr-1 text-xs font-bold text-slate-500">{c.whiteboard}</span>
        {PEN_COLORS.map((col) => (
          <button
            key={col}
            type="button"
            aria-label={c.penTool}
            onClick={() => onColor(col)}
            style={{ background: col }}
            className={cn(
              'size-6 rounded-full ring-offset-2 ring-offset-white transition',
              color === col ? 'ring-2 ring-slate-800' : 'ring-1 ring-slate-300',
            )}
          />
        ))}
        <span className="grow" />
        <button
          type="button"
          onClick={() => onStrokes([])}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100"
        >
          <Trash2 className="size-4" /> {c.clearTool}
        </button>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        <DrawingCanvas
          strokes={strokes}
          onStrokesChange={onStrokes}
          color={color}
          className="h-full w-full"
        />
      </div>
    </div>
  )
}

function ChatPanel({
  labels,
  msgs,
  draft,
  setDraft,
  onSend,
}: {
  labels: ExperienceLabels
  msgs: ChatMsg[]
  draft: string
  setDraft: (v: string) => void
  onSend: () => void
}) {
  const c = labels.classroom
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 text-sm">
        {msgs.length === 0 ? (
          <p className="text-xs text-foreground-subtle">—</p>
        ) : (
          msgs.map((m) => (
            <p key={m.id}>
              <span className="font-bold text-foreground">{m.name}: </span>
              <span className="text-foreground-muted">{m.text}</span>
            </p>
          ))
        )}
      </div>
      <form
        className="flex items-center gap-1.5 border-t border-border p-2"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={c.chatPlaceholder}
          className="h-9"
        />
        <Button type="submit" size="sm" aria-label={String(c.send)}>
          <Send className="size-4" />
        </Button>
      </form>
    </>
  )
}

function PeoplePanel({
  teacher,
  roster,
  you,
  labels,
}: {
  teacher?: Participant
  roster: Participant[]
  you: string
  labels: ExperienceLabels
}) {
  const c = labels.classroom
  const teacherName = teacher?.name ?? String(c.teacher)
  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5">
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {teacherName.slice(0, 2)}
        </span>
        <span className="flex-1 text-sm font-semibold text-foreground">{teacherName}</span>
        <span className="text-[10px] font-bold text-foreground-muted">★</span>
      </div>
      {roster.map((p) => (
        <div key={p.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <span className="grid size-8 place-items-center rounded-full bg-surface-muted text-xs font-bold text-foreground-muted">
            {p.name.slice(0, 2)}
          </span>
          <span className="flex-1 text-sm text-foreground">
            {p.name}
            {p.name === you ? ` (${you})` : ''}
            {p.handRaised ? ' ✋' : ''}
          </span>
          {p.muted ? (
            <MicOff className="size-3.5 text-danger" />
          ) : (
            <Mic className="size-3.5 text-foreground-subtle" />
          )}
        </div>
      ))}
    </div>
  )
}
