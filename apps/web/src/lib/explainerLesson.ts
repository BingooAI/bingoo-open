/**
 * explainerLesson.ts — a small acceptance lesson authored fresh for bingoo (NOT
 * ported demo content): "Even & odd" for grade-1, bilingual (vi + en). Two scenes:
 * an exposition that reveals + pairs the stars (the SHOW manipulative), then a
 * gate — the interactive activity beat (a select question graded in the player,
 * rendered with @bingoo/ui-web). Proves the migrated engine + renderer play an
 * authored ExplainerDoc end-to-end. Theme inlined so the lesson validates
 * headlessly (no renderer import).
 */
import type { ExplainerDoc, LocaleBundle, ThemeTokens } from '@bingoo/explainer'

const theme: ThemeTokens = {
  colors: {
    ink: '#2b2724',
    inkSoft: '#7d736a',
    paper: '#f7f2e9',
    accent: '#e07a42',
    accent2: '#3f83bf',
    good: '#3f9d5a',
    warn: '#d98b2b',
    faint: '#d8cfc2',
    cloudFill: '#fbf8f2',
    sunCore: '#f7d488',
    leaf: '#bcd9a6',
    leafDeep: '#6fae5a',
    ground: '#cbb99c',
  },
  fontSizes: { caption: 30, body: 40, title: 68, huge: 96 },
  weights: { sm: 4, md: 7, lg: 11 },
  fonts: {
    hand: 'var(--font-baloo), ui-rounded, system-ui, sans-serif',
    sans: 'var(--font-bvp), system-ui, sans-serif',
  },
  register: 'warm',
}

export const ACCEPTANCE_DOC: ExplainerDoc = {
  version: 'explainer/v2',
  meta: {
    id: 'acc-evenodd',
    title: 'Số chẵn & số lẻ',
    topic: 'even and odd numbers',
    defaultLocale: 'vi',
    audience: { stage: 'primary', grade: '1' },
    objectives: [{ id: 'o1', statement: 'Nhận biết số chẵn ghép đôi hết, số lẻ dư một.' }],
  },
  locales: ['vi', 'en'],
  theme,
  scenes: [
    {
      id: 's1',
      kind: 'exposition',
      layout: { template: 'hero-caption', regions: {} },
      elements: [
        {
          id: 'title',
          type: 'text',
          place: { at: 'free', x: 0.5, y: 0.15, size: 0.1, w: 0.9 },
          style: { fontSize: 'title', color: 'ink', font: 'hand', align: 'center' },
          startVisible: true,
        },
        {
          id: 'stars',
          type: 'manipulative',
          place: { at: 'free', x: 0.5, y: 0.58, size: 0.52, w: 0.72 },
          content: { kind: 'evenodd', params: { number: 8, showResult: true, icon: 'star' } },
          startVisible: false,
        },
      ],
      beats: [
        {
          id: 'b1',
          cue: 'c1',
          actions: [{ verb: 'reveal', target: 'stars', from: 'up' }],
          hold: 1.2,
        },
        {
          id: 'b2',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 'stars', style: 'pulse' }],
          hold: 1.4,
        },
      ],
      narrationRef: 'n1',
      hold: 2.5,
    },
    {
      id: 's2',
      kind: 'gate',
      layout: { template: 'hero-caption', regions: {} },
      elements: [
        {
          id: 'q',
          type: 'text',
          place: { at: 'free', x: 0.5, y: 0.16, size: 0.08, w: 0.9 },
          style: { fontSize: 'body', color: 'ink', font: 'hand', align: 'center' },
          startVisible: true,
        },
      ],
      // Activity beat: a @bingoo/core single-choice question, rendered + graded by
      // @bingoo/ui-web's QuizShell (one of ~40 shared question types).
      gate: {
        kind: 'activity',
        prompt: 'Cùng luyện tập nào!',
        answer: '',
        activity: {
          quiz: {
            id: 'q1',
            type: 'single',
            prompt: 'Số 7 là số chẵn hay số lẻ?',
            choices: [
              { id: 'even', label: 'Số chẵn' },
              { id: 'odd', label: 'Số lẻ' },
            ],
            answerId: 'odd',
            explanation: 'Bảy ngôi sao ghép đôi vẫn dư một, nên bảy là số lẻ.',
          },
        },
        onPass: 'resume',
      },
    },
    {
      id: 's3',
      kind: 'gate',
      layout: { template: 'hero-caption', regions: {} },
      elements: [
        {
          id: 'q2',
          type: 'text',
          place: { at: 'free', x: 0.5, y: 0.16, size: 0.08, w: 0.9 },
          style: { fontSize: 'body', color: 'ink', font: 'hand', align: 'center' },
          startVisible: true,
        },
      ],
      // A different question type — a number line the learner marks (NumberLineInput).
      gate: {
        kind: 'activity',
        prompt: 'Trục số',
        answer: '',
        activity: {
          quiz: {
            id: 'q2',
            type: 'numberline',
            prompt: 'Đặt điểm vào số chẵn ngay sau số 6.',
            min: 0,
            max: 10,
            step: 2,
            answer: 8,
            explanation: 'Sau 6, số chẵn tiếp theo là 8.',
          },
        },
        onPass: 'resume',
      },
    },
  ],
}

export const ACCEPTANCE_VI: LocaleBundle = {
  locale: 'vi',
  strings: { title: 'Số chẵn và số lẻ', q: 'Cùng luyện tập nào!', q2: 'Luyện thêm nhé' },
  narration: {
    n1: {
      script:
        'Nhìn tám ngôi sao nhé. [[cue:c1]] Chúng ghép được đúng bốn đôi, [[cue:c2]] không dư ngôi sao nào — nên tám là số chẵn.',
      voice: 'vi',
      marks: [
        { cue: 'c1', t: 1.1 },
        { cue: 'c2', t: 2.6 },
      ],
    },
  },
}

export const ACCEPTANCE_EN: LocaleBundle = {
  locale: 'en',
  strings: { title: 'Even and Odd', q: "Let's practise!", q2: 'One more' },
  narration: {
    n1: {
      script:
        'Look at the eight stars. [[cue:c1]] They make exactly four pairs, [[cue:c2]] with none left over — so eight is even.',
      voice: 'en',
      marks: [
        { cue: 'c1', t: 1.1 },
        { cue: 'c2', t: 2.6 },
      ],
    },
  },
}

export const ACCEPTANCE_BUNDLES: Record<string, LocaleBundle> = {
  vi: ACCEPTANCE_VI,
  en: ACCEPTANCE_EN,
}
