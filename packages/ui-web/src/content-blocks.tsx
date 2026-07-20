// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import type { ContentBlock } from '@bingoo.ai/core'
import { ChevronDown } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { Callout } from './callout'
import { GeoShape } from './geo-shape'
import { SpinnerWheel } from './spinner-wheel'
import { LearningGoals } from './learning-goals'
import { cn } from './lib/cn'
import { WorkedExample } from './worked-example'
import { VocabularyList } from './vocabulary-list'
import { DialogueBubbles } from './dialogue-bubbles'
import { ReadingPassage } from './reading-passage'
import { ReflectionPrompt } from './reflection-prompt'
import { DiscussPrompt } from './discuss-prompt'
import { LyricsSheet } from './lyrics-sheet'

/** Blocks that need runtime state + config the app owns — delegated to a slot. */
export type InteractiveBlock = Extract<
  ContentBlock,
  { type: 'quiz' | 'flashcards' | 'tracing' | 'coloring' | 'experiment' | 'selfAssessment' }
>

export interface ContentBlocksProps {
  /** Validated content (from `@bingoo.ai/core`'s Content schema — LLM-authorable). */
  blocks: ContentBlock[]
  /**
   * Render an interactive block (quiz / flashcards / tracing / coloring /
   * experiment / self-assessment). These carry state + labels the app owns, so
   * ContentBlocks delegates them. Passive blocks render without this.
   */
  renderActivity?: (block: InteractiveBlock) => ReactNode
  /** Play an audio clip (vocabulary pronunciation, song track). The app owns playback. */
  onPlayAudio?: (src: string) => void
  /** Where audio playback has reached, in seconds — lights up the current lyric line. */
  audioTime?: number
  /** Localized wrapper copy for the `discuss` block (the components stay i18n-free). */
  discussLabels?: {
    pair?: string
    group?: string
    class?: string
    minutes?: (n: number) => string
  }
  className?: string
}

const HEADING_SIZE: Record<1 | 2 | 3, string> = { 1: 'text-2xl', 2: 'text-xl', 3: 'text-lg' }
const ASPECT: Record<string, string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
}

/** Lightweight maths prettifier for the static `math` block (√, ², ×, π). */
function prettyMath(s: string, base = ''): ReactNode[] {
  const out: ReactNode[] = []
  let i = 0
  let n = 0
  const push = (node: ReactNode) => out.push(<Fragment key={`${base}-${n++}`}>{node}</Fragment>)
  while (i < s.length) {
    if (s.startsWith('sqrt', i)) {
      push('√')
      i += 4
      continue
    }
    if (s.startsWith('pi', i) && !/[a-z]/i.test(s[i + 2] ?? '')) {
      push('π')
      i += 2
      continue
    }
    const c = s[i]!
    if (c === '*') {
      push('×')
      i++
      continue
    }
    if (c === '^') {
      let k = i + 1
      while (k < s.length && /[0-9a-zA-Z.]/.test(s[k]!)) k++
      push(<sup>{s.slice(i + 1, k)}</sup>)
      i = k
      continue
    }
    push(c)
    i++
  }
  return out
}

function AccordionBlock({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((it, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border">
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full items-center justify-between gap-3 bg-surface px-4 py-3 text-left font-semibold text-foreground"
          >
            {it.title}
            <ChevronDown className={cn('size-4 shrink-0 transition-transform', open === i && 'rotate-180')} />
          </button>
          {open === i ? (
            <div className="border-t border-border px-4 py-3 text-foreground">{it.body}</div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

function TabsBlock({ tabs }: { tabs: { label: string; body: string }[] }) {
  const [active, setActive] = useState(0)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              '-mb-px border-b-2 px-3 py-2 text-sm font-semibold',
              active === i
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="text-foreground">{tabs[active]?.body}</div>
    </div>
  )
}

/**
 * Renders declarative `ContentBlock`s (the shared content schema) into UI. The
 * same validated data drives lessons, feed posts, and articles on web + native.
 * Passive blocks render here; interactive ones delegate to `renderActivity`.
 * i18n-free (content is data).
 */
export function ContentBlocks({
  blocks,
  renderActivity,
  onPlayAudio,
  audioTime,
  discussLabels,
  className,
}: ContentBlocksProps) {
  return (
    <div className={cn('flex flex-col gap-4 text-foreground', className)}>
      {blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          renderActivity={renderActivity}
          onPlayAudio={onPlayAudio}
          audioTime={audioTime}
          discussLabels={discussLabels}
        />
      ))}
    </div>
  )
}

function Block({
  block,
  renderActivity,
  onPlayAudio,
  audioTime,
  discussLabels,
}: {
  block: ContentBlock
  renderActivity?: (b: InteractiveBlock) => ReactNode
  onPlayAudio?: (src: string) => void
  audioTime?: number
  discussLabels?: ContentBlocksProps['discussLabels']
}): ReactNode {
  switch (block.type) {
    case 'heading': {
      const level = block.level as 1 | 2 | 3
      const Tag = `h${level}` as 'h1' | 'h2' | 'h3'
      return (
        <Tag className={cn('font-display font-bold text-foreground', HEADING_SIZE[level])}>{block.text}</Tag>
      )
    }
    case 'paragraph':
      return <p className="leading-relaxed text-foreground">{block.text}</p>
    case 'quote':
      return (
        <blockquote className="border-l-4 border-primary pl-4 text-lg italic text-foreground-muted">
          {block.text}
          {block.cite ? <cite className="mt-1 block text-sm not-italic">— {block.cite}</cite> : null}
        </blockquote>
      )
    case 'list': {
      const Tag = block.ordered ? 'ol' : 'ul'
      return (
        <Tag className={cn('flex flex-col gap-1 pl-5', block.ordered ? 'list-decimal' : 'list-disc')}>
          {block.items.map((it, i) => (
            <li key={i} className="leading-relaxed">
              {it}
            </li>
          ))}
        </Tag>
      )
    }
    case 'term':
      return (
        <div className="rounded-2xl border border-border bg-surface-muted p-4">
          <dt className="font-display font-bold text-foreground">{block.term}</dt>
          <dd className="mt-0.5 text-sm text-foreground-muted">{block.definition}</dd>
          {block.example ? (
            <dd className="mt-1 text-sm italic text-foreground-muted">{block.example}</dd>
          ) : null}
        </div>
      )
    case 'math':
      return (
        <figure className="flex flex-col items-center gap-1.5">
          <div className="text-2xl font-semibold text-foreground">{prettyMath(block.expr)}</div>
          {block.caption ? (
            <figcaption className="text-sm text-foreground-muted">{block.caption}</figcaption>
          ) : null}
        </figure>
      )
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {block.headers.map((h, i) => (
                  <th
                    key={i}
                    className="border border-border bg-surface-muted px-3 py-2 text-left font-bold text-foreground"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-border px-3 py-2 text-foreground">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {block.caption ? (
            <p className="mt-1 text-center text-sm text-foreground-muted">{block.caption}</p>
          ) : null}
        </div>
      )
    case 'divider':
      return <hr className="border-border" />

    case 'image':
      return (
        <figure className="flex flex-col gap-1.5">
          <img src={block.src} alt={block.alt} className="w-full rounded-2xl" />
          {block.caption ? (
            <figcaption className="text-center text-sm text-foreground-muted">{block.caption}</figcaption>
          ) : null}
        </figure>
      )
    case 'video':
      return (
        <figure className="flex flex-col gap-1.5">
          <video src={block.src} poster={block.poster} controls className="w-full rounded-2xl" />
          {block.caption ? (
            <figcaption className="text-center text-sm text-foreground-muted">{block.caption}</figcaption>
          ) : null}
        </figure>
      )
    case 'audio':
      return (
        <figure className="flex flex-col gap-1.5">
          <audio src={block.src} controls className="w-full" />
          {block.caption ? (
            <figcaption className="text-sm text-foreground-muted">{block.caption}</figcaption>
          ) : null}
        </figure>
      )
    case 'embed':
      return (
        <div
          className={cn(
            'w-full overflow-hidden rounded-2xl border border-border',
            ASPECT[block.aspect] ?? 'aspect-video',
          )}
        >
          <iframe src={block.src} title={block.title ?? 'embed'} className="size-full" allowFullScreen />
        </div>
      )

    case 'shape':
      return (
        <GeoShape
          kind={block.kind}
          name={block.name}
          color={block.color}
          label={block.label}
          rotatable={block.rotatable}
        />
      )
    case 'spinner':
      return <SpinnerWheel segments={block.segments} spinLabel={block.spinLabel} />

    case 'callout':
      return (
        <Callout variant={block.variant} title={block.title}>
          {block.text}
        </Callout>
      )
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-2xl bg-surface-muted p-4 font-mono text-sm text-foreground">
          <code>{block.code}</code>
        </pre>
      )
    case 'accordion':
      return <AccordionBlock items={block.items} />
    case 'tabs':
      return <TabsBlock tabs={block.tabs} />
    case 'timeline':
      return (
        <ol className="flex flex-col gap-4 border-l-2 border-border pl-5">
          {block.items.map((it, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[1.6rem] top-1 grid size-5 place-items-center rounded-full bg-primary text-2xs font-bold text-primary-foreground">
                {it.marker ?? i + 1}
              </span>
              <p className="font-semibold text-foreground">{it.title}</p>
              {it.description ? <p className="text-sm text-foreground-muted">{it.description}</p> : null}
            </li>
          ))}
        </ol>
      )
    case 'steps':
      return (
        <ol className="flex flex-col gap-3">
          {block.steps.map((st, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                {block.ordered ? i + 1 : '•'}
              </span>
              <div>
                <p className="font-semibold text-foreground">{st.title}</p>
                {st.body ? <p className="text-sm text-foreground-muted">{st.body}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )

    case 'workedExample':
      return (
        <WorkedExample
          label={block.label}
          prompt={block.prompt}
          steps={block.steps}
          answer={block.answer}
          answerLabel={block.answerLabel}
          note={block.note}
        />
      )
    case 'learningGoals':
      return (
        <LearningGoals
          title={block.title}
          objectives={block.objectives}
          keywords={block.keywords}
          keywordsTitle={block.keywordsTitle}
        />
      )

    case 'vocabulary':
      return <VocabularyList title={block.title} words={block.words} onPlayAudio={onPlayAudio} />
    case 'dialogue':
      return <DialogueBubbles turns={block.turns} question={block.question} />
    case 'passage':
      return (
        <ReadingPassage
          title={block.title}
          author={block.author}
          paragraphs={block.paragraphs}
          numbered={block.numbered}
          glossary={block.glossary}
        />
      )
    case 'reflection':
      return <ReflectionPrompt title={block.title} prompts={block.prompts} faces={block.faces} />
    case 'discuss':
      return (
        <DiscussPrompt
          prompt={block.prompt}
          mode={block.mode}
          points={block.points}
          minutes={block.minutes}
          labels={discussLabels}
        />
      )
    case 'lyrics':
      return (
        <LyricsSheet
          title={block.title}
          lines={block.lines}
          audioSrc={block.audioSrc}
          onPlayAudio={onPlayAudio}
          audioTime={audioTime}
        />
      )

    case 'quiz':
    case 'flashcards':
    case 'tracing':
    case 'coloring':
    case 'experiment':
    case 'selfAssessment':
      return (
        renderActivity?.(block) ?? (
          <div className="rounded-xl border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-foreground-subtle">
            [{block.type}]
          </div>
        )
      )
  }
}
