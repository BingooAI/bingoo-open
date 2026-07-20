/**
 * catalog.ts — the AUTHORING CONTRACT, derived from the layout engine itself.
 *
 * The question this file answers: how does a generator (an LLM, or a human in
 * the Studio) know how to fill these templates correctly?
 *
 * The wrong answer is a prose prompt describing the templates. Prose drifts:
 * someone adds a template or moves a slot, the prompt still describes the old
 * one, and generation confidently emits scenes that reference slots that no
 * longer exist. Prose also cannot say "this title holds 34 characters", so it
 * says "keep it short", which a model ignores.
 *
 * The right answer, and what this is:
 *
 *   1. SLOT_META is a `Record<Template, …>` — adding a template to the schema
 *      without describing its slots is a COMPILE ERROR. The catalog cannot go
 *      stale, because TypeScript will not let it.
 *   2. Everything measurable is MEASURED. The slot rects come from resolveLayout
 *      (the same function the renderer uses), and the character budgets come
 *      from the same type scale the renderer draws with. So the contract handed
 *      to the model and the pixels on the screen are computed from one source.
 *   3. The catalog is machine-readable, so the SAME object drives the prompt,
 *      the structured-output schema, and the validator. A model that satisfies
 *      the contract cannot produce a scene that overflows, collides, or names a
 *      slot that doesn't exist — those become unrepresentable, not "unlikely".
 */
import type { Aspect, ElementType, Scene } from './schema';
import { LayoutSpec } from './schema';
import { resolveLayout } from './layout';
import { charBudget } from './type';

export type Template = Scene['layout']['template'];

/** Every template the schema declares — the single source of truth. */
export const TEMPLATES = LayoutSpec.shape.template.options as readonly Template[];

export type SlotMeta = {
  /** which element types may live here (empty ⇒ any) */
  accepts: ElementType[];
  /** how many elements this slot expects */
  min: number;
  max: number;
  /** the type rung a text element in this slot should use */
  rung?: string;
  /** how many LINES this slot may use before it stops reading as a heading and
   *  starts reading as a paragraph. This is the one genuinely semantic knob —
   *  everything else (the rect, the type size, the resulting budget) is measured.
   *  A callout that wraps to three lines is not a callout any more. */
  lines?: number;
  /** what the slot is FOR — the only prose here, and it is pedagogical, not visual */
  role: string;
};

export type TemplateMeta = {
  /** when to reach for this template — drives selection, not decoration */
  use: string;
  slots: Record<string, SlotMeta>;
};

const TEXT: ElementType[] = ['text'];
const OBJECT: ElementType[] = [
  'image',
  'shape',
  'manipulative',
  'stick',
  'chart',
  'table',
  'list',
  'stat',
];
const ANY: ElementType[] = [];

/**
 * `Record<Template, …>` — this is the auto-discovery mechanism. Add a template
 * to the schema enum and this object fails to typecheck until you describe it.
 * Nobody has to remember to update the prompt; the compiler remembers.
 */
export const SLOT_META: Record<Template, TemplateMeta> = {
  /* ── legacy free-form regions (kept for old docs; do NOT generate into these) */
  'hero-caption': {
    use: 'LEGACY — không sinh mới',
    slots: {
      hero: { accepts: ANY, min: 1, max: 4, role: 'hero' },
      caption: { accepts: TEXT, min: 0, max: 1, rung: 'caption', role: 'caption' },
    },
  },
  split: {
    use: 'LEGACY — không sinh mới',
    slots: {
      left: { accepts: ANY, min: 1, max: 3, role: 'trái' },
      right: { accepts: ANY, min: 1, max: 3, role: 'phải' },
    },
  },
  stack: {
    use: 'LEGACY — không sinh mới',
    slots: {
      top: { accepts: ANY, min: 0, max: 3, role: 'trên' },
      mid: { accepts: ANY, min: 0, max: 3, role: 'giữa' },
      bottom: { accepts: ANY, min: 0, max: 3, role: 'dưới' },
    },
  },
  focus: {
    use: 'LEGACY — không sinh mới',
    slots: { stage: { accepts: ANY, min: 1, max: 4, role: 'toàn khung' } },
  },
  'macro-micro': {
    use: 'LEGACY — không sinh mới',
    slots: {
      macro: { accepts: ANY, min: 1, max: 3, role: 'tổng thể' },
      micro: { accepts: ANY, min: 1, max: 3, role: 'chi tiết' },
    },
  },

  /* ── teaching templates */
  teach: {
    use: 'Giảng MỘT ý bằng một vật thao tác (manipulative) hoặc một hình lớn.',
    slots: {
      title: {
        accepts: TEXT,
        min: 1,
        max: 1,
        rung: 'title',
        lines: 2,
        role: 'Ý đang dạy, nói thành câu ngắn',
      },
      stage: {
        accepts: OBJECT,
        min: 1,
        max: 1,
        rung: undefined,
        role: 'Vật chính học sinh nhìn vào',
      },
      callout: {
        accepts: TEXT,
        min: 0,
        max: 1,
        rung: 'label',
        lines: 1,
        role: 'Kết luận một-hai chữ (VD: CHẴN)',
      },
    },
  },
  practice: {
    use: "Học sinh LÀM. Dùng cho scene kind='gate'.",
    slots: {
      prompt: {
        accepts: TEXT,
        min: 1,
        max: 1,
        rung: 'title',
        lines: 2,
        role: 'Câu lệnh của bài tập',
      },
      activity: { accepts: OBJECT, min: 0, max: 1, role: 'Hoạt động (gate tự dựng)' },
    },
  },
  compare: {
    use: 'Đặt hai thứ cạnh nhau để lộ ra khác biệt.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Câu hỏi so sánh' },
      left: { accepts: OBJECT, min: 1, max: 1, role: 'Vế trái' },
      right: { accepts: OBJECT, min: 1, max: 1, role: 'Vế phải' },
      leftLabel: { accepts: TEXT, min: 0, max: 1, rung: 'label', lines: 1, role: 'Nhãn vế trái' },
      rightLabel: { accepts: TEXT, min: 0, max: 1, rung: 'label', lines: 1, role: 'Nhãn vế phải' },
    },
  },
  rule: {
    use: 'Chốt một quy tắc để nhớ.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tên quy tắc' },
      card: {
        accepts: TEXT,
        min: 1,
        max: 1,
        rung: 'body',
        lines: 2,
        role: 'Nội dung quy tắc — NGẮN, học sinh phải nhớ được',
      },
      support: { accepts: OBJECT, min: 0, max: 1, role: 'Hình minh hoạ nhỏ' },
    },
  },
  sequence: {
    use: 'Các bước theo thứ tự. Mỗi phần tử cần flow.order.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tên quy trình' },
      steps: { accepts: OBJECT, min: 2, max: 5, role: 'Mỗi bước một phần tử, ĐẶT flow.order 1..n' },
    },
  },
  recap: {
    use: 'Tổng kết bài.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề tổng kết' },
      grid: { accepts: OBJECT, min: 2, max: 6, role: 'Các ý đã học' },
    },
  },
  'title-card': {
    use: 'Mở bài.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tên bài' },
      focal: { accepts: OBJECT, min: 0, max: 1, role: 'Một hình duy nhất' },
    },
  },
  flow: {
    use: "Quy trình / cây / vòng lặp → element type='diagram'.",
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tên sơ đồ' },
      diagram: {
        accepts: ['diagram'],
        min: 1,
        max: 1,
        role: 'diagram (engine tự xếp node & cạnh)',
      },
    },
  },
  swimlane: {
    use: 'BPMN — quy trình có nhiều vai.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tên quy trình' },
      laneLabels: { accepts: TEXT, min: 0, max: 4, rung: 'label', role: 'Tên các vai' },
      diagram: { accepts: ['diagram'], min: 1, max: 1, role: 'diagram' },
    },
  },

  /* ── slide templates */
  bullets: {
    use: 'Ý chính dạng gạch đầu dòng. Thêm beat revealAll để build từng dòng theo lời giảng.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề slide' },
      list: { accepts: ['list'], min: 1, max: 1, rung: 'body', role: 'list, 3–5 items' },
    },
  },
  'bullets-media': {
    use: 'Gạch đầu dòng + một hình minh hoạ.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      list: { accepts: ['list'], min: 1, max: 1, rung: 'body', role: 'list, 3–4 items' },
      media: { accepts: ['image', 'manipulative', 'shape'], min: 1, max: 1, role: 'Hình' },
    },
  },
  'two-col': {
    use: 'Hai khối bất kỳ đặt cạnh nhau (VD: biểu đồ đối checklist).',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      colA: { accepts: OBJECT, min: 1, max: 1, role: 'Cột trái' },
      colB: { accepts: OBJECT, min: 1, max: 1, role: 'Cột phải' },
    },
  },
  data: {
    use: 'Trình bày số liệu. Engine TỰ vẽ cột/quạt từ series — KHÔNG được tự tính chiều cao cột.',
    slots: {
      title: {
        accepts: TEXT,
        min: 1,
        max: 1,
        rung: 'title',
        lines: 2,
        role: 'Câu hỏi mà dữ liệu trả lời',
      },
      chart: { accepts: ['chart'], min: 1, max: 1, role: 'chart, 2–6 điểm dữ liệu' },
      insight: {
        accepts: TEXT,
        min: 0,
        max: 1,
        rung: 'body',
        lines: 3,
        role: 'Điều rút ra — nói ý NGHĨA, đừng đọc lại số',
      },
    },
  },
  stats: {
    use: '2–4 con số đáng nhớ.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      stats: { accepts: ['stat'], min: 2, max: 4, role: 'Mỗi ô một stat, ĐẶT flow.order' },
    },
  },
  quote: {
    use: 'Một câu đáng nhớ. KHÔNG có tiêu đề — câu nói LÀ tiêu đề.',
    slots: {
      quote: { accepts: ['quote'], min: 1, max: 1, rung: 'title', role: 'quote (text + by)' },
    },
  },
  table: {
    use: 'So sánh nhiều thứ theo nhiều chiều.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      table: { accepts: ['table'], min: 1, max: 1, role: 'table, ≤4 cột × ≤5 hàng' },
    },
  },
  'image-grid': {
    use: 'Nhiều hình cùng loại để đếm/nhóm/đối chiếu.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      grid: {
        accepts: ['image', 'manipulative', 'shape'],
        min: 2,
        max: 6,
        role: 'Các hình, ĐẶT flow.order',
      },
    },
  },
  definition: {
    use: 'Định nghĩa một thuật ngữ.',
    slots: {
      term: { accepts: TEXT, min: 1, max: 1, rung: 'huge', lines: 1, role: 'Thuật ngữ (1–3 chữ)' },
      meaning: {
        accepts: TEXT,
        min: 1,
        max: 1,
        rung: 'body',
        lines: 3,
        role: 'Nghĩa, bằng lời của học sinh',
      },
      example: { accepts: TEXT, min: 0, max: 1, rung: 'body', lines: 2, role: 'Ví dụ cụ thể' },
    },
  },
  'worked-example': {
    use: 'Bài mẫu: đề → các bước → đáp án. Hình dạng chuẩn của một bài toán.',
    slots: {
      title: { accepts: TEXT, min: 1, max: 1, rung: 'title', lines: 2, role: 'Tiêu đề' },
      problem: { accepts: TEXT, min: 1, max: 1, rung: 'body', lines: 2, role: 'Đề bài' },
      steps: {
        accepts: ['list'],
        min: 1,
        max: 1,
        rung: 'body',
        role: "list style='number', 2–4 bước",
      },
      answer: { accepts: ['stat', 'text'], min: 1, max: 1, role: 'Đáp án' },
    },
  },
  section: {
    use: 'Vách ngăn giữa các phần của bài.',
    slots: {
      kicker: {
        accepts: TEXT,
        min: 0,
        max: 1,
        rung: 'label',
        lines: 1,
        role: 'Nhãn phần (VD: PHẦN 2)',
      },
      title: { accepts: TEXT, min: 1, max: 1, rung: 'huge', lines: 2, role: 'Tên phần' },
    },
  },
};

/* ───────────────────────────────── the derived, machine-readable catalog ──── */

export type SlotContract = SlotMeta & {
  name: string;
  /** MEASURED from resolveLayout — the tighter of the two aspects, because the
   *  text must fit BOTH. A budget that only holds at 16:9 is not a budget. */
  maxChars?: number;
};

export type TemplateContract = {
  template: Template;
  use: string;
  slots: SlotContract[];
};

/** A probe scene: one dummy element per slot, so resolveLayout hands back the
 *  slot's real rect at each aspect. We MEASURE the layout instead of restating
 *  its numbers — restated numbers are the thing that goes stale. */
function measure(
  template: Template,
  slots: Record<string, SlotMeta>,
): Record<string, Record<Aspect, { w: number; h: number }>> {
  const scene: Scene = {
    id: '_probe',
    kind: 'exposition',
    layout: { template, regions: {} },
    elements: Object.keys(slots).map((name) => ({
      id: name,
      type: 'text' as const,
      region: name,
      content: { text: '' },
    })),
  };
  const out: Record<string, Record<Aspect, { w: number; h: number }>> = {};
  for (const aspect of ['16:9', '9:16'] as Aspect[]) {
    const { rects } = resolveLayout(scene, aspect);
    for (const name of Object.keys(slots)) {
      const r = rects.get(name);
      if (!r) continue;
      out[name] ??= {} as Record<Aspect, { w: number; h: number }>;
      out[name]![aspect] = { w: r.w, h: r.h };
    }
  }
  return out;
}

let CACHE: TemplateContract[] | null = null;

/** The contract for every template a generator may produce into. */
export function templateCatalog(): TemplateContract[] {
  if (CACHE) return CACHE;
  CACHE = TEMPLATES.filter((t) => !SLOT_META[t].use.startsWith('LEGACY')).map((template) => {
    const meta = SLOT_META[template];
    const rects = measure(template, meta.slots);
    return {
      template,
      use: meta.use,
      slots: Object.entries(meta.slots).map(([name, sm]) => {
        const contract: SlotContract = { ...sm, name };
        const r = rects[name];
        if (r && sm.accepts.includes('text')) {
          // the text must fit BOTH aspects → take the tighter budget
          const budgets = (['16:9', '9:16'] as Aspect[]).map((a) =>
            r[a] ? charBudget(r[a]!, sm.rung, a, sm.lines ?? 2) : Infinity,
          );
          const b = Math.min(...budgets);
          if (Number.isFinite(b)) contract.maxChars = b;
        }
        return contract;
      }),
    };
  });
  return CACHE;
}

export function contractOf(template: Template): TemplateContract | undefined {
  return templateCatalog().find((t) => t.template === template);
}
