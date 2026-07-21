// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { pickText, type ContentBlock, type QuizQuestion } from '@bingoo.ai/core'
import type {
  FeedTopic,
  LearnCourseData,
  LearnProjectData,
  LearnQuizItem,
  LearnStep,
  Participant,
  TopicAccent,
} from '@bingoo.ai/experiences'
import { defaultTheme, ExplainerPlayer, InteractiveManipulative } from '@bingoo.ai/explainer-web'
import type { QuizLabels } from '@bingoo.ai/ui-web'
import '@bingoo.ai/explainer-web/styles.css'
import { ACCEPTANCE_BUNDLES, ACCEPTANCE_DOC } from '@/lib/explainerLesson'
import { manipulativeKinds } from '@bingoo.ai/manipulatives'
import {
  AnswerOption,
  Button,
  Callout,
  ExperimentFlow,
  Flashcard,
  SelfAssessment,
  type InteractiveBlock,
  type LeaderboardEntry,
} from '@bingoo.ai/ui-web'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

/** Translator (next-intl) đã bound namespace `learn`. */
type T = (key: string, values?: Record<string, string | number>) => string

const DEMO_IMG = 'https://storage.bingoo.ai/media/global/global/cmrheen6y001jwo0cfsy1j746/original.png'

/* ───────── Wrappers cho block tương tác (giữ state cục bộ) ───────── */

function InlineQuiz({
  prompt,
  choices,
  answerId,
  explanation,
  explainLabel,
}: {
  prompt: string
  choices: { id: string; label: string }[]
  answerId: string
  explanation?: string
  explainLabel: string
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const revealed = picked != null
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display font-bold text-foreground">{prompt}</p>
      <div className="flex flex-col gap-2">
        {choices.map((c, i) => {
          const state = !revealed
            ? picked === c.id
              ? 'selected'
              : 'default'
            : c.id === answerId
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
              onClick={() => setPicked(c.id)}
            />
          )
        })}
      </div>
      {revealed && explanation ? (
        <Callout variant={picked === answerId ? 'success' : 'info'} title={explainLabel}>
          {explanation}
        </Callout>
      ) : null}
    </div>
  )
}

function FlashcardsBlock({
  cards,
  nextLabel,
  hint,
}: {
  cards: { id: string; front: string; back: string }[]
  nextLabel: string
  hint: string
}) {
  const [i, setI] = useState(0)
  const last = i >= cards.length - 1
  const card = cards[i]
  if (!card) return null
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-sm font-semibold text-foreground-muted">
        {i + 1} / {cards.length}
      </span>
      <Flashcard
        key={card.id}
        front={card.front}
        back={card.back}
        hint={hint}
        minHeight={160}
        className="w-full max-w-sm"
      />
      <Button variant="secondary" onClick={() => setI(last ? 0 : (x) => x + 1)}>
        {nextLabel}
      </Button>
    </div>
  )
}

function SelfAssessmentBlock({
  title,
  items,
  levels,
}: {
  title?: string
  items: { id: string; label: string }[]
  levels?: { emoji: string; label?: string }[]
}) {
  const [value, setValue] = useState<Record<string, number>>({})
  return <SelfAssessment title={title} items={items} value={value} onChange={setValue} levels={levels} />
}

/** Bộ render block tương tác — host cắm component thật cho quiz/flashcards/experiment/selfAssessment. */
export function makeRenderActivity(t: T): (block: InteractiveBlock) => ReactNode {
  return (block) => {
    switch (block.type) {
      case 'quiz': {
        const q = block.question
        if (q.type !== 'single') return null
        return (
          <InlineQuiz
            prompt={pickText(q.prompt)}
            choices={q.choices.map((c) => ({ id: c.id, label: pickText(c.label) }))}
            answerId={q.answerId ?? ''}
            explanation={pickText(q.explanation)}
            explainLabel={t('ui.qExplain')}
          />
        )
      }
      case 'flashcards':
        return (
          <FlashcardsBlock
            cards={block.deck.cards.map((c) => ({ id: c.id, front: c.front, back: c.back }))}
            nextLabel={t('ui.fcNext')}
            hint={t('ui.fcHint')}
          />
        )
      case 'experiment':
        return (
          <ExperimentFlow
            title={block.title}
            stageLabels={block.stageLabels}
            hypothesis={block.hypothesis}
            procedure={block.procedure}
            observation={block.observation}
            conclusion={block.conclusion}
            labels={{
              next: t('ui.expNext'),
              back: t('ui.expBack'),
              finish: t('ui.expFinish'),
              yourGuess: t('ui.expGuess'),
              correct: t('ui.expCorrect'),
              incorrect: t('ui.expIncorrect'),
            }}
          />
        )
      case 'selfAssessment':
        return <SelfAssessmentBlock title={block.title} items={block.items} levels={block.levels} />
      default:
        return null
    }
  }
}

/* ───────── Nội dung MOCK — phủ ~28 loại content block ───────── */

export function buildRichSteps(t: T): LearnStep[] {
  const m = (k: string) => t(`rich.${k}`)
  const quiz: QuizQuestion = {
    id: 'q1',
    type: 'single',
    prompt: m('quizPrompt'),
    choices: [
      { id: 'a', label: m('quizA') },
      { id: 'b', label: m('quizB') },
      { id: 'c', label: m('quizC') },
    ],
    answerId: 'b',
    explanation: m('quizExplain'),
  }

  return [
    {
      id: 'goals',
      emoji: '🎯',
      accent: 'primary',
      eyebrow: m('goalsTitle'),
      blocks: [
        {
          type: 'learningGoals',
          title: m('goalsTitle'),
          objectives: [m('goal1'), m('goal2'), m('goal3')],
          keywords: [m('kw1'), m('kw2'), m('kw3'), m('kw4')],
          keywordsTitle: m('kwTitle'),
        },
      ] satisfies ContentBlock[],
    },
    {
      id: 'concept',
      emoji: '💡',
      accent: 'teal',
      eyebrow: m('cHead'),
      blocks: [
        { type: 'heading', level: 2, text: m('cHead') },
        { type: 'paragraph', text: m('cPara') },
        { type: 'callout', variant: 'info', title: m('cCalloutT'), text: m('cCallout') },
        { type: 'term', term: m('cTerm'), definition: m('cTermDef'), example: m('cTermEx') },
        { type: 'math', expr: m('cMathExpr'), caption: m('cMathCap') },
      ] satisfies ContentBlock[],
    },
    {
      id: 'example',
      emoji: '📐',
      accent: 'sunbeam',
      eyebrow: m('weLabel'),
      blocks: [
        {
          type: 'workedExample',
          label: m('weLabel'),
          prompt: m('wePrompt'),
          steps: [m('weS1'), m('weS2'), m('weS3')],
          answer: m('weAnswer'),
          answerLabel: m('weAnswerLabel'),
          note: m('weNote'),
        },
        { type: 'quote', text: m('quoteText'), cite: m('quoteCite') },
        {
          type: 'steps',
          ordered: true,
          steps: [
            { title: m('st1t'), body: m('st1b') },
            { title: m('st2t'), body: m('st2b') },
            { title: m('st3t'), body: m('st3b') },
          ],
        },
      ] satisfies ContentBlock[],
    },
    {
      id: 'data',
      emoji: '📊',
      accent: 'coral',
      eyebrow: m('tblCap'),
      blocks: [
        {
          type: 'table',
          caption: m('tblCap'),
          headers: [m('tblH1'), m('tblH2'), m('tblH3')],
          rows: [
            [m('tblR1a'), m('tblR1b'), m('tblR1c')],
            [m('tblR2a'), m('tblR2b'), m('tblR2c')],
          ],
        },
        { type: 'code', language: 'python', code: m('code') },
        { type: 'list', ordered: true, items: [m('list1'), m('list2'), m('list3')] },
      ] satisfies ContentBlock[],
    },
    {
      id: 'observe',
      emoji: '👀',
      accent: 'success',
      eyebrow: m('imgAlt'),
      blocks: [
        { type: 'image', src: DEMO_IMG, alt: m('imgAlt'), caption: m('imgCap') },
        { type: 'video', poster: DEMO_IMG, caption: m('vidCap') },
        {
          type: 'timeline',
          items: [
            { title: m('tl1t'), description: m('tl1d'), marker: m('tl1m') },
            { title: m('tl2t'), description: m('tl2d'), marker: m('tl2m') },
            { title: m('tl3t'), description: m('tl3d'), marker: m('tl3m') },
          ],
        },
        {
          type: 'accordion',
          items: [
            { title: m('acc1t'), body: m('acc1b') },
            { title: m('acc2t'), body: m('acc2b') },
          ],
        },
        {
          type: 'tabs',
          tabs: [
            { label: m('tab1l'), body: m('tab1b') },
            { label: m('tab2l'), body: m('tab2b') },
          ],
        },
        { type: 'divider' },
      ] satisfies ContentBlock[],
    },
    {
      id: 'language',
      emoji: '📖',
      accent: 'primary',
      eyebrow: m('vocTitle'),
      blocks: [
        {
          type: 'vocabulary',
          title: m('vocTitle'),
          words: [
            { term: m('voc1t'), definition: m('voc1d'), example: m('voc1e'), emoji: '1️⃣' },
            { term: m('voc2t'), definition: m('voc2d'), example: m('voc2e'), emoji: '🔟' },
            { term: m('voc3t'), definition: m('voc3d'), example: m('voc3e'), emoji: '➕' },
          ],
        },
        {
          type: 'dialogue',
          turns: [
            { speaker: m('dlg1s'), text: m('dlg1t'), emoji: '🧒', side: 'left' },
            { speaker: m('dlg2s'), text: m('dlg2t'), emoji: '👧', side: 'right' },
          ],
          question: m('dlgQ'),
        },
        {
          type: 'passage',
          title: m('psgTitle'),
          author: m('psgAuthor'),
          numbered: true,
          paragraphs: [m('psg1'), m('psg2')],
          glossary: [
            { term: m('psgG1t'), definition: m('psgG1d') },
            { term: m('psgG2t'), definition: m('psgG2d') },
          ],
        },
      ] satisfies ContentBlock[],
    },
    {
      id: 'practice',
      emoji: '✍️',
      accent: 'teal',
      eyebrow: m('quizPrompt'),
      blocks: [
        { type: 'quiz', question: quiz },
        {
          type: 'flashcards',
          deck: {
            id: 'deck1',
            title: m('fcTitle'),
            cards: [
              { id: 'f1', front: m('fc1f'), back: m('fc1b') },
              { id: 'f2', front: m('fc2f'), back: m('fc2b') },
              { id: 'f3', front: m('fc3f'), back: m('fc3b') },
            ],
          },
        },
      ] satisfies ContentBlock[],
    },
    {
      id: 'explore',
      emoji: '🔬',
      accent: 'sunbeam',
      eyebrow: m('expTitle'),
      blocks: [
        {
          type: 'experiment',
          title: m('expTitle'),
          stageLabels: {
            predict: t('ui.expPredict'),
            experiment: t('ui.expExperiment'),
            observe: t('ui.expObserve'),
            conclude: t('ui.expConclude'),
          },
          hypothesis: {
            question: m('expQ'),
            options: [
              { id: 'float', label: m('expFloat'), emoji: '⬆️' },
              { id: 'sink', label: m('expSink'), emoji: '⬇️' },
            ],
            correctId: 'float',
          },
          procedure: [
            { id: 'e1', label: m('expS1') },
            { id: 'e2', label: m('expS2') },
            { id: 'e3', label: m('expS3') },
          ],
          observation: m('expObs'),
          conclusion: m('expConcl'),
        },
        {
          type: 'spinner',
          segments: [
            { id: 'r', label: m('spin1') },
            { id: 'b', label: m('spin2') },
            { id: 'g', label: m('spin3') },
            { id: 'y', label: m('spin4') },
          ],
          spinLabel: m('spinLabel'),
        },
        {
          type: 'selfAssessment',
          title: m('selfTitle'),
          items: [
            { id: 's1', label: m('self1') },
            { id: 's2', label: m('self2') },
            { id: 's3', label: m('self3') },
          ],
          levels: [
            { emoji: '😐', label: m('selfNotYet') },
            { emoji: '😊', label: m('selfConfident') },
          ],
        },
        { type: 'reflection', title: m('refTitle'), faces: true, prompts: [m('ref1'), m('ref2')] },
        {
          type: 'discuss',
          prompt: m('disPrompt'),
          mode: 'pair',
          minutes: 3,
          points: [m('dis1'), m('dis2')],
        },
        {
          type: 'lyrics',
          title: m('lyrTitle'),
          lines: [
            { text: m('lyr1'), at: 0 },
            { text: m('lyr2'), at: 4 },
            { text: m('lyr3'), at: 8 },
          ],
        },
      ] satisfies ContentBlock[],
    },
  ]
}

/** Ngân hàng câu hỏi drill — dùng cho practice + arena. */
export function buildQuiz(t: T): LearnQuizItem[] {
  const r = (k: string) => t(`rich.${k}`)
  const p = (k: string) => t(`practice.${k}`)
  return [
    {
      id: 'q1',
      prompt: r('quizPrompt'),
      choices: [
        { id: 'a', label: r('quizA') },
        { id: 'b', label: r('quizB') },
        { id: 'c', label: r('quizC') },
      ],
      answerId: 'b',
    },
    {
      id: 'q2',
      prompt: p('q2Prompt'),
      choices: [
        { id: 'a', label: p('q2a') },
        { id: 'b', label: p('q2b') },
        { id: 'c', label: p('q2c') },
      ],
      answerId: 'b',
    },
    {
      id: 'q3',
      prompt: p('q3Prompt'),
      choices: [
        { id: 'a', label: p('q3a') },
        { id: 'b', label: p('q3b') },
        { id: 'c', label: p('q3c') },
      ],
      answerId: 'b',
    },
  ]
}

export function buildArena(t: T): {
  leaderboard: LeaderboardEntry[]
  opponents: { name: string; src?: string | null }[]
} {
  const a = (k: string) => t(`arena.${k}`)
  return {
    leaderboard: [
      { rank: 1, name: a('o1'), score: 980 },
      { rank: 2, name: a('you'), score: 860, isYou: true },
      { rank: 3, name: a('o2'), score: 790 },
      { rank: 4, name: a('o3'), score: 640 },
    ],
    opponents: [{ name: a('o1') }, { name: a('o2') }, { name: a('o3') }, { name: a('o4') }],
  }
}

/** Danh sách người tham gia (chrome roster khi scale=class/group). */
export function buildParticipants(t: T): Participant[] {
  const a = (k: string) => t(`arena.${k}`)
  // Dữ liệu roster + trạng thái (mock ở app; engine/API thật sẽ đổ cùng shape này vào).
  return [
    { name: t('classroom.teacher'), role: 'teacher', speaking: true },
    { name: t('classroom.you'), role: 'student' },
    { name: a('o1'), role: 'student' },
    { name: a('o2'), role: 'student', handRaised: true },
    { name: a('o3'), role: 'student', muted: true },
    { name: a('o4'), role: 'student', muted: true },
  ]
}

export function buildProject(t: T): LearnProjectData {
  const p = (k: string) => t(`project.${k}`)
  return {
    title: p('title'),
    brief: p('brief'),
    tasks: [
      { id: 't1', label: p('t1') },
      { id: 't2', label: p('t2') },
      { id: 't3', label: p('t3') },
      { id: 't4', label: p('t4') },
    ],
    workspaceLabel: p('workspace'),
  }
}

const ACCENTS: TopicAccent[] = ['primary', 'teal', 'sunbeam', 'coral', 'success']

/** Seed TOÀN BỘ manipulative (41 kit) thành thẻ feed — mỗi primitive một trang, render thật qua explainer-web. */
export function buildManipulativeSteps(): LearnStep[] {
  return manipulativeKinds().map((kind, i) => ({
    id: `manip-${kind}`,
    emoji: '🧩',
    accent: ACCENTS[i % ACCENTS.length],
    eyebrow: kind,
    blocks: [],
    node: (
      <div className="exw w-full">
        <InteractiveManipulative kind={kind} theme={defaultTheme} aspect="16:9" />
      </div>
    ),
  }))
}

/** Player explainer bản FEED: full-bleed 9:16, tự PHÁT khi vào khung, tự DỪNG khi cuộn qua (IntersectionObserver). */
function FeedExplainer({ quizLabels }: { quizLabels: QuizLabels }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (es) => setActive(!!es[0] && es[0].isIntersecting && es[0].intersectionRatio > 0.6),
      { threshold: [0, 0.6, 1] },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div ref={ref} className="exw h-full w-full">
      <ExplainerPlayer
        doc={ACCEPTANCE_DOC}
        bundles={ACCEPTANCE_BUNDLES}
        mode="9:16"
        variant="feed"
        active={active}
        quizLabels={quizLabels}
      />
    </div>
  )
}

/** Bài explainer mẫu (ACCEPTANCE_DOC trong DB/lib) — trong feed dùng khung DỌC 9:16, player tối giản. */
function explainerStep(t: T, quizLabels: QuizLabels): LearnStep {
  return {
    id: 'explainer',
    emoji: '🎬',
    accent: 'primary',
    eyebrow: t('rich.cHead'),
    blocks: [],
    node: <FeedExplainer quizLabels={quizLabels} />,
  }
}

/** Feed 2 trục: 3 topic (Toán/Tiếng Việt/Khoa học); mỗi topic trộn explainer + nội dung + manipulative. */
export function buildTopics(t: T, quizLabels: QuizLabels): FeedTopic[] {
  const rich = buildRichSteps(t)
  const manip = buildManipulativeSteps()
  const k = Math.ceil(manip.length / 3) || 1
  return [
    {
      id: 'math',
      name: t('topics.math'),
      accent: 'primary',
      steps: [explainerStep(t, quizLabels), ...rich.slice(0, 3), ...manip.slice(0, k)],
    },
    {
      id: 'viet',
      name: t('topics.viet'),
      accent: 'coral',
      steps: [...rich.slice(3, 6), ...manip.slice(k, 2 * k)],
    },
    {
      id: 'sci',
      name: t('topics.sci'),
      accent: 'teal',
      steps: [...rich.slice(6), ...manip.slice(2 * k)],
    },
  ]
}

export function buildCourse(t: T): LearnCourseData {
  const m = (k: string) => t(`mock.${k}`)
  return {
    title: m('courseTitle'),
    subtitle: m('courseSubtitle'),
    progress: 45,
    xp: { level: 4, xp: 620, nextXp: 1000 },
    path: [
      { id: 'p1', status: 'done', label: m('p1') },
      { id: 'p2', status: 'done', label: m('p2') },
      { id: 'p3', status: 'current', label: m('p3') },
      { id: 'p4', status: 'locked', label: m('p4') },
      { id: 'p5', status: 'locked', label: m('p5') },
    ],
    lessons: [
      {
        id: 'l1',
        icon: <span className="text-lg">➕</span>,
        title: m('l1Title'),
        meta: m('l1Meta'),
        progress: 100,
        color: 'success',
      },
      {
        id: 'l2',
        icon: <span className="text-lg">🔟</span>,
        title: m('l2Title'),
        meta: m('l2Meta'),
        progress: 45,
        color: 'primary',
      },
      {
        id: 'l3',
        icon: <span className="text-lg">➖</span>,
        title: m('l3Title'),
        meta: m('l3Meta'),
        color: 'teal',
      },
      {
        id: 'l4',
        icon: <span className="text-lg">🔻</span>,
        title: m('l4Title'),
        meta: m('l4Meta'),
        color: 'coral',
      },
    ],
  }
}
