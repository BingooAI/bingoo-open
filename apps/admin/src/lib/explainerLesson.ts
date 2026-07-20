/**
 * explainerLesson.ts — a small acceptance lesson authored fresh for bingoo (NOT
 * ported demo content): "Even & odd" for grade-1, bilingual (vi + en). Proves the
 * migrated engine + renderer play an authored ExplainerDoc end-to-end. The theme
 * is inlined so the lesson validates headlessly (no renderer import).
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
          place: { at: 'free', x: 0.5, y: 0.16, size: 0.11, w: 0.9 },
          style: { fontSize: 'title', color: 'ink', font: 'hand', align: 'center' },
          startVisible: true,
        },
        {
          id: 'stars',
          type: 'manipulative',
          place: { at: 'free', x: 0.5, y: 0.58, size: 0.5, w: 0.7 },
          content: { kind: 'evenodd', params: { number: 8, showResult: true, icon: 'star' } },
          startVisible: false,
        },
      ],
      beats: [{ id: 'b1', cue: 'c1', actions: [{ verb: 'reveal', target: 'stars', from: 'up' }] }],
      narrationRef: 'n1',
      hold: 1.2,
    },
  ],
}

export const ACCEPTANCE_VI: LocaleBundle = {
  locale: 'vi',
  strings: { title: 'Số chẵn và số lẻ' },
  narration: {
    n1: {
      script: 'Tám ngôi sao [[cue:c1]] ghép được bốn đôi, không dư — nên tám là số chẵn.',
      voice: 'vi',
      marks: [{ cue: 'c1', t: 0.8 }],
    },
  },
}

export const ACCEPTANCE_EN: LocaleBundle = {
  locale: 'en',
  strings: { title: 'Even and Odd' },
  narration: {
    n1: {
      script: 'Eight stars [[cue:c1]] make four pairs with none left over — so eight is even.',
      voice: 'en',
      marks: [{ cue: 'c1', t: 0.8 }],
    },
  },
}

export const ACCEPTANCE_BUNDLES: Record<string, LocaleBundle> = {
  vi: ACCEPTANCE_VI,
  en: ACCEPTANCE_EN,
}
