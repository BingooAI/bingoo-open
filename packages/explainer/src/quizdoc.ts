/**
 * quizdoc.ts — the SHAPE of every question type, derived from core's zod schemas.
 *
 * The authoring brief used to list the 55 question types as bare names:
 *
 *     single · multiple · boolean · fill · order · match · numeric · venn · …
 *
 * A model cannot generate a `venn` question from the word "venn". It does not
 * know a venn takes `regions` and `items` and an `assignment`, or that a
 * `numberline` needs `min`, `max`, `step` and `answer`. So it wrote the one type
 * it could guess — `single` — over and over, and the other 54 might as well not
 * have existed. Listing a capability is not the same as making it usable.
 *
 * Every field in core already carries a `.describe()`, written by whoever built
 * it. This walks the union and lifts them out, so the brief documents each type
 * FROM THE SCHEMA THE GRADER USES. A field renamed in core changes this text.
 *
 * Grading needs no annotation here: @bingoo/authored-item's registry marks EVERY
 * member of this union `measurable` with `graderKind: "auto-key"` — the whole
 * union is graded by core's `gradeQuestion`, and @bingoo/ui-web's <QuizShell>
 * renders all 55 (verified: 55/55). So the only thing that was ever missing was
 * telling the model what each one LOOKS LIKE.
 */
import { QuizQuestion } from '@bingoo/core';

/** Fields shared by every question — documented once, not 55 times. */
const BASE_FIELDS = new Set([
  'id',
  'prompt',
  'media',
  'points',
  'hints',
  'guide',
  'instruction',
  'teach',
  'explanation',
  'tags',
]);

type Field = { name: string; type: string; optional: boolean; desc?: string };
export type QuizDoc = { type: string; fields: Field[] };

/* zod v4 internals — introspection only, never validation. */
type ZodLike = {
  _zod?: {
    def?: {
      type?: string;
      innerType?: ZodLike;
      element?: ZodLike;
      shape?: Record<string, ZodLike>;
      values?: unknown[];
      entries?: Record<string, unknown>;
    };
  };
  description?: string;
  def?: { type?: string; innerType?: ZodLike; element?: ZodLike; shape?: Record<string, ZodLike> };
};

const defOf = (z: ZodLike) => z._zod?.def ?? z.def ?? {};

/** A compact, human-readable type string for one field. */
function typeStr(z: ZodLike, depth = 0): string {
  if (depth > 3) return '…';
  const d = defOf(z) as {
    type?: string;
    innerType?: ZodLike;
    element?: ZodLike;
    shape?: Record<string, ZodLike>;
    values?: unknown[];
  };
  switch (d.type) {
    case 'optional':
    case 'nullable':
    case 'default':
      return d.innerType ? typeStr(d.innerType, depth) : 'any';
    case 'array':
      return d.element ? `${typeStr(d.element, depth + 1)}[]` : 'any[]';
    case 'object': {
      const keys = Object.keys(d.shape ?? {});
      return keys.length ? `{${keys.join(',')}}` : '{}';
    }
    case 'literal':
      return d.values?.length ? JSON.stringify(d.values[0]) : 'literal';
    case 'enum': {
      const vals = Object.keys((d as { entries?: Record<string, unknown> }).entries ?? {});
      return vals.length ? vals.join('|') : 'enum';
    }
    case 'record':
      return '{ [id]: value }';
    case 'union':
      return 'union';
    default:
      return d.type ?? 'any';
  }
}

const isOptional = (z: ZodLike) => {
  const t = (defOf(z) as { type?: string }).type;
  return t === 'optional' || t === 'default' || t === 'nullable';
};

let CACHE: QuizDoc[] | null = null;

/** Every question type with the fields it actually requires. */
export function quizDocs(): QuizDoc[] {
  if (CACHE) return CACHE;
  // QuizQuestion is a superRefine wrapper; the union sits inside it.
  const eff = QuizQuestion as unknown as {
    _def?: { schema?: unknown };
    def?: { schema?: unknown };
  };
  const inner = (eff._def?.schema ?? eff.def?.schema ?? QuizQuestion) as { options?: unknown[] };
  const options = (inner.options ?? []) as { shape?: Record<string, ZodLike> }[];

  CACHE = options.map((opt) => {
    const shape = opt.shape ?? {};
    const type = String(
      (defOf(shape.type as ZodLike) as { values?: unknown[] }).values?.[0] ?? '?',
    );
    const fields: Field[] = Object.entries(shape)
      .filter(([k]) => k !== 'type' && !BASE_FIELDS.has(k))
      .map(([name, z]) => ({
        name,
        type: typeStr(z),
        optional: isOptional(z),
        ...(z.description ? { desc: z.description } : {}),
      }));
    return { type, fields };
  });
  return CACHE;
}

/** The question-type reference for the authoring brief. GENERATED. */
/** The types worth documenting in FULL for a compact brief — the rest are named. */
const COMMON_QUIZ = [
  'single',
  'multiple',
  'boolean',
  'order',
  'match',
  'categorize',
  'numberline',
  'fill',
];

export function quizGuide(brief = false): string {
  const docs = quizDocs();
  const shown = brief ? docs.filter((d) => COMMON_QUIZ.includes(d.type)) : docs;
  const lines: string[] = [];
  lines.push(
    `${docs.length} loại câu hỏi, tất cả chấm được bằng code (\`gradeQuestion\`). Mỗi câu cần \`id\` và nên có \`prompt\`; ` +
      `các trường riêng của từng loại ở dưới (dấu \`?\` = không bắt buộc).`,
  );
  lines.push('');
  for (const d of shown) {
    const fields = d.fields
      .map((f) => `\`${f.name}${f.optional ? '?' : ''}\`: ${f.type}${f.desc ? ` — ${f.desc}` : ''}`)
      .join('\n  - ');
    lines.push(`- **\`${d.type}\`**`);
    if (fields) lines.push(`  - ${fields}`);
  }
  if (brief) {
    const rest = docs.filter((d) => !COMMON_QUIZ.includes(d.type)).map((d) => `\`${d.type}\``);
    lines.push('', `Loại khác (shape đầy đủ trong file reference): ${rest.join(' · ')}.`);
  }
  return lines.join('\n');
}
