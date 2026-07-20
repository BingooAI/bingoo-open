// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * examples.ts — one WORKED EXAMPLE per template: the few-shot the model actually
 * copies from.
 *
 * A contract tells a model what is legal. It does not tell it what GOOD looks
 * like, and models imitate far more reliably than they obey. So every template
 * ships a real, filled-in scene.
 *
 * The critical property: these are checked by `checkScene()` in the test suite.
 * An example that drifts out of contract FAILS THE BUILD. A stale few-shot is
 * worse than none — it teaches the model to produce exactly the scene the gate
 * will then reject.
 */
import type { Scene } from './schema'
import type { Template } from './catalog'

export type Example = {
  scene: Scene
  /** the bundle strings this scene needs — prose never lives in the doc */
  strings: Record<string, string>
  /** why this template was chosen here — teaches SELECTION, not just filling */
  why: string
}

const sc = (
  id: string,
  template: Template,
  elements: Scene['elements'],
  extra: Partial<Scene> = {},
): Scene => ({
  id,
  kind: 'exposition',
  layout: { template, regions: {} },
  elements,
  ...extra,
})

const t = (id: string, region: string, rung: string) => ({
  id,
  type: 'text' as const,
  region,
  style: { fontSize: rung, align: 'center' },
  startVisible: true,
})

export const EXAMPLES: Partial<Record<Template, Example>> = {
  'title-card': {
    why: 'Mở bài: một tên bài, một hình. Không nhồi thêm gì.',
    scene: sc('ex', 'title-card', [
      t('ti', 'title', 'title'),
      {
        id: 'fo',
        type: 'image',
        region: 'focal',
        content: {
          kind: 'image',
          query: 'ngôi sao vàng vẽ hoạt hình',
          prompt: 'ngôi sao vàng vẽ hoạt hình, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Ngôi sao',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
    ]),
    strings: { ti: 'Số chẵn & số lẻ' },
  },

  teach: {
    why: 'Giảng MỘT ý bằng một vật thao tác. Callout chỉ chốt kết luận, không giảng lại.',
    scene: sc(
      'ex',
      'teach',
      [
        t('ti', 'title', 'title'),
        {
          id: 'kit',
          type: 'manipulative',
          region: 'stage',
          content: { kind: 'evenodd', params: { number: 8, showResult: true } },
          startVisible: true,
        },
        t('co', 'callout', 'label'),
      ],
      {
        narrationRef: 'n',
        beats: [
          {
            id: 'b1',
            cue: 'pair',
            actions: [{ verb: 'emphasize', target: 'kit', style: 'pulse' }],
          },
        ],
      },
    ),
    strings: { ti: 'Ghép đôi ngôi sao', co: 'CHẴN' },
  },

  compare: {
    why: 'Hai thứ cạnh nhau để LỘ RA khác biệt. Hai vế phải cùng loại element.',
    scene: sc('ex', 'compare', [
      t('ti', 'title', 'title'),
      {
        id: 'L',
        type: 'image',
        region: 'left',
        content: {
          kind: 'image',
          query: '4 ngôi sao xếp thành 2 cặp',
          prompt: '4 ngôi sao xếp thành 2 cặp, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Ghép hết',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
      {
        id: 'R',
        type: 'image',
        region: 'right',
        content: {
          kind: 'image',
          query: '5 ngôi sao, 2 cặp và 1 lẻ',
          prompt: '5 ngôi sao, 2 cặp và 1 lẻ, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Dư một',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
      t('ll', 'leftLabel', 'label'),
      t('rl', 'rightLabel', 'label'),
    ]),
    strings: { ti: 'Chẵn khác lẻ ở đâu?', ll: 'Ghép hết', rl: 'Dư một' },
  },

  sequence: {
    why: 'Các bước. MỌI phần tử phải có flow.order — thiếu là các bước xếp sai.',
    scene: sc('ex', 'sequence', [
      t('ti', 'title', 'title'),
      {
        id: 's1',
        type: 'manipulative',
        region: 'steps',
        flow: { order: 1 },
        content: { kind: 'count', params: { count: 4 } },
        startVisible: true,
      },
      {
        id: 's2',
        type: 'manipulative',
        region: 'steps',
        flow: { order: 2 },
        content: { kind: 'evenodd', params: { number: 4 } },
        startVisible: true,
      },
      {
        id: 's3',
        type: 'image',
        region: 'steps',
        flow: { order: 3 },
        content: {
          kind: 'image',
          query: 'pháo giấy ăn mừng',
          prompt: 'pháo giấy ăn mừng, flat vector illustration, white background',
          tags: ['illustration'],
          alt: 'Xong!',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
    ]),
    strings: { ti: 'Ba bước' },
  },

  rule: {
    why: 'Chốt quy tắc. `card` phải NGẮN — học sinh sẽ phải nhớ nguyên câu này.',
    scene: sc('ex', 'rule', [
      t('ti', 'title', 'title'),
      t('ru', 'card', 'body'),
      {
        id: 'su',
        type: 'image',
        region: 'support',
        content: {
          kind: 'image',
          query: 'ngôi sao vàng',
          prompt: 'ngôi sao vàng, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Sao',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
    ]),
    strings: { ti: 'Quy tắc', ru: 'Ghép hết → CHẴN. Dư 1 → LẺ.' },
  },

  flow: {
    why: 'Quy trình có rẽ nhánh → diagram. Engine tự xếp rank, tự vẽ cạnh — đừng tự đặt node.',
    scene: sc('ex', 'flow', [
      t('ti', 'title', 'title'),
      {
        id: 'dg',
        type: 'diagram',
        region: 'diagram',
        startVisible: true,
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
    ]),
    strings: { ti: 'Quy trình kiểm tra' },
  },

  bullets: {
    why: 'Ý chính. Beat `revealAll` build từng dòng theo lời giảng — đừng đổ hết ra một lúc.',
    scene: sc(
      'ex',
      'bullets',
      [
        t('ti', 'title', 'title'),
        {
          id: 'ls',
          type: 'list',
          region: 'list',
          content: {
            style: 'number',
            items: [
              'Đếm xem có bao nhiêu vật.',
              'Ghép chúng thành từng cặp.',
              'Không dư ai → số CHẴN.',
              'Dư đúng một → số LẺ.',
            ],
          },
        },
      ],
      {
        narrationRef: 'n',
        beats: [{ id: 'b1', cue: 'build', actions: [{ verb: 'revealAll', target: 'ls' }] }],
      },
    ),
    strings: { ti: 'Bốn bước nhận biết' },
  },

  'bullets-media': {
    why: 'Gạch đầu dòng + MỘT hình. Hình minh hoạ cho ý, không phải trang trí.',
    scene: sc('ex', 'bullets-media', [
      t('ti', 'title', 'title'),
      {
        id: 'ls',
        type: 'list',
        region: 'list',
        startVisible: true,
        content: {
          style: 'check',
          items: ['0, 2, 4, 6, 8 là chẵn', '1, 3, 5, 7, 9 là lẻ', 'Nhìn chữ số cuối là biết'],
        },
      },
      {
        id: 'im',
        type: 'image',
        region: 'media',
        content: {
          kind: 'image',
          query: 'ngôi sao vàng',
          prompt: 'ngôi sao vàng, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Sao',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
    ]),
    strings: { ti: 'Mẹo nhanh' },
  },

  data: {
    why: 'Số liệu. CHỈ đưa series — engine tính cao cột, mốc trục, phần trăm. `insight` nói Ý NGHĨA, không đọc lại số.',
    scene: sc('ex', 'data', [
      t('ti', 'title', 'title'),
      {
        id: 'ch',
        type: 'chart',
        region: 'chart',
        startVisible: true,
        content: {
          chart: 'column',
          unit: ' bạn',
          series: [
            { label: 'Chẵn', value: 18, color: 'good' },
            { label: 'Lẻ', value: 12, color: 'accent' },
            { label: 'Chưa rõ', value: 4, color: 'faint' },
          ],
        },
      },
      t('in', 'insight', 'body'),
    ]),
    strings: { ti: 'Lớp mình trả lời thế nào?', in: 'Hơn một nửa lớp đã nhận ra quy luật.' },
  },

  stats: {
    why: '2–4 con số đáng nhớ. Mỗi ô một stat, đặt flow.order.',
    scene: sc('ex', 'stats', [
      t('ti', 'title', 'title'),
      {
        id: 'k1',
        type: 'stat',
        region: 'stats',
        flow: { order: 1 },
        startVisible: true,
        content: { value: '5', label: 'chữ số chẵn', color: 'good' },
      },
      {
        id: 'k2',
        type: 'stat',
        region: 'stats',
        flow: { order: 2 },
        startVisible: true,
        content: { value: '5', label: 'chữ số lẻ', color: 'accent' },
      },
      {
        id: 'k3',
        type: 'stat',
        region: 'stats',
        flow: { order: 3 },
        startVisible: true,
        content: { value: '50', unit: '%', label: 'chẵn trong 1–100', color: 'accent2' },
      },
    ]),
    strings: { ti: 'Con số biết nói' },
  },

  table: {
    why: 'So sánh nhiều thứ theo nhiều chiều. ≤4 cột × ≤5 hàng, nếu không thì không đọc nổi.',
    scene: sc('ex', 'table', [
      t('ti', 'title', 'title'),
      {
        id: 'tb',
        type: 'table',
        region: 'table',
        startVisible: true,
        content: {
          header: ['Số', 'Ghép đôi', 'Dư', 'Kết luận'],
          rows: [
            ['6', '3 cặp', '0', 'CHẴN'],
            ['7', '3 cặp', '1', 'LẺ'],
            ['10', '5 cặp', '0', 'CHẴN'],
          ],
        },
      },
    ]),
    strings: { ti: 'Thử với vài số' },
  },

  'two-col': {
    why: 'Hai khối bất kỳ cạnh nhau. Dùng khi hai thứ BỔ TRỢ nhau (biểu đồ ↔ checklist).',
    scene: sc('ex', 'two-col', [
      t('ti', 'title', 'title'),
      {
        id: 'dn',
        type: 'chart',
        region: 'colA',
        startVisible: true,
        content: {
          chart: 'donut',
          series: [
            { label: 'Chẵn', value: 50, color: 'good' },
            { label: 'Lẻ', value: 50, color: 'accent' },
          ],
        },
      },
      {
        id: 'ls',
        type: 'list',
        region: 'colB',
        startVisible: true,
        content: { style: 'dash', items: ['Từ 1 đến 100', 'Có 50 số chẵn', 'Có 50 số lẻ'] },
      },
    ]),
    strings: { ti: 'Chia đôi hoàn hảo' },
  },

  'worked-example': {
    why: 'Hình dạng chuẩn của một bài toán mẫu: đề → các bước → đáp án.',
    scene: sc('ex', 'worked-example', [
      t('ti', 'title', 'title'),
      t('pr', 'problem', 'body'),
      {
        id: 'st',
        type: 'list',
        region: 'steps',
        startVisible: true,
        content: {
          style: 'number',
          items: ['14 có chữ số cuối là 4.', '4 nằm trong 0-2-4-6-8.', 'Vậy 14 là số chẵn.'],
        },
      },
      {
        id: 'an',
        type: 'stat',
        region: 'answer',
        startVisible: true,
        content: { value: 'CHẴN', color: 'good' },
      },
    ]),
    strings: { ti: 'Ví dụ mẫu', pr: 'Số 14 là chẵn hay lẻ?' },
  },

  definition: {
    why: 'Định nghĩa. `meaning` viết bằng LỜI CỦA HỌC SINH, không phải lời sách giáo khoa.',
    scene: sc('ex', 'definition', [
      t('te', 'term', 'huge'),
      t('me', 'meaning', 'body'),
      t('ex2', 'example', 'body'),
    ]),
    strings: {
      te: 'Số chẵn',
      me: 'Là số ghép đôi được hết, không dư con nào.',
      ex2: 'Ví dụ: 2, 4, 6, 8, 10…',
    },
  },

  quote: {
    why: 'Một câu đáng nhớ. KHÔNG có tiêu đề — câu nói LÀ tiêu đề.',
    scene: sc('ex', 'quote', [
      {
        id: 'q',
        type: 'quote',
        region: 'quote',
        startVisible: true,
        style: { fontSize: 'title' },
        content: { text: '', by: '' },
      },
    ]),
    strings: {
      q: 'Toán không phải nhớ công thức — mà là nhìn ra quy luật.',
      'q.by': 'Lời cô giáo',
    },
  },

  section: {
    why: 'Vách ngăn chương. Mắt chỉ có MỘT thứ để bám.',
    scene: sc('ex', 'section', [t('ki', 'kicker', 'label'), t('ti', 'title', 'huge')]),
    strings: { ki: 'PHẦN 2', ti: 'Luyện tập' },
  },

  'image-grid': {
    why: 'Nhiều hình cùng loại để đếm/nhóm. Đặt flow.order.',
    scene: sc('ex', 'image-grid', [
      t('ti', 'title', 'title'),
      {
        id: 'g1',
        type: 'image',
        region: 'grid',
        flow: { order: 1 },
        content: {
          kind: 'image',
          query: 'ngôi sao vàng',
          prompt: 'ngôi sao vàng, flat vector illustration, white background',
          tags: ['sao'],
          alt: 'Sao',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
      {
        id: 'g2',
        type: 'image',
        region: 'grid',
        flow: { order: 2 },
        content: {
          kind: 'image',
          query: 'chiếc tất kẻ sọc',
          prompt: 'chiếc tất kẻ sọc, flat vector illustration, white background',
          tags: ['chi'],
          alt: 'Tất',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
      {
        id: 'g3',
        type: 'image',
        region: 'grid',
        flow: { order: 3 },
        content: {
          kind: 'image',
          query: 'cây tròn xanh',
          prompt: 'cây tròn xanh, flat vector illustration, white background',
          tags: ['xanh'],
          alt: 'Cây',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
      {
        id: 'g4',
        type: 'image',
        region: 'grid',
        flow: { order: 4 },
        content: {
          kind: 'image',
          query: 'mặt trời cười',
          prompt: 'mặt trời cười, flat vector illustration, white background',
          tags: ['illustration'],
          alt: 'Mặt trời',
          w: 1024,
          h: 1024,
        },
        startVisible: true,
      },
    ]),
    strings: { ti: 'Đếm thử các nhóm này' },
  },

  practice: {
    why: "Học sinh LÀM. kind='gate' — activity do gate dựng, prompt là câu lệnh.",
    scene: {
      id: 'ex',
      kind: 'gate',
      layout: { template: 'practice', regions: {} },
      elements: [t('pr', 'prompt', 'title')],
      gate: {
        kind: 'activity',
        prompt: 'Số 7 là chẵn hay lẻ?',
        answer: '',
        // The question is a @bingoo.ai/core question: `single` (not "single-choice"),
        // `choices` (not "options"), it needs an `id`, and the ANSWER LIVES IN IT
        // (`answerId`) — not on the gate. Get any of that wrong and QuizShell has
        // nothing it knows how to draw, so it renders an empty card.
        activity: {
          quiz: {
            id: 'q1',
            type: 'single',
            prompt: 'Số 7 là chẵn hay lẻ?',
            choices: [
              { id: 'even', label: 'Chẵn' },
              { id: 'odd', label: 'Lẻ' },
            ],
            answerId: 'odd',
          },
        },
        onPass: 'resume',
      },
    } as Scene,
    strings: { pr: 'Đến lượt em thử' },
  },

  swimlane: {
    why: "Quy trình có NHIỀU VAI. Chỉ dùng khi 'ai làm gì' là điều cần dạy.",
    scene: sc('ex', 'swimlane', [
      t('ti', 'title', 'title'),
      {
        id: 'l1',
        type: 'text',
        region: 'laneLabels',
        flow: { order: 1 },
        style: { fontSize: 'label' },
        startVisible: true,
        content: {},
      },
      {
        id: 'l2',
        type: 'text',
        region: 'laneLabels',
        flow: { order: 2 },
        style: { fontSize: 'label' },
        startVisible: true,
        content: {},
      },
      {
        id: 'dg',
        type: 'diagram',
        region: 'diagram',
        startVisible: true,
        content: {
          layoutKind: 'flow',
          direction: 'auto',
          nodes: [
            { id: 'a1', label: 'Đọc đề', group: 'hs' },
            { id: 'a2', label: 'Chấm bài', group: 'gv' },
          ],
          edges: [{ id: 'e1', from: 'a1', to: 'a2', kind: 'arrow' }],
        },
      },
    ]),
    strings: { ti: 'Ai làm gì?', l1: 'Học sinh', l2: 'Giáo viên' },
  },

  recap: {
    why: 'Tổng kết: nhắc lại từng mục tiêu như một việc học sinh GIỜ LÀM ĐƯỢC.',
    scene: sc('ex', 'recap', [
      t('ti', 'title', 'title'),
      {
        id: 'r1',
        type: 'list',
        region: 'grid',
        flow: { order: 1 },
        startVisible: true,
        content: { style: 'check', items: ['Em đếm được', 'Em ghép đôi được'] },
      },
      {
        id: 'r2',
        type: 'list',
        region: 'grid',
        flow: { order: 2 },
        startVisible: true,
        content: { style: 'check', items: ['Em nói được chẵn hay lẻ'] },
      },
    ]),
    strings: { ti: 'Em đã làm được gì?' },
  },
}
