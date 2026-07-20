// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * reference.ts — ONE COMPLETE LESSON, end to end.
 *
 * The per-template examples show a model how to fill a slot. They do not show it
 * what a LESSON is, and a model that has only seen fragments assembles fragments:
 * ten scenes, the same kit standing still in four of them, two identical
 * multiple-choice questions, done. Every rule obeyed, nothing taught.
 *
 * Models imitate wholes far more reliably than they obey rules. So this is the
 * whole: the full arc (explore → orient → teach → formalize → guided → practice
 * → recap → checkout), kits that MOVE on narration cues, varied templates, a
 * diagram, a manipulative gate, real Vietnamese narration in a teacher's voice.
 *
 * It is checked by `checkLesson` + `checkScene` in the test suite. If it ever
 * stops passing, the build fails — because a gold example the gate would reject
 * is worse than no example: it teaches the model to produce exactly the lesson
 * that gets thrown away.
 */
import type { ExplainerDoc, LocaleBundle } from './schema'

export const REFERENCE_DOC: ExplainerDoc = {
  version: 'explainer/v2',
  meta: { id: 'chan-le-lop-1', title: 'Số chẵn & số lẻ', defaultLocale: 'vi', targetMinutes: 6 },
  locales: ['vi'],
  theme: {
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
    fontSizes: { label: 24, caption: 28, body: 32, title: 64, huge: 96 },
    weights: { sm: 4, md: 7, lg: 11 },
    fonts: {
      hand: 'var(--font-baloo), ui-rounded, system-ui, sans-serif',
      sans: 'var(--font-bvp), system-ui, sans-serif',
    },
    register: 'warm',
  },
  background: { kind: 'meadow', panel: true },
  scenes: [
    /* ─────────────────────────────── KHÁM PHÁ ─────────────────────────────── */
    {
      id: 's1',
      kind: 'exposition',
      phase: 'explore',
      narrationRef: 'n1',
      layout: { template: 'title-card', regions: {} },
      elements: [
        {
          id: 's1_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        {
          id: 's1_im',
          type: 'image',
          region: 'focal',
          startVisible: true,
          content: {
            kind: 'image',
            query: 'nhiều ngôi sao vàng vui vẻ, vẽ hoạt hình cho trẻ em',
            prompt:
              'nhiều ngôi sao vàng vui vẻ, vẽ hoạt hình cho trẻ em, flat vector illustration, white background',
            tags: ['nhi', 'sao', 'vui', 'cho'],
            alt: 'Ngôi sao',
            w: 1024,
            h: 1024,
          },
        },
      ],
      beats: [
        { id: 's1_b1', cue: 'c1', actions: [{ verb: 'reveal', target: 's1_ti', from: 'up' }] },
        {
          id: 's1_b2',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's1_im', style: 'bounce' }],
        },
      ],
    },
    {
      id: 's2',
      kind: 'exposition',
      phase: 'explore',
      narrationRef: 'n2',
      layout: { template: 'compare', regions: {} },
      elements: [
        {
          id: 's2_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        // Two kits side by side, each COUNTING ITSELF OUT on a cue — the child
        // watches six and seven appear, and is asked to notice the difference
        // BEFORE anyone has explained anything. That is what "explore" means.
        {
          id: 's2_L',
          type: 'manipulative',
          region: 'left',
          content: {
            kind: 'count',
            params: { count: 0, shape: 'star' },
            actions: [{ verb: 'setCount', at: '@c2', args: { n: 6 } }],
          },
        },
        {
          id: 's2_R',
          type: 'manipulative',
          region: 'right',
          content: {
            kind: 'count',
            params: { count: 0, shape: 'star' },
            actions: [{ verb: 'setCount', at: '@c3', args: { n: 7 } }],
          },
        },
        {
          id: 's2_ll',
          type: 'text',
          region: 'leftLabel',
          style: { fontSize: 'label', align: 'center' },
          content: {},
        },
        {
          id: 's2_rl',
          type: 'text',
          region: 'rightLabel',
          style: { fontSize: 'label', align: 'center' },
          content: {},
        },
      ],
      beats: [
        { id: 's2_b1', cue: 'c2', actions: [{ verb: 'reveal', target: 's2_ll' }] },
        { id: 's2_b2', cue: 'c3', actions: [{ verb: 'reveal', target: 's2_rl' }] },
        {
          id: 's2_b3',
          cue: 'c4',
          actions: [{ verb: 'emphasize', target: 's2_R', style: 'wobble' }],
        },
      ],
    },

    /* ─────────────────────────────── LÀM QUEN ─────────────────────────────── */
    {
      id: 's3',
      kind: 'exposition',
      phase: 'orient',
      narrationRef: 'n3',
      layout: { template: 'teach', regions: {} },
      elements: [
        {
          id: 's3_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        // CONCRETE: the child watches eight stars pair up WHILE the teacher
        // counts "hai, bốn, sáu, tám". No rule has been stated yet.
        {
          id: 's3_kit',
          type: 'manipulative',
          region: 'stage',
          content: {
            kind: 'evenodd',
            params: {
              number: 0,
              icon: 'star',
              showResult: false,
              labels: { even: '{n} là số CHẴN', odd: '{n} là số LẺ' },
            },
            actions: [
              { verb: 'setNumber', at: '@c1', args: { n: 8 } },
              { verb: 'showResult', at: '@c3' },
            ],
          },
        },
        {
          id: 's3_co',
          type: 'text',
          region: 'callout',
          style: { fontSize: 'label', align: 'center', color: 'good' },
          content: {},
        },
      ],
      beats: [
        {
          id: 's3_b1',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's3_kit', style: 'pulse' }],
        },
        {
          id: 's3_b2',
          cue: 'c3',
          actions: [
            { verb: 'reveal', target: 's3_co' },
            { verb: 'sfx', sound: 'success' },
          ],
        },
      ],
    },

    /* ────────────────────────────────── DẠY ───────────────────────────────── */
    {
      id: 's4',
      kind: 'exposition',
      phase: 'teach',
      narrationRef: 'n4',
      layout: { template: 'teach', regions: {} },
      elements: [
        {
          id: 's4_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        {
          id: 's4_kit',
          type: 'manipulative',
          region: 'stage',
          content: {
            kind: 'evenodd',
            params: {
              number: 8,
              icon: 'star',
              showResult: false,
              labels: { even: '{n} là số CHẴN', odd: '{n} là số LẺ' },
            },
            actions: [
              { verb: 'remove', at: '@c1', args: { n: 1 } }, // 8 → 7, live
              { verb: 'showResult', at: '@c3' },
            ],
          },
        },
        {
          id: 's4_co',
          type: 'text',
          region: 'callout',
          style: { fontSize: 'label', align: 'center', color: 'accent' },
          content: {},
        },
      ],
      beats: [
        {
          id: 's4_b1',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's4_kit', style: 'shake' }],
        },
        { id: 's4_b2', cue: 'c3', actions: [{ verb: 'reveal', target: 's4_co' }] },
      ],
    },
    {
      id: 's5',
      kind: 'exposition',
      phase: 'teach',
      narrationRef: 'n5',
      layout: { template: 'sequence', regions: {} },
      elements: [
        {
          id: 's5_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        // A DIFFERENT representation of the same idea — the ten-frame. One kit
        // repeated teaches one way of seeing; this is why the contract asks for
        // at least three.
        {
          id: 's5_a',
          type: 'manipulative',
          region: 'steps',
          flow: { order: 1 },
          content: {
            kind: 'tenframe',
            params: { count: 0 },
            actions: [{ verb: 'fill', at: '@c1', args: { n: 4 } }],
          },
        },
        {
          id: 's5_b',
          type: 'manipulative',
          region: 'steps',
          flow: { order: 2 },
          content: {
            kind: 'tenframe',
            params: { count: 0 },
            actions: [{ verb: 'fill', at: '@c2', args: { n: 5 } }],
          },
        },
        {
          id: 's5_c',
          type: 'manipulative',
          region: 'steps',
          flow: { order: 3 },
          content: {
            kind: 'tenframe',
            params: { count: 0 },
            actions: [{ verb: 'fill', at: '@c3', args: { n: 6 } }],
          },
        },
      ],
      beats: [
        {
          id: 's5_b1',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's5_b', style: 'wobble' }],
        },
        {
          id: 's5_b2',
          cue: 'c4',
          actions: [{ verb: 'emphasize', target: 's5_c', style: 'pulse' }],
        },
      ],
    },
    {
      id: 's6',
      kind: 'exposition',
      phase: 'teach',
      narrationRef: 'n6',
      layout: { template: 'teach', regions: {} },
      elements: [
        {
          id: 's6_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        // A third representation: the number line. Hop two at a time and the
        // even numbers are the ones you land on.
        {
          id: 's6_nl',
          type: 'manipulative',
          region: 'stage',
          content: {
            kind: 'numberline',
            params: { min: 0, max: 10 },
            actions: [
              { verb: 'jump', at: '@c1', args: { from: 0, to: 2 } },
              { verb: 'jump', at: '@c2', args: { from: 2, to: 4 } },
              { verb: 'jump', at: '@c3', args: { from: 4, to: 6 } },
            ],
          },
        },
        {
          id: 's6_co',
          type: 'text',
          region: 'callout',
          style: { fontSize: 'label', align: 'center', color: 'good' },
          content: {},
        },
      ],
      beats: [
        { id: 's6_b1', cue: 'c3', actions: [{ verb: 'reveal', target: 's6_co' }] },
        {
          id: 's6_b2',
          cue: 'c4',
          actions: [{ verb: 'emphasize', target: 's6_co', style: 'tada' }],
        },
      ],
    },

    /* ──────────────────────────── CHỐT QUY TẮC ────────────────────────────── */
    {
      id: 's7',
      kind: 'exposition',
      phase: 'formalize',
      narrationRef: 'n7',
      layout: { template: 'flow', regions: {} },
      elements: [
        {
          id: 's7_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        // The rule as a DECISION you can walk — the engine ranks the nodes and
        // draws the edges. This is what a table or a paragraph cannot do.
        {
          id: 's7_dg',
          type: 'diagram',
          region: 'diagram',
          content: {
            layoutKind: 'flow',
            direction: 'auto',
            nodes: [
              { id: 'n1', label: 'Đếm', shape: 'pill' },
              { id: 'n2', label: 'Ghép đôi', shape: 'box' },
              { id: 'n3', label: 'Còn dư?', shape: 'diamond' },
              { id: 'n4', label: 'CHẴN', shape: 'circle' },
              { id: 'n5', label: 'LẺ', shape: 'circle' },
            ],
            edges: [
              { id: 'e1', from: 'n1', to: 'n2', kind: 'arrow' },
              { id: 'e2', from: 'n2', to: 'n3', kind: 'arrow' },
              { id: 'e3', from: 'n3', to: 'n4', label: 'hết', kind: 'arrow' },
              { id: 'e4', from: 'n3', to: 'n5', label: 'dư 1', kind: 'arrow' },
            ],
          },
        },
      ],
      beats: [
        {
          id: 's7_b1',
          cue: 'c1',
          actions: [
            { verb: 'revealNode', diagram: 's7_dg', node: 'n1' },
            { verb: 'revealNode', diagram: 's7_dg', node: 'n2' },
            { verb: 'connect', diagram: 's7_dg', edge: 'e1' },
          ],
        },
        {
          id: 's7_b2',
          cue: 'c2',
          actions: [
            { verb: 'revealNode', diagram: 's7_dg', node: 'n3' },
            { verb: 'connect', diagram: 's7_dg', edge: 'e2' },
          ],
        },
        {
          id: 's7_b3',
          cue: 'c3',
          actions: [
            { verb: 'revealNode', diagram: 's7_dg', node: 'n4' },
            { verb: 'connect', diagram: 's7_dg', edge: 'e3' },
          ],
        },
        {
          id: 's7_b4',
          cue: 'c4',
          actions: [
            { verb: 'revealNode', diagram: 's7_dg', node: 'n5' },
            { verb: 'connect', diagram: 's7_dg', edge: 'e4' },
          ],
        },
      ],
    },
    {
      id: 's8',
      kind: 'exposition',
      phase: 'formalize',
      narrationRef: 'n8',
      layout: { template: 'rule', regions: {} },
      elements: [
        {
          id: 's8_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        {
          id: 's8_ru',
          type: 'text',
          region: 'card',
          style: { fontSize: 'body', align: 'center', color: 'accent' },
          content: {},
        },
        {
          id: 's8_su',
          type: 'manipulative',
          region: 'support',
          content: {
            kind: 'evenodd',
            params: {
              number: 6,
              icon: 'star',
              showResult: false,
              labels: { even: '{n} là số CHẴN', odd: '{n} là số LẺ' },
            },
            actions: [{ verb: 'showResult', at: '@c2' }],
          },
        },
      ],
      beats: [
        { id: 's8_b1', cue: 'c1', actions: [{ verb: 'reveal', target: 's8_ru' }] },
        {
          id: 's8_b2',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's8_ru', style: 'tada' }],
        },
      ],
    },

    /* ──────────────────── LUYỆN CÓ HƯỚNG DẪN (cô làm cùng em) ─────────────── */
    {
      id: 's9',
      kind: 'exposition',
      phase: 'guided',
      narrationRef: 'n9',
      layout: { template: 'worked-example', regions: {} },
      elements: [
        {
          id: 's9_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        {
          id: 's9_pr',
          type: 'text',
          region: 'problem',
          style: { fontSize: 'body', align: 'center', color: 'accent2' },
          startVisible: true,
          content: {},
        },
        {
          id: 's9_st',
          type: 'list',
          region: 'steps',
          content: {
            style: 'number',
            items: ['Đếm: có 12 ngôi sao.', 'Ghép đôi: 2, 4, 6, 8, 10, 12.', 'Không dư ai → CHẴN.'],
          },
        },
        { id: 's9_an', type: 'stat', region: 'answer', content: { value: 'CHẴN', color: 'good' } },
      ],
      beats: [
        { id: 's9_b1', cue: 'c2', actions: [{ verb: 'revealAll', target: 's9_st' }] },
        {
          id: 's9_b2',
          cue: 'c3',
          actions: [
            { verb: 'reveal', target: 's9_an' },
            { verb: 'emphasize', target: 's9_an', style: 'tada' },
          ],
        },
      ],
    },

    /* ───────────────────────── THỰC HÀNH (em tự làm) ──────────────────────── */
    {
      id: 's10',
      kind: 'gate',
      phase: 'practice',
      layout: { template: 'practice', regions: {} },
      elements: [
        {
          id: 's10_pr',
          type: 'text',
          region: 'prompt',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
      ],
      gate: {
        kind: 'activity',
        prompt: 'Số 9 là chẵn hay lẻ?',
        answer: '',
        onPass: 'resume',
        activity: {
          quiz: {
            id: 'q1',
            type: 'single',
            prompt: 'Số 9 là chẵn hay lẻ?',
            choices: [
              { id: 'even', label: 'Chẵn' },
              { id: 'odd', label: 'Lẻ' },
            ],
            answerId: 'odd',
          },
        },
        feedback: {
          correct: 'Đúng rồi! 9 ghép đôi còn dư một bạn.',
          wrong: 'Em thử ghép đôi 9 ngôi sao xem còn dư không nhé.',
        },
      },
    },
    {
      id: 's11',
      kind: 'gate',
      phase: 'practice',
      layout: { template: 'practice', regions: {} },
      elements: [
        {
          id: 's11_pr',
          type: 'text',
          region: 'prompt',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
      ],
      gate: {
        // A DIFFERENT kind of question, and one the child does WITH THEIR HANDS
        // on the very kit they learned on — not another button to pick.
        kind: 'activity',
        prompt: 'Em hãy lấy đủ 10 ngôi sao.',
        answer: '',
        onPass: 'resume',
        activity: {
          manip: { kind: 'count', params: { count: 3, shape: 'star' }, target: { count: 10 } },
        },
        feedback: {
          correct: 'Giỏi lắm! 10 ghép đôi hết, là số chẵn.',
          wrong: 'Em đếm lại xem đã đủ 10 chưa nhé.',
        },
      },
    },
    {
      id: 's12',
      kind: 'gate',
      phase: 'practice',
      layout: { template: 'practice', regions: {} },
      elements: [
        {
          id: 's12_pr',
          type: 'text',
          region: 'prompt',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
      ],
      gate: {
        kind: 'activity',
        prompt: 'Số 14 là số chẵn, đúng hay sai?',
        answer: '',
        onPass: 'resume',
        activity: {
          quiz: {
            id: 'q2',
            type: 'boolean',
            prompt: 'Số 14 là số chẵn.',
            trueLabel: 'Đúng',
            falseLabel: 'Sai',
            answer: true,
          },
        },
        feedback: {
          correct: 'Chuẩn! Chữ số cuối là 4, nằm trong 0-2-4-6-8.',
          wrong: 'Em nhìn chữ số cuối của 14 xem sao.',
        },
      },
    },

    /* ──────────────────────────────── ÔN TẬP ──────────────────────────────── */
    {
      id: 's13',
      kind: 'exposition',
      phase: 'recap',
      narrationRef: 'n13',
      layout: { template: 'bullets', regions: {} },
      elements: [
        {
          id: 's13_ti',
          type: 'text',
          region: 'title',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
        {
          id: 's13_ls',
          type: 'list',
          region: 'list',
          content: {
            style: 'check',
            items: [
              'Em ghép đôi được các vật.',
              'Ghép hết → số CHẴN.',
              'Dư một bạn → số LẺ.',
              'Nhìn chữ số cuối là biết ngay.',
            ],
          },
        },
      ],
      beats: [
        { id: 's13_b1', cue: 'c1', actions: [{ verb: 'revealAll', target: 's13_ls' }] },
        {
          id: 's13_b2',
          cue: 'c2',
          actions: [{ verb: 'emphasize', target: 's13_ls', style: 'pulse' }],
        },
      ],
    },

    /* ────────────────────────────── KIỂM TRA CUỐI ─────────────────────────── */
    {
      id: 's14',
      kind: 'gate',
      phase: 'checkout',
      layout: { template: 'practice', regions: {} },
      elements: [
        {
          id: 's14_pr',
          type: 'text',
          region: 'prompt',
          style: { fontSize: 'title', align: 'center' },
          startVisible: true,
          content: {},
        },
      ],
      gate: {
        // A different FORM again: sort, don't pick. A child who only memorised
        // the shape of the practice questions cannot do this one.
        kind: 'activity',
        prompt: 'Xếp các số vào đúng nhóm.',
        answer: '',
        onPass: 'resume',
        activity: {
          quiz: {
            id: 'q3',
            type: 'categorize',
            prompt: 'Số nào chẵn, số nào lẻ?',
            categories: [
              { id: 'even', label: 'CHẴN' },
              { id: 'odd', label: 'LẺ' },
            ],
            items: [
              { id: 'i2', label: '2' },
              { id: 'i5', label: '5' },
              { id: 'i8', label: '8' },
              { id: 'i11', label: '11' },
            ],
            // the answer key is a MAPPING itemId → categoryId, not a field on the
            // item — the gate caught this in my own gold example
            assignment: { i2: 'even', i5: 'odd', i8: 'even', i11: 'odd' },
          },
        },
        feedback: {
          correct: 'Em đã hiểu thật rồi đấy!',
          wrong: 'Em thử ghép đôi từng số xem nhé.',
        },
      },
    },
  ],
}

export const REFERENCE_BUNDLE: LocaleBundle = {
  locale: 'vi',
  strings: {
    s1_ti: 'Số chẵn & số lẻ',
    s2_ti: 'Nhóm nào ghép đôi hết?',
    s2_ll: 'Sáu ngôi sao',
    s2_rl: 'Bảy ngôi sao',
    s3_ti: 'Ghép đôi 8 ngôi sao',
    s3_co: 'CHẴN',
    s4_ti: 'Bớt đi một thì sao?',
    s4_co: 'LẺ',
    s5_ti: 'Nhìn trên khung mười',
    s6_ti: 'Nhảy hai bước một',
    s6_co: 'Toàn số chẵn!',
    s7_ti: 'Cách kiểm tra',
    s8_ti: 'Quy tắc cần nhớ',
    s8_ru: 'Ghép hết → CHẴN. Dư 1 → LẺ.',
    s9_ti: 'Cô làm cùng em',
    s9_pr: '12 ngôi sao là chẵn hay lẻ?',
    s10_pr: 'Đến lượt em!',
    s11_pr: 'Em lấy đủ 10 ngôi sao nhé',
    s12_pr: 'Đúng hay sai?',
    s13_ti: 'Em đã làm được gì?',
    s14_pr: 'Thử thách cuối',
  },
  narration: {
    n1: {
      script:
        '[[cue:c1]] Chào em! Hôm nay cô và em sẽ khám phá một điều rất thú vị về các con số. [[cue:c2]] Em nhìn những ngôi sao này nhé — có những nhóm ghép đôi được hết, có nhóm lại dư ra một bạn. Vì sao lại thế nhỉ?',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 4.2 },
      ],
    },
    n2: {
      script:
        '[[cue:c1]] Cô có hai nhóm ngôi sao. [[cue:c2]] Bên trái, cô đặt sáu ngôi sao. [[cue:c3]] Bên phải, cô đặt bảy ngôi sao. [[cue:c4]] Em thử nhìn kỹ xem: nhóm nào ghép đôi được hết, nhóm nào còn thừa một bạn? Đừng vội trả lời, cứ nhìn đã nhé.',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 2.4 },
        { cue: 'c3', t: 5.0 },
        { cue: 'c4', t: 7.6 },
      ],
    },
    n3: {
      script:
        '[[cue:c1]] Bây giờ cô lấy tám ngôi sao. [[cue:c2]] Mình ghép chúng thành từng đôi nhé: hai, bốn, sáu, tám. [[cue:c3]] Em thấy không, không còn bạn nào đứng một mình cả! Số tám là số CHẴN.',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 3.0 },
        { cue: 'c3', t: 8.2 },
      ],
    },
    n4: {
      script:
        '[[cue:c1]] Giờ cô bớt đi một ngôi sao, còn lại bảy. [[cue:c2]] Mình lại ghép đôi: hai, bốn, sáu... [[cue:c3]] Ơ kìa, còn một bạn đứng lẻ loi, không tìm được đôi! Số bảy là số LẺ.',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 3.4 },
        { cue: 'c3', t: 7.8 },
      ],
    },
    n5: {
      script:
        '[[cue:c1]] Mình thử nhìn theo cách khác nhé — cô dùng khung mười ô. Bốn ô được tô. [[cue:c2]] Giờ là năm ô: em thấy hàng dưới có một ô lẻ loi không? [[cue:c3]] Còn sáu ô thì sao? [[cue:c4]] Sáu lại ghép đôi hết, không thừa ô nào. Chẵn!',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 4.5 },
        { cue: 'c3', t: 8.8 },
        { cue: 'c4', t: 10.8 },
      ],
    },
    n6: {
      script:
        '[[cue:c1]] Còn một cách nữa: mình nhảy trên trục số, mỗi lần hai bước. Từ không nhảy tới hai. [[cue:c2]] Từ hai nhảy tới bốn. [[cue:c3]] Từ bốn nhảy tới sáu. [[cue:c4]] Em nhìn xem, những chỗ mình đáp xuống đều là số chẵn cả!',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 4.6 },
        { cue: 'c3', t: 6.8 },
        { cue: 'c4', t: 9.0 },
      ],
    },
    n7: {
      script:
        '[[cue:c1]] Mình chốt lại cách làm nhé: đầu tiên em đếm, rồi em ghép đôi. [[cue:c2]] Sau đó em tự hỏi: còn dư bạn nào không? [[cue:c3]] Nếu ghép hết, không dư ai, thì đó là số CHẴN. [[cue:c4]] Còn nếu dư đúng một bạn, thì đó là số LẺ.',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 4.4 },
        { cue: 'c3', t: 7.2 },
        { cue: 'c4', t: 10.4 },
      ],
    },
    n8: {
      script:
        '[[cue:c1]] Em nhớ giúp cô câu này nhé: ghép đôi hết thì là số CHẴN, còn dư một bạn thì là số LẺ. [[cue:c2]] Chỉ có vậy thôi, dễ lắm phải không nào!',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 6.0 },
      ],
    },
    n9: {
      script:
        '[[cue:c1]] Giờ cô làm một bài cùng em nhé. Cô có mười hai ngôi sao. [[cue:c2]] Mình làm từng bước: đếm này, rồi ghép đôi này. [[cue:c3]] Không dư bạn nào cả — vậy mười hai là số CHẴN. Em thấy dễ chưa?',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 4.0 },
        { cue: 'c3', t: 8.5 },
      ],
    },
    n13: {
      script:
        '[[cue:c1]] Em giỏi quá! Bây giờ em đã ghép đôi được, biết ghép hết là chẵn, dư một là lẻ. [[cue:c2]] Và em chỉ cần nhìn chữ số cuối cùng là trả lời được ngay rồi đấy!',
      voice: 'vi-VN',
      marks: [
        { cue: 'c1', t: 0.3 },
        { cue: 'c2', t: 6.4 },
      ],
    },
  },
}
