// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Quiz engine — the shared, platform-agnostic core of the learning interaction
 * layer (§R2: no `next/*`, no `react-native`, no UI). Both `@bingoo.ai/ui-web` and
 * `@bingoo.ai/ui-web` renders on top of this, so grading, scoring and session
 * flow behave IDENTICALLY on web and mobile — a single source of truth.
 *
 * Content (prompts, choice labels, hints…) is DATA supplied by the caller, never
 * hardcoded — the UI stays i18n-free (§R4) and this stays free of copy.
 *
 * Six question types cover preschool → K12 → university → working adults:
 *   single · multiple · boolean · fill · order · match.
 */

import { z } from 'zod'
import { getNet } from './nets'
import { LocalizedString } from './localized'
import { MediaResource, Stem } from './stem'
import { SOLID_NAMES } from './solid3d'
import type { DrawStroke } from './draw'
import { makeSolid, solidPartIds, type Solid3DName, type SolidPartKind } from './solid3d'
import { clamp } from './utils'

/* --------------------------------- Content -------------------------------- */
/* Zod schemas are the CONTRACT: types (`z.infer`), a JSON Schema for LLM
 * structured-output (`quizJsonSchema()`), and a validator (`safeParseQuiz`) all
 * come from one place, so LLM-authored quizzes match the components exactly. */

/**
 * Media attached to a question or choice. `assetId` references the shared media
 * library (@bingoo.ai/db MediaAsset — moderated, permissioned); the server resolves
 * it to a delivery `src` before render. A direct `src` is allowed for external
 * content. At least one of the two must be present.
 */
/** A question's attached media — image, audio, or video. Shared with content via stem.ts. */
export const QuizMedia = MediaResource
export type QuizMedia = MediaResource

/**
 * A piece of learner support (hint / guide / instruction / teach): display text
 * and/or spoken audio. UI shows the text when present and offers a play button
 * when audio is present — young learners can listen instead of reading.
 */
export const Assist = z
  .object({
    text: z.string().optional().describe('Display text of this support.'),
    audioAssetId: z.string().optional().describe('Media-library audio asset id (preferred).'),
    audioSrc: z.string().url().optional().describe('Resolved/external audio URL.'),
  })
  .superRefine((a, ctx) => {
    if (!a.text && !a.audioAssetId && !a.audioSrc)
      ctx.addIssue({
        code: 'custom',
        message: 'assist needs text and/or audio (audioAssetId or audioSrc)',
      })
  })

/** A selectable item (choice / order item / match cell). `label` is display data. */
export const QuizItem = z
  .object({
    id: z.string().min(1),
    label: LocalizedString.optional().describe(
      'Text for this choice/item (a plain string, or a per-locale map {en,vi,…}). Optional — a choice may be a picture or a sound only.',
    ),
    emoji: z
      .string()
      .optional()
      .describe('Optional emoji/glyph rendered large — picture choices without assets (preschool).'),
    image: z.string().url().optional().describe('Optional resolved image URL for picture choices.'),
    imageAssetId: z.string().optional().describe('Optional media-library asset id for the picture.'),
    audio: MediaResource.optional().describe(
      'Optional sound for this choice — a word to hear, an audio to match. A choice can be text, picture, audio, or any combination.',
    ),
  })
  .superRefine((it, ctx) => {
    if (!it.label && !it.emoji && !it.image && !it.imageAssetId && !it.audio)
      ctx.addIssue({
        code: 'custom',
        message: 'a choice needs at least one of: label, emoji, image, imageAssetId, audio',
      })
  })

/** One text segment of a fill-in-the-blank prompt: literal text or a blank. */
export const FillSegment = z.union([
  z.object({ text: z.string().describe('A literal run of prompt text.') }),
  z.object({ blank: z.literal(true).describe('A blank the learner fills in.') }),
])

const questionBase = {
  id: z.string().min(1).describe('Unique id for this question (author-assigned).'),
  prompt: LocalizedString.optional().describe(
    'Optional question prompt / stem (a plain string, or a per-locale map {en,vi,…}).',
  ),
  media: QuizMedia.optional().describe(
    'Optional single image/audio/video shown above the prompt (simple picture/listening questions).',
  ),
  body: Stem.optional().describe(
    'Rich question body — text, images, audio and video in order. Use for anything richer than a one-line prompt (e.g. listen-and-choose). Works on EVERY question type.',
  ),
  points: z.number().int().positive().optional().describe('Score weight for this question (default 1).'),
  // Pedagogical support layers — each is text and/or audio (see Assist):
  hints: z.array(Assist).optional().describe('Progressive hints, revealed one at a time on request.'),
  guide: Assist.optional().describe('Short how-to for this question type (always visible).'),
  instruction: Assist.optional().describe('Detailed step-by-step instructions (always visible, secondary).'),
  teach: Assist.optional().describe('Concept teaching shown with the explanation after checking.'),
  explanation: LocalizedString.optional().describe(
    'Why the answer is right/wrong, shown after checking (a plain string, or a per-locale map {en,vi,…}).',
  ),
}

/** Pick exactly one correct choice. */
export const SingleChoiceQuestion = z
  .object({
    ...questionBase,
    type: z.literal('single'),
    choices: z.array(QuizItem).min(2).describe('The answer choices (2 or more).'),
    answerId: z.string().min(1).describe('id of the one correct choice — must be one of choices[].id.'),
  })
  .describe('Pick exactly ONE correct choice from a list.')

/** Pick every correct choice (partial credit). */
export const MultipleChoiceQuestion = z
  .object({
    ...questionBase,
    type: z.literal('multiple'),
    choices: z
      .array(QuizItem)
      .min(2)
      .describe('The answer choices (2 or more). The correct ones are named in answerIds.'),
    answerIds: z
      .array(z.string())
      .min(1)
      .describe('ids of ALL correct choices — each must exist in choices[].id.'),
  })
  .describe('Pick ALL the correct choices — one or more — from a list.')

/** True / false. `trueLabel`/`falseLabel` are data so the UI needs no copy. */
export const BooleanQuestion = z
  .object({
    ...questionBase,
    type: z.literal('boolean'),
    answer: z.boolean().describe('Whether the statement is true.'),
    trueLabel: z.string().min(1).describe('Localized label for the "true" option.'),
    falseLabel: z.string().min(1).describe('Localized label for the "false" option.'),
  })
  .describe('Decide whether a statement is true or false.')

/** Fill in one or more blanks. `answers[i]` = accepted variants for blank i. */
export const FillBlankQuestion = z
  .object({
    ...questionBase,
    type: z.literal('fill'),
    segments: z.array(FillSegment).min(1).describe('Prompt as interleaved text + blanks.'),
    answers: z
      .array(z.array(z.string().min(1)).min(1))
      .min(1)
      .describe(
        'Accepted answers per blank; answers[i] = variants for blank i (case-insensitive). Must have EXACTLY one entry per blank segment, in order.',
      ),
  })
  .describe('Type the missing word(s) into blanks in a sentence.')

/** Put the items in the correct sequence (partial credit by position). */
export const OrderQuestion = z
  .object({
    ...questionBase,
    type: z.literal('order'),
    items: z.array(QuizItem).min(2).describe('Items in a stable presentation order.'),
    correctOrder: z
      .array(z.string())
      .min(2)
      .describe('The correct sequence — a permutation of items[].id (same ids, each exactly once).'),
  })
  .describe('Drag items into the correct sequence.')

/** Match each left item to its right item (partial credit by pair). */
export const MatchQuestion = z
  .object({
    ...questionBase,
    type: z.literal('match'),
    left: z.array(QuizItem).min(1).describe('Left-column items to match from.'),
    right: z.array(QuizItem).min(1).describe('Right-column items — the partners for the left column.'),
    pairs: z
      .record(z.string(), z.string())
      .describe(
        'Correct pairing: leftId → rightId. Every left id appears exactly once as a key; every value must be a right id.',
      ),
  })
  .describe('Join each item on the left to its partner on the right.')

/** Enter a number (math). Accepts an absolute tolerance around the answer. */
export const NumericQuestion = z
  .object({
    ...questionBase,
    type: z.literal('numeric'),
    answer: z.number().describe('The correct numeric value.'),
    tolerance: z
      .number()
      .nonnegative()
      .optional()
      .describe('Accepted absolute deviation from answer (default 0 = exact).'),
    unitLabel: z.string().optional().describe('Unit shown next to the input, e.g. "cm".'),
    placeholder: z.string().optional().describe('Input placeholder.'),
  })
  .describe('Type a number; graded against an exact value or a range.')

/** Build the answer from a token bank (Duolingo-style sentence builder). */
export const WordBankQuestion = z
  .object({
    ...questionBase,
    type: z.literal('wordbank'),
    bank: z
      .array(z.string().min(1))
      .min(2)
      .describe('The tappable word/token bank, INCLUDING distractors, in display order.'),
    answer: z
      .array(z.string().min(1))
      .min(1)
      .describe('The correct token sequence. Every token must be available in bank (respecting duplicates).'),
  })
  .describe('Fill the blanks by choosing words from a fixed word bank.')

/** Sort items into categories (buckets). */
export const CategorizeQuestion = z
  .object({
    ...questionBase,
    type: z.literal('categorize'),
    categories: z.array(QuizItem).min(2).describe('The buckets (2 or more).'),
    items: z.array(QuizItem).min(2).describe('The items to sort.'),
    assignment: z
      .record(z.string(), z.string())
      .describe(
        'Correct mapping: itemId → categoryId. Every item id appears exactly once as a key; values must be category ids.',
      ),
  })
  .describe('Sort items into named groups or buckets.')

/** Tap the correct words/phrases inside a passage. */
export const HighlightQuestion = z
  .object({
    ...questionBase,
    type: z.literal('highlight'),
    tokens: z
      .array(z.string().min(1))
      .min(2)
      .describe('The passage split into tappable tokens (words or short phrases), in reading order.'),
    correctIndexes: z
      .array(z.number().int().nonnegative())
      .min(1)
      .describe('0-based indexes of the tokens that must be selected. Unique, each < tokens.length.'),
  })
  .describe('Tap words or spans in a passage to mark the ones that fit.')

/** Mark a value on a 0–max number line (counting, add/subtract). */
export const NumberLineQuestion = z
  .object({
    ...questionBase,
    type: z.literal('numberline'),
    min: z.number().int().describe('Left end of the line.'),
    max: z.number().int().describe('Right end of the line (must be > min).'),
    step: z.number().positive().default(1).describe('Tick interval; the marker snaps to it.'),
    answer: z.number().describe('The value to mark (must be between min and max, on a step).'),
  })
  .describe('Mark a value at the right position on a number line.')

/** Read/set an analog clock. Stage 1 uses o'clock + half past. */
export const ClockQuestion = z
  .object({
    ...questionBase,
    type: z.literal('clock'),
    answerHour: z.number().int().min(1).max(12).describe('Correct hour, 1–12.'),
    answerMinute: z.number().int().min(0).max(59).describe('Correct minute (Stage 1: 0 or 30).'),
    minuteOptions: z
      .array(z.number().int().min(0).max(59))
      .min(2)
      .optional()
      .describe('Minute choices to offer the learner (default [0, 15, 30, 45]).'),
  })
  .describe('Set the hands of an analogue clock to a given time.')

export const VennRegion = z.enum(['a', 'b', 'both', 'neither'])

/** Sort items into a two-set Venn diagram (a-only / overlap / b-only / outside). */
export const VennQuestion = z
  .object({
    ...questionBase,
    type: z.literal('venn'),
    labelA: z.string().min(1).describe('Label of circle A.'),
    labelB: z.string().min(1).describe('Label of circle B.'),
    items: z.array(QuizItem).min(2).describe('The items to place.'),
    assignment: z
      .record(z.string(), VennRegion)
      .describe(
        'Correct region per item id: "a" (A only), "b" (B only), "both" (overlap), "neither" (outside). Every item id appears exactly once.',
      ),
  })
  .describe('Place items into the correct regions of a two-circle Venn diagram.')

/** One cell of a fill-in table: a fixed value, or a blank the learner fills. */
export const TableCell = z.object({
  text: z.string().optional().describe('Fixed cell text (a value shown to the learner).'),
  blankId: z.string().optional().describe('If set, this cell is a blank; its unique id.'),
  answers: z.array(z.string()).optional().describe('Accepted answers for this blank (case-insensitive).'),
})

/** Complete a data table by filling the blank cells. */
export const TableFillQuestion = z
  .object({
    ...questionBase,
    type: z.literal('tablefill'),
    columns: z.array(z.string()).min(1).describe('Column header labels.'),
    rows: z
      .array(
        z.object({
          header: z.string().optional().describe('Optional row header label.'),
          cells: z.array(TableCell).describe('Cells left→right; length should equal columns.'),
        }),
      )
      .min(1)
      .describe('Table rows; a cell left as an empty string is a blank to fill in.'),
  })
  .describe('Fill in the missing cells of a table.')

/** Show a quantity on ten-frames by filling counters. */
export const TenFrameQuestion = z
  .object({
    ...questionBase,
    type: z.literal('tenframe'),
    frames: z
      .union([z.literal(1), z.literal(2)])
      .default(1)
      .describe('Number of ten-frames (1 → 0–10, 2 → 0–20).'),
    answer: z.number().int().nonnegative().describe('The count to represent (0 … 10·frames).'),
  })
  .describe('Fill a ten-frame with counters to show a number.')

/** Fill the missing value in a part-whole (bar model) diagram. */
export const PartWholeQuestion = z
  .object({
    ...questionBase,
    type: z.literal('partwhole'),
    whole: z.number().nullable().describe('The whole, or null if it is the blank.'),
    parts: z
      .array(z.number().nullable())
      .min(2)
      .describe('The parts; exactly one value across whole+parts is null (the blank).'),
    answer: z.number().describe('The value of the blank.'),
  })
  .describe('Complete a part-whole (bar) model of a number.')

/** Build a number from tens and ones (place value). */
export const PlaceValueQuestion = z
  .object({
    ...questionBase,
    type: z.literal('placevalue'),
    answer: z.number().int().min(0).max(99).describe('The two-digit number to build (0–99).'),
  })
  .describe('Build a number from its place-value columns (ones, tens, ...).')

/** Continue a repeating pattern by filling the trailing blanks. */
export const PatternQuestion = z
  .object({
    ...questionBase,
    type: z.literal('pattern'),
    sequence: z.array(QuizItem).min(2).describe('The shown lead-in of the pattern (left → right).'),
    blanks: z.number().int().positive().describe('How many trailing slots the learner fills.'),
    palette: z.array(QuizItem).min(2).describe('The tappable choices to fill blanks with.'),
    answer: z.array(z.string()).min(1).describe('Correct palette item id per blank, in order.'),
  })
  .describe('Continue or complete a repeating or growing pattern.')

/** A point on a diagram/scene (0–100 coordinates), optionally shown as an emoji. */
export const DiagramHotspot = z.object({
  id: z.string().min(1),
  x: z.number().min(0).max(100).describe('Horizontal position, 0–100 (% of the figure width).'),
  y: z.number().min(0).max(100).describe('Vertical position, 0–100 (% of the figure height).'),
  emoji: z
    .string()
    .optional()
    .describe('Optional emoji rendered at this spot (builds a scene without an image).'),
  label: z.string().optional().describe('Accessible name of this spot.'),
})

/** Drag labels onto the correct parts of a figure (label a diagram). */
export const LabelQuestion = z
  .object({
    ...questionBase,
    type: z.literal('label'),
    imageAssetId: z.string().optional().describe('Media-library image asset id for the figure (preferred).'),
    imageSrc: z.string().url().optional().describe('Resolved/external figure image URL.'),
    hotspots: z.array(DiagramHotspot).min(2).describe('The points on the figure to label.'),
    labels: z.array(QuizItem).min(2).describe('The labels to place onto hotspots.'),
    answer: z
      .record(z.string(), z.string())
      .describe('Correct labelId → hotspotId. Every label appears exactly once; each value is a hotspot id.'),
  })
  .describe('Drag labels onto the right parts of a diagram.')

/** Tap the correct spots in a scene ("find all the …"; also listen-and-point with media). */
export const HotspotFindQuestion = z
  .object({
    ...questionBase,
    type: z.literal('hotspot'),
    imageAssetId: z.string().optional().describe('Media-library image asset id for the scene.'),
    imageSrc: z.string().url().optional().describe('Resolved/external scene image URL.'),
    hotspots: z.array(DiagramHotspot).min(2).describe('The tappable spots in the scene.'),
    correctIds: z.array(z.string()).min(1).describe('Hotspot ids that should be selected.'),
  })
  .describe('Tap the correct region(s) of an image.')

/** Draw arrows between points: force diagrams, matching direction, number-line jumps. */
export const ArrowQuestion = z
  .object({
    ...questionBase,
    type: z.literal('arrow'),
    imageAssetId: z.string().optional().describe('Media-library image asset id for the figure.'),
    imageSrc: z.string().url().optional().describe('Resolved/external figure image URL.'),
    nodes: z.array(DiagramHotspot).min(2).describe('The points arrows connect (id + x/y as 0–100 %).'),
    directed: z
      .boolean()
      .default(true)
      .describe('Arrows have a direction (from→to). false = plain undirected connectors.'),
    answer: z
      .array(z.object({ from: z.string(), to: z.string() }))
      .min(1)
      .describe('Correct arrows; each { from, to } is a pair of node ids.'),
  })
  .describe('Drag arrows to connect points (mappings, directions).')

/** Find a word in a letter grid as a straight line (8 directions). Returns the
 *  cells it occupies, or null. Shared by validation + the WordSearch component. */
export type GridCell = { r: number; c: number }
export function solveWordSearch(rows: string[], word: string): GridCell[] | null {
  const R = rows.length
  const C = rows[0]?.length ?? 0
  const W = word.toUpperCase()
  const grid = rows.map((row) => row.toUpperCase())
  const DIRS: Array<[number, number]> = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ]
  for (let r = 0; r < R; r++)
    for (let c = 0; c < C; c++)
      for (const [dr, dc] of DIRS) {
        const cells: GridCell[] = []
        let ok = true
        for (let k = 0; k < W.length; k++) {
          const rr = r + dr * k
          const cc = c + dc * k
          if (rr < 0 || rr >= R || cc < 0 || cc >= C || grid[rr]?.[cc] !== W[k]) {
            ok = false
            break
          }
          cells.push({ r: rr, c: cc })
        }
        if (ok) return cells
      }
  return null
}

/** Find words in a grid: tap the start + end of each hidden word (straight line, any direction). */
export const WordSearchQuestion = z
  .object({
    ...questionBase,
    type: z.literal('wordsearch'),
    rows: z
      .array(z.string().min(1))
      .min(2)
      .describe('Grid rows; each row is a string of letters, all the same length.'),
    words: z
      .array(z.string().min(2))
      .min(1)
      .describe('Words hidden in the grid (any straight line, forward or backward).'),
  })
  .describe('Find and select hidden words in a letter grid.')

/** Shade the correct fraction of a divided whole (numerator / parts). */
export const FractionQuestion = z
  .object({
    ...questionBase,
    type: z.literal('fraction'),
    parts: z
      .number()
      .int()
      .min(2)
      .max(12)
      .describe('Number of equal parts the whole is divided into (the denominator).'),
    answer: z.number().int().min(0).describe('How many parts should be shaded (the numerator).'),
    shape: z.enum(['bar', 'circle']).default('bar').describe('Render as a divided bar or a pie.'),
  })
  .describe('Shade parts of a bar or circle to show a fraction.')

/** Carroll diagram — classify items by two criteria (rows × columns) into cells. */
export const CarrollQuestion = z
  .object({
    ...questionBase,
    type: z.literal('carroll'),
    rows: z.array(z.string()).min(2).describe('Row headers (criterion 1, e.g. "Has 4 legs" / "No 4 legs").'),
    cols: z.array(z.string()).min(2).describe('Column headers (criterion 2).'),
    items: z.array(QuizItem).min(1).describe('The items to classify.'),
    answer: z
      .record(z.string(), z.string())
      .describe('Correct itemId → cell "row-col" (0-indexed, e.g. "0-1").'),
  })
  .describe('Place items into the cells of a two-way Carroll diagram.')

/** Greatest common divisor — used to sanity-check money reachability. */
function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

/** A coin or note the learner can tap to add to the tray. */
export const MoneyItem = z.object({
  id: z.string().min(1),
  value: z.number().int().positive().describe('The coin/note value.'),
  label: z.string().optional(),
  emoji: z.string().optional(),
})

/** Supported currencies. VND values are whole đồng; USD/GBP values are in the
 *  minor unit (cents / pence), so $2.50 = 250 and 5p = 5. */
export const Currency = z.enum(['VND', 'USD', 'GBP'])

/** Count money — tap coins/notes to reach a target amount. */
export const MoneyQuestion = z
  .object({
    ...questionBase,
    type: z.literal('money'),
    denominations: z.array(MoneyItem).min(2).describe('Coins/notes the learner can add (repeats allowed).'),
    target: z.number().int().positive().describe('The total amount to make (same unit as values).'),
    currency: Currency.default('VND').describe('Currency: VND (đồng), USD (cents), or GBP (pence).'),
  })
  .describe('Make a target amount by choosing coins and notes.')

/** Format a money amount for display, per-currency (symbol, placement, separators,
 *  minor units). VND: "5.000 ₫". USD: "$2.50". GBP: "£1.20". Shared web + native. */
export function formatMoney(value: number, currency: CurrencyCode = 'VND'): string {
  const groupWith = (digits: string, sep: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
  if (currency === 'VND') return `${groupWith(Math.round(value).toString(), '.')} ₫`
  const sym = currency === 'USD' ? '$' : '£'
  const major = (value / 100).toFixed(2)
  const dot = major.indexOf('.')
  const int = major.slice(0, dot)
  const dec = major.slice(dot + 1)
  return `${sym}${groupWith(int, ',')}.${dec}`
}

/** Balance scale — compare two quantities: less than, equal, or greater than. */
export const BalanceQuestion = z
  .object({
    ...questionBase,
    type: z.literal('balance'),
    left: z.number().describe('Quantity/weight on the left pan.'),
    right: z.number().describe('Quantity/weight on the right pan.'),
    leftLabel: z.string().optional().describe('Label under the left pan.'),
    rightLabel: z.string().optional().describe('Label under the right pan.'),
    leftEmoji: z.string().optional().describe('Emoji repeated `left` times to picture the left pan.'),
    rightEmoji: z.string().optional().describe('Emoji shown on the right pan.'),
    answer: z.enum(['lt', 'eq', 'gt']).describe('left vs right: lt (<), eq (=), gt (>).'),
  })
  .describe('Compare two quantities with <, = or > on a balance.')

/** Build a bar chart — set each bar's height to match the data. */
export const BarChartQuestion = z
  .object({
    ...questionBase,
    type: z.literal('barchart'),
    categories: z.array(QuizItem).min(1).describe('The bars (id + label + optional emoji).'),
    maxValue: z.number().int().min(1).max(20).describe('Tallest value the axis allows.'),
    unitLabel: z.string().optional().describe('Axis unit, e.g. "students".'),
    answer: z.record(z.string(), z.number().int().min(0)).describe('Correct catId → bar height.'),
  })
  .describe('Build a bar chart to the given heights.')

/** Measure with a ruler — read where an object ends on the scale. */
export const RulerQuestion = z
  .object({
    ...questionBase,
    type: z.literal('ruler'),
    max: z.number().int().min(2).max(30).describe('Ruler length (number of units).'),
    start: z.number().int().min(0).default(0).describe('Where the object starts on the ruler.'),
    length: z.number().int().min(1).describe('The object length (units); the end tick is start + length.'),
    unitLabel: z.string().optional().describe('Unit, e.g. "cm".'),
  })
  .describe('Read or set a length against a ruler.')

/** Mirror a "row-col" cell across the axis of an rows×cols grid.
 *  'diagonal' mirrors across the main diagonal (r,c) → (c,r) — square grids only. */
export function mirrorCell(
  key: string,
  rows: number,
  cols: number,
  axis: 'vertical' | 'horizontal' | 'diagonal',
): string {
  const seg = key.split('-')
  const r = Number(seg[0])
  const c = Number(seg[1])
  if (axis === 'vertical') return `${r}-${cols - 1 - c}`
  if (axis === 'horizontal') return `${rows - 1 - r}-${c}`
  return `${c}-${r}`
}

/** Is a set of cells symmetric across the axis (every cell's mirror is present)? */
export function isSymmetricSet(
  cells: string[],
  rows: number,
  cols: number,
  axis: 'vertical' | 'horizontal' | 'diagonal',
): boolean {
  const set = new Set(cells)
  for (const k of set) if (!set.has(mirrorCell(k, rows, cols, axis))) return false
  return true
}

/** The cells a learner must add to make `filled` symmetric (mirror minus givens). */
export function symmetryExpected(q: {
  rows: number
  cols: number
  filled: string[]
  axis: 'vertical' | 'horizontal' | 'diagonal'
}): string[] {
  const given = new Set(q.filled)
  const out = new Set<string>()
  for (const key of q.filled) {
    const m = mirrorCell(key, q.rows, q.cols, q.axis)
    if (!given.has(m)) out.add(m)
  }
  return [...out]
}

/** Complete a symmetric figure — mirror the given cells across an axis. */
export const SymmetryQuestion = z
  .object({
    ...questionBase,
    type: z.literal('symmetry'),
    rows: z.number().int().min(2).max(8).describe('Grid rows.'),
    cols: z.number().int().min(2).max(8).describe('Grid columns.'),
    axis: z
      .enum(['vertical', 'horizontal', 'diagonal'])
      .default('vertical')
      .describe('Mirror line. "diagonal" needs a square grid.'),
    mode: z
      .enum(['mirror', 'design'])
      .default('mirror')
      .describe(
        'mirror = complete the given half. design = shade cellCount cells to make ANY symmetric pattern.',
      ),
    cellCount: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('design mode: exactly how many cells the finished pattern must have.'),
    filled: z
      .array(z.string())
      .default([])
      .describe('Pre-filled cells "row-col" (the given half; may be empty in design mode).'),
  })
  .describe('Complete a shape or pattern so it is symmetrical.')

/** Number of shaded cells (the area, in grid squares). */
export function gridArea(cells: string[]): number {
  return new Set(cells).size
}

/** Perimeter of a shaded region — every cell edge not shared with another cell. */
export function gridPerimeter(cells: string[]): number {
  const set = new Set(cells)
  let p = 0
  for (const k of set) {
    const seg = k.split('-')
    const r = Number(seg[0])
    const c = Number(seg[1])
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as Array<[number, number]>)
      if (!set.has(`${r + dr}-${c + dc}`)) p++
  }
  return p
}

/** Are all shaded cells orthogonally connected (one piece)? */
export function isContiguous(cells: string[]): boolean {
  const set = new Set(cells)
  if (set.size === 0) return false
  const start = [...set][0]!
  const seen = new Set([start])
  const queue = [start]
  while (queue.length) {
    const k = queue.shift()!
    const seg = k.split('-')
    const r = Number(seg[0])
    const c = Number(seg[1])
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as Array<[number, number]>) {
      const n = `${r + dr}-${c + dc}`
      if (set.has(n) && !seen.has(n)) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return seen.size === set.size
}

/** Shade squares on a grid to build a shape with a given area / perimeter. */
export const GridShapeQuestion = z
  .object({
    ...questionBase,
    type: z.literal('gridshape'),
    rows: z.number().int().min(2).max(12).describe('Grid height in cells.'),
    cols: z.number().int().min(2).max(12).describe('Grid width in cells.'),
    given: z.array(z.string()).default([]).describe('Cells already shaded (locked) "row-col".'),
    requireContiguous: z.boolean().default(true).describe('The shape must be one connected piece.'),
    target: z
      .object({
        area: z.number().int().min(1).optional().describe('Required number of squares.'),
        perimeter: z.number().int().min(1).optional().describe('Required perimeter (unit edges).'),
        cells: z.array(z.string()).optional().describe('Exact cells required (strictest).'),
      })
      .describe('At least one of area / perimeter / cells must be given.'),
    unitLabel: z.string().optional().describe('e.g. "cm".'),
  })
  .describe('Find the area and/or perimeter of a shape on a grid.')

/** Order events on a likelihood scale (will / might / won\'t happen). */
export const ChanceQuestion = z
  .object({
    ...questionBase,
    type: z.literal('chance'),
    levels: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1) }))
      .min(2)
      .describe("Likelihood levels in order, least → most likely (e.g. won't / might / will)."),
    items: z.array(QuizItem).min(1).describe('The events to place on the scale.'),
    answer: z.record(z.string(), z.string()).describe('Correct itemId → levelId.'),
  })
  .describe('Rate how likely an event is on a probability scale.')

/** Tap every face / edge / vertex of a 3D solid — you must TURN it to find the
 *  hidden ones. The answer is derived from the solid's topology, not authored. */
export const SolidQuestion = z
  .object({
    ...questionBase,
    type: z.literal('solid'),
    shape: z
      .enum(['cube', 'cuboid', 'cylinder', 'sphere', 'cone', 'pyramid'])
      .describe('Which solid to inspect.'),
    task: z
      .enum(['face', 'edge', 'vertex', 'curved'])
      .describe('Which part kind to tap. "curved" = the curved surface (not a face).'),
  })
  .describe('Count the faces, edges or vertices of a 3D solid — turn it to reach the hidden ones.')

/* ------------------------- Identification key (Science) ------------------------ */
/** One node of a branching (dichotomous) key: either a yes/no QUESTION or a RESULT. */
export const BranchKeyNode = z.object({
  id: z.string().min(1),
  question: z.string().optional().describe('The yes/no question (question nodes only).'),
  yes: z.string().optional().describe('Node id to go to on "yes".'),
  no: z.string().optional().describe('Node id to go to on "no".'),
  result: z.string().optional().describe('The identification (leaf nodes only), e.g. "It is a mammal".'),
})

/** Walk a key from the root using the learner's yes/no answers. Returns the leaf
 *  reached, or null if the walk is still in progress / the key is malformed. */
export function traverseKey(
  q: { nodes: Array<z.infer<typeof BranchKeyNode>>; root: string },
  answers: Record<string, boolean>,
): string | null {
  const byId = new Map(q.nodes.map((n) => [n.id, n]))
  let cur = byId.get(q.root)
  const seen = new Set<string>()
  while (cur) {
    if (cur.result !== undefined) return cur.id // leaf
    if (seen.has(cur.id)) return null // cycle guard
    seen.add(cur.id)
    const a = answers[cur.id]
    if (a === undefined) return null // not answered yet
    const nextId = a ? cur.yes : cur.no
    cur = nextId ? byId.get(nextId) : undefined
  }
  return null
}

/** Identify something with a branching key — answer yes/no until you reach a result. */
export const BranchKeyQuestion = z
  .object({
    ...questionBase,
    type: z.literal('branchkey'),
    subject: z.string().min(1).describe('What is being identified, e.g. "this animal".'),
    subjectEmoji: z.string().optional().describe('Emoji for the thing being identified.'),
    subjectImage: z.string().url().optional().describe('Image URL for the thing being identified.'),
    nodes: z.array(BranchKeyNode).min(2).describe('The key: question nodes + result (leaf) nodes.'),
    root: z.string().min(1).describe('Id of the first question.'),
    answer: z.string().min(1).describe('Id of the RESULT node the learner should reach.'),
  })
  .describe('Follow a yes/no identification key to reach a result.')

/* ---------------------------- Proofreading (English) --------------------------- */
/** Find the mistakes in a text and write the corrections (also covers punctuation). */
export const ProofreadQuestion = z
  .object({
    ...questionBase,
    type: z.literal('proofread'),
    tokens: z.array(z.string()).min(2).describe('The text, split into tokens (words/punctuation).'),
    errors: z
      .record(z.string(), z.string())
      .describe('Correct fixes: token INDEX (as a string) → the corrected text.'),
  })
  .describe('Find and fix the errors in a piece of text.')

/* ------------------------------- Coordinates ---------------------------------- */
export const CoordPoint = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  label: z.string().optional().describe('Point name (A, B…) — required for the "read" task.'),
})

/** Plot points on an x–y grid, or read the coordinates of marked points. */
export const CoordinatesQuestion = z
  .object({
    ...questionBase,
    type: z.literal('coordinates'),
    maxX: z.number().int().min(2).max(12).describe('The x-axis runs 0…maxX.'),
    maxY: z.number().int().min(2).max(12).describe('The y-axis runs 0…maxY.'),
    task: z
      .enum(['plot', 'read'])
      .default('plot')
      .describe(
        'plot = tap the grid to mark the given coordinates. read = write the coordinates of the marked points.',
      ),
    coords: z
      .array(CoordPoint)
      .min(1)
      .describe('The points: to plot (task=plot) or already marked (task=read).'),
  })
  .describe('Plot or read points on a coordinate grid.')

/* --------------------------------- Angles ------------------------------------- */
export type AngleKind = 'acute' | 'right' | 'obtuse' | 'straight' | 'reflex'

/** Name an angle the way the books do. */
export function classifyAngle(deg: number): AngleKind {
  if (deg < 90) return 'acute'
  if (deg === 90) return 'right'
  if (deg < 180) return 'obtuse'
  if (deg === 180) return 'straight'
  return 'reflex'
}

/** Make, estimate or name an angle (the "angle maker" / protractor work). */
export const AngleQuestion = z
  .object({
    ...questionBase,
    type: z.literal('angle'),
    task: z
      .enum(['set', 'estimate', 'classify'])
      .describe(
        'set = drag the arm to MAKE the angle. estimate = guess the size of the shown angle. classify = name it.',
      ),
    angle: z
      .number()
      .int()
      .min(1)
      .max(359)
      .describe('The angle in degrees: the one to make (set) or the one shown (estimate/classify).'),
    tolerance: z
      .number()
      .int()
      .min(0)
      .default(5)
      .describe('Degrees of slack when grading set/estimate (estimate usually wants more).'),
    showProtractor: z.boolean().default(true).describe('Draw the degree scale behind the angle.'),
  })
  .describe('Set, estimate, or classify an angle with a protractor.')

/* ------------------------- Line graph / dot plot ------------------------------ */
/** Plot a value for each x — joined into a LINE graph, or left as a DOT plot.
 *  (The Cambridge dot plot is one dot per x at its height, so it's the same
 *  primitive with the joining line switched off.) */
export const LineGraphQuestion = z
  .object({
    ...questionBase,
    type: z.literal('linegraph'),
    style: z.enum(['line', 'dot']).default('line').describe('line = join the points. dot = a dot plot.'),
    xLabels: z.array(z.string()).min(2).describe('Category/time labels along the x-axis.'),
    maxY: z.number().int().min(1).max(100).describe('The y-axis runs 0…maxY.'),
    stepY: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe(
        'Gridline interval on the y-axis (display only — any whole value can be plotted, as in the books).',
      ),
    answer: z.array(z.number().int().min(0)).describe('Correct y value for each x (same length as xLabels).'),
    xTitle: z.string().optional().describe('Title shown under the x-axis.'),
    yTitle: z.string().optional().describe('Title shown beside the y-axis.'),
  })
  .describe('Plot points on a line graph or a dot plot.')

/* ---------------------------------- Waffle ------------------------------------ */
/** Waffle diagram — a 10×10 grid where each shaded square is one per cent. */
export const WaffleQuestion = z
  .object({
    ...questionBase,
    type: z.literal('waffle'),
    size: z.number().int().min(2).max(10).default(10).describe('Grid is size×size (10 → 100 squares = %).'),
    categories: z
      .array(z.object({ id: z.string().min(1), label: z.string().min(1), color: z.string().optional() }))
      .min(1)
      .describe('The categories to shade, each with an id, label and optional colour.'),
    answer: z.record(z.string(), z.number().int().min(0)).describe('Correct catId → number of squares.'),
  })
  .describe('Shade a 10x10 waffle diagram to the given percentages.')

/* -------------------------------- Translation --------------------------------- */
/** Translate a shape on a grid — either MOVE it, or DESCRIBE the move already made. */
export const TranslationQuestion = z
  .object({
    ...questionBase,
    type: z.literal('translation'),
    rows: z.number().int().min(2).max(12).describe('Grid height in cells.'),
    cols: z.number().int().min(2).max(12).describe('Grid width in cells.'),
    cells: z.array(z.string()).min(1).describe('The original shape, as "row-col" cells.'),
    dx: z.number().int().describe('Squares right (negative = left).'),
    dy: z.number().int().describe('Squares UP (negative = down) — as the books say it.'),
    task: z
      .enum(['move', 'describe'])
      .default('move')
      .describe('move = shift the shape yourself. describe = both shapes are shown; say how far it moved.'),
  })
  .describe('Translate a shape on a grid, or describe the translation.')

/** Apply a translation to a set of "row-col" cells. Note dy is UP-positive. */
export function translateCells(cells: string[], dx: number, dy: number): string[] {
  return cells.map((k) => {
    const seg = k.split('-')
    return `${Number(seg[0]) - dy}-${Number(seg[1]) + dx}`
  })
}

/* ----------------------- Open responses (rubric-assessed) ---------------------- */
/**
 * Drawing and writing have no single right answer, so they are not machine-marked.
 * They carry SUCCESS CRITERIA instead — shown up front, the way Cambridge does it
 * ("Look what I can do") — and the learner ticks the ones they met. The score is the
 * share of criteria met; `pass` is how many must be met to count the question correct.
 * A grader (teacher or model) can later overwrite `met` without any schema change.
 */
export const RubricCriterion = z.object({
  id: z.string().min(1),
  text: z.string().min(1).describe('One observable thing the work must show ("I used a capital letter").'),
})

const openBase = {
  criteria: z.array(RubricCriterion).min(1).describe('Success criteria — shown BEFORE the learner starts.'),
  pass: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('How many criteria must be met to count as correct. Defaults to all of them.'),
}

/** Count the words in a piece of writing (whitespace-separated, punctuation kept). */
export function countWords(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).length
}

/** Draw the answer (vẽ tự do) — the workbooks' single most common instruction. */
export const DrawingQuestion = z
  .object({
    ...questionBase,
    ...openBase,
    type: z.literal('drawing'),
    referenceImage: z.string().url().optional().describe('Optional picture to draw from / draw onto.'),
    exemplarImage: z.string().url().optional().describe('A model answer, revealed after the learner checks.'),
  })
  .describe('Draw the answer freehand; judged against success criteria.')

/** Write a sentence / paragraph / explanation ("show your working", "explain how you know"). */
export const WritingQuestion = z
  .object({
    ...questionBase,
    ...openBase,
    type: z.literal('writing'),
    minWords: z.number().int().min(1).optional().describe('Fewest words the answer should have.'),
    maxWords: z.number().int().min(1).optional().describe('Most words the answer may have.'),
    starters: z
      .array(z.string().min(1))
      .optional()
      .describe('A writing frame — sentence openers the learner can tap to insert.'),
    exemplar: z.string().min(1).optional().describe('A model answer, revealed after the learner checks.'),
  })
  .describe('Write a sentence or paragraph; judged against success criteria.')

/** Estimate first, then measure/work it out — the books drill this pairing 200+ times. */
export const EstimateQuestion = z
  .object({
    ...questionBase,
    type: z.literal('estimate'),
    actual: z.number().describe('The true value. The ESTIMATE is never marked — only this is.'),
    unit: z.string().optional().describe('cm, kg, minutes…'),
    tolerance: z
      .number()
      .min(0)
      .default(0)
      .describe('How far off an estimate may be and still count as a CLOSE estimate (praise, not marks).'),
    step: z.number().positive().default(1).describe('Increment of the +/- steppers.'),
  })
  .describe('Estimate a value first, then measure or work out the real one.')

/* ------------------------------------ Net ------------------------------------- */
/** Match a net to the solid it folds into — or name the solid a net makes. */
export const NetQuestion = z
  .object({
    ...questionBase,
    type: z.literal('net'),
    task: z
      .enum(['pick', 'name'])
      .default('pick')
      .describe('pick = which net folds into this solid? name = which solid does this net make?'),
    solid: z.enum(SOLID_NAMES).optional().describe('pick: the target solid, shown in 3D.'),
    options: z.array(z.string().min(1)).min(2).optional().describe('pick: net ids from NET_LIBRARY.'),
    net: z.string().min(1).optional().describe('name: the net id shown.'),
    solidOptions: z.array(z.enum(SOLID_NAMES)).min(2).optional().describe('name: the solids to choose from.'),
  })
  .describe('Match a net to the solid it folds into, or name that solid.')

/** What the learner must choose: a net id (pick) or a solid name (name). */
export function netAnswer(q: z.infer<typeof NetQuestion>): string | null {
  if (q.task === 'name') return q.net ? (getNet(q.net)?.solid ?? null) : null
  const hit = (q.options ?? []).filter((id) => getNet(id)?.solid === q.solid)
  return hit.length === 1 ? hit[0]! : null
}

/* ---------------------------------- Compass ----------------------------------- */
export const COMPASS_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const
export type CompassDirection = (typeof COMPASS_DIRECTIONS)[number]

/** The 8-point compass direction from one map point to another (y grows NORTH). */
export function compassDirection(
  from: { x: number; y: number },
  to: { x: number; y: number },
): CompassDirection | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return null
  // 0° = East, going anticlockwise.
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI
  const idx = Math.round(((90 - deg) % 360) / 45) % 8 // 0 = N, then clockwise
  return COMPASS_DIRECTIONS[(idx + 8) % 8]!
}
/** How far the true bearing sits from the snapped 8-point direction (degrees). */
function compassSkew(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const deg = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI
  const bearing = (((90 - deg) % 360) + 360) % 360
  const snapped = Math.round(bearing / 45) * 45
  return Math.abs(((bearing - snapped + 540) % 360) - 180) === 180 ? 0 : Math.abs(bearing - snapped)
}

/** Name the compass direction from one place to another on a map. */
export const CompassQuestion = z
  .object({
    ...questionBase,
    type: z.literal('compass'),
    maxX: z.number().int().min(2).max(12).describe('Map width in cells.'),
    maxY: z.number().int().min(2).max(12).describe('Map height in cells.'),
    places: z
      .array(
        z.object({
          id: z.string().min(1),
          label: z.string().min(1),
          x: z.number().int().min(0),
          y: z.number().int().min(0),
          emoji: z.string().optional(),
        }),
      )
      .min(2)
      .describe('Places on the map, each with an id, label and x/y position.'),
    from: z.string().min(1).describe('Place id you start from.'),
    to: z.string().min(1).describe('Place id you travel to. The ANSWER is derived from the geometry.'),
  })
  .describe('Name the 8-point compass direction between two places.')

/** Draw / annotate on an image — an open response (freehand strokes). */
export const AnnotateQuestion = z
  .object({
    ...questionBase,
    type: z.literal('annotate'),
    imageAssetId: z.string().optional().describe('Media-library image asset id (preferred).'),
    imageSrc: z.string().url().optional().describe('Resolved/external image URL.'),
    brushColor: z.string().optional().describe('Default stroke colour (hex).'),
  })
  .describe('Draw freehand marks on an image (author-checked).')

/** Tally chart — record a count per category as tally marks (grouped in fives). */
export const TallyQuestion = z
  .object({
    ...questionBase,
    type: z.literal('tally'),
    categories: z.array(QuizItem).min(1).describe('Rows to tally (id + label + optional emoji).'),
    answer: z.record(z.string(), z.number().int().min(0)).describe('Correct catId → count.'),
  })
  .describe('Record counts as tally marks.')

/** Pictogram — fill each row with icons; each icon can represent several units. */
export const PictogramQuestion = z
  .object({
    ...questionBase,
    type: z.literal('pictogram'),
    categories: z.array(QuizItem).min(1).describe('Rows (id + label + emoji icon).'),
    maxIcons: z.number().int().min(1).max(12).describe('How many icons a row can hold.'),
    iconValue: z.number().int().min(1).default(1).describe('Units each icon represents (key).'),
    answer: z.record(z.string(), z.number().int().min(0)).describe('Correct catId → number of icons.'),
  })
  .describe('Build a pictogram where each icon stands for a value.')

/** Build a multiplication array — select an r×c rectangle of dots. */
export const ArrayQuestion = z
  .object({
    ...questionBase,
    type: z.literal('array'),
    maxRows: z.number().int().min(1).max(12).describe('Grid height the learner can choose within.'),
    maxCols: z.number().int().min(1).max(12).describe('Grid width the learner can choose within.'),
    emoji: z.string().optional().describe('Optional dot emoji (defaults to a filled dot).'),
    allowTranspose: z.boolean().default(false).describe('Accept the rotated array too (r×c or c×r).'),
    answer: z
      .object({ rows: z.number().int().min(1), cols: z.number().int().min(1) })
      .describe('Correct array dimensions.'),
  })
  .describe('Build a rectangular array to model multiplication.')

/** Turns / rotation — set a pointer to where it lands after a turn. */
export const RotationQuestion = z
  .object({
    ...questionBase,
    type: z.literal('rotation'),
    steps: z
      .union([z.literal(4), z.literal(8), z.literal(12)])
      .default(4)
      .describe('Positions around the dial (4 = quarter turns).'),
    start: z.number().int().min(0).describe('Starting position index (0 = up, clockwise).'),
    answer: z.number().int().min(0).describe('Final position index after the described turn.'),
    emoji: z.string().optional().describe('The thing that turns (defaults to an arrow).'),
  })
  .describe('Rotate a shape to the correct orientation.')

/** Read a graduated scale — a dial gauge or a thermometer. */
export const ScaleQuestion = z
  .object({
    ...questionBase,
    type: z.literal('scale'),
    shape: z.enum(['thermometer', 'dial']).default('thermometer').describe('How the scale is drawn.'),
    min: z.number().int().describe('Smallest value on the scale.'),
    max: z.number().int().describe('Largest value on the scale.'),
    step: z.number().int().min(1).default(1).describe('Interval between selectable ticks.'),
    answer: z.number().int().describe('The value the pointer/level should read.'),
    unitLabel: z.string().optional().describe('Unit, e.g. "grams" or "°C".'),
  })
  .describe('Read a value off a dial or scale (thermometer, gauge).')

/** Read/set a digital clock (HH:MM). */
export const DigitalClockQuestion = z
  .object({
    ...questionBase,
    type: z.literal('digitalclock'),
    mode: z.enum(['12h', '24h']).default('12h').describe('Display mode.'),
    answer: z
      .object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59) })
      .describe('Correct time.'),
  })
  .describe('Set a digital clock to a given time.')

const rc = (key: string): [number, number] => {
  const seg = key.split('-')
  return [Number(seg[0]), Number(seg[1])]
}

/** Shortest route from start→target avoiding blocked cells (BFS), or null. */
export function routeSolution(q: {
  rows: number
  cols: number
  start: string
  target: string
  blocked: string[]
}): string[] | null {
  const blocked = new Set(q.blocked)
  const [tr, tc] = rc(q.target)
  const key = (r: number, c: number) => `${r}-${c}`
  const prev = new Map<string, string | null>([[q.start, null]])
  const queue: Array<[number, number]> = [rc(q.start)]
  while (queue.length) {
    const [r, c] = queue.shift()!
    if (r === tr && c === tc) break
    for (const [dr, dc] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ] as Array<[number, number]>) {
      const nr = r + dr
      const nc = c + dc
      const k = key(nr, nc)
      if (nr < 0 || nr >= q.rows || nc < 0 || nc >= q.cols || blocked.has(k) || prev.has(k)) continue
      prev.set(k, key(r, c))
      queue.push([nr, nc])
    }
  }
  if (!prev.has(q.target)) return null
  const path: string[] = []
  let cur: string | null = q.target
  while (cur) {
    path.unshift(cur)
    cur = prev.get(cur) ?? null
  }
  return path
}

/** A learner path is valid if it walks start→target one orthogonal step at a time,
 *  never repeating a cell and never entering a blocked cell. */
export function isValidRoute(
  q: { rows: number; cols: number; start: string; target: string; blocked: string[] },
  path: string[],
): boolean {
  if (path.length < 1 || path[0] !== q.start || path[path.length - 1] !== q.target) return false
  const blocked = new Set(q.blocked)
  const seen = new Set<string>()
  for (let i = 0; i < path.length; i++) {
    const k = path[i]!
    const [r, c] = rc(k)
    if (r < 0 || r >= q.rows || c < 0 || c >= q.cols || blocked.has(k) || seen.has(k)) return false
    seen.add(k)
    if (i > 0) {
      const [pr, pc] = rc(path[i - 1]!)
      if (Math.abs(pr - r) + Math.abs(pc - c) !== 1) return false
    }
  }
  return true
}

/** Expected letters + entry-number badges for a crossword grid. */
export function crosswordCells(q: {
  entries: Array<{
    number: number
    row: number
    col: number
    dir: 'across' | 'down'
    answer: string
  }>
}): { expected: Record<string, string>; numbers: Record<string, number> } {
  const expected: Record<string, string> = {}
  const numbers: Record<string, number> = {}
  for (const e of q.entries) {
    numbers[`${e.row}-${e.col}`] = e.number
    const letters = e.answer.toUpperCase()
    for (let k = 0; k < letters.length; k++) {
      const r = e.dir === 'across' ? e.row : e.row + k
      const c = e.dir === 'across' ? e.col + k : e.col
      expected[`${r}-${c}`] = letters[k]!
    }
  }
  return { expected, numbers }
}

/** Move a token through a grid maze to reach the target. */
export const RouteQuestion = z
  .object({
    ...questionBase,
    type: z.literal('route'),
    rows: z.number().int().min(2).max(10).describe('Grid height in cells.'),
    cols: z.number().int().min(2).max(10).describe('Grid width in cells.'),
    start: z.string().describe('Start cell "row-col".'),
    target: z.string().describe('Target cell "row-col".'),
    blocked: z.array(z.string()).default([]).describe('Impassable cells "row-col".'),
    startEmoji: z.string().optional().describe('Emoji marking the start cell.'),
    targetEmoji: z.string().optional().describe('Emoji marking the goal cell.'),
  })
  .describe('Program a path across a grid to reach a goal.')

/** A single crossword entry. */
export const CrosswordEntry = z.object({
  number: z.number().int().min(1),
  row: z.number().int().min(0),
  col: z.number().int().min(0),
  dir: z.enum(['across', 'down']),
  answer: z.string().min(2).describe('The word (letters only).'),
  clue: z.string().describe('The clue text.'),
})

/** Fill words into a crossword grid from clues. */
export const CrosswordQuestion = z
  .object({
    ...questionBase,
    type: z.literal('crossword'),
    rows: z.number().int().min(2).max(15).describe('Grid height in cells.'),
    cols: z.number().int().min(2).max(15).describe('Grid width in cells.'),
    entries: z
      .array(CrosswordEntry)
      .min(1)
      .describe('The words to place, each with its number, position, direction, answer and clue.'),
  })
  .describe('Fill a crossword from its across and down clues.')

/* --------------------------- Math expression engine ------------------------- */
/** Canonical maths input is a linear string ("3/4", "x^2", "sqrt(9)", "pi*r^2").
 *  It is parsed to an AST so it can be evaluated (numeric grading) AND converted
 *  to LaTeX (future advanced rendering) from one source of truth. */

type MathNode =
  | { k: 'num'; v: number }
  | { k: 'sym'; v: string }
  | { k: 'neg'; a: MathNode }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '^'; a: MathNode; b: MathNode }
  | { k: 'fn'; name: string; a: MathNode }

type MathTok =
  | { t: 'num'; v: number }
  | { t: 'op'; v: string }
  | { t: 'lp' }
  | { t: 'rp' }
  | { t: 'sym'; v: string }
  | { t: 'fn'; v: string }

const MATH_FNS = ['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs']

function tokenizeMath(s: string): MathTok[] | null {
  const out: MathTok[] = []
  let i = 0
  const isDigit = (c: string) => c >= '0' && c <= '9'
  const isAlpha = (c: string) => /[a-zA-Z]/.test(c)
  while (i < s.length) {
    const c = s[i]!
    if (c === ' ') {
      i++
      continue
    }
    if (isDigit(c) || c === '.') {
      let j = i + 1
      while (j < s.length && (isDigit(s[j]!) || s[j] === '.')) j++
      const num = Number(s.slice(i, j))
      if (!Number.isFinite(num)) return null
      out.push({ t: 'num', v: num })
      i = j
      continue
    }
    if ('+-*/^'.includes(c)) {
      out.push({ t: 'op', v: c })
      i++
      continue
    }
    if (c === '×') {
      out.push({ t: 'op', v: '*' })
      i++
      continue
    }
    if (c === '÷') {
      out.push({ t: 'op', v: '/' })
      i++
      continue
    }
    if (c === '(') {
      out.push({ t: 'lp' })
      i++
      continue
    }
    if (c === ')') {
      out.push({ t: 'rp' })
      i++
      continue
    }
    if (isAlpha(c)) {
      let j = i + 1
      while (j < s.length && isAlpha(s[j]!)) j++
      const word = s.slice(i, j).toLowerCase()
      out.push(MATH_FNS.includes(word) ? { t: 'fn', v: word } : { t: 'sym', v: word })
      i = j
      continue
    }
    return null
  }
  return out
}

/** Parse a maths string to an AST, or null if malformed. */
export function parseMath(input: string): MathNode | null {
  const toks = tokenizeMath(input)
  if (!toks || toks.length === 0) return null
  const T = toks
  let p = 0
  const at = () => T[p]
  const isOp = (...vs: string[]) => {
    const t = at()
    return !!t && t.t === 'op' && vs.includes(t.v)
  }
  function expr(): MathNode | null {
    let a = term()
    if (!a) return null
    while (isOp('+', '-')) {
      const op = (T[p++] as { v: '+' | '-' }).v
      const b = term()
      if (!b) return null
      a = { k: 'bin', op, a, b }
    }
    return a
  }
  function term(): MathNode | null {
    let a = power()
    if (!a) return null
    while (isOp('*', '/')) {
      const op = (T[p++] as { v: '*' | '/' }).v
      const b = power()
      if (!b) return null
      a = { k: 'bin', op, a, b }
    }
    return a
  }
  function power(): MathNode | null {
    const a = unary()
    if (!a) return null
    if (isOp('^')) {
      p++
      const b = power()
      if (!b) return null
      return { k: 'bin', op: '^', a, b }
    }
    return a
  }
  function unary(): MathNode | null {
    if (isOp('-')) {
      p++
      const a = unary()
      return a ? { k: 'neg', a } : null
    }
    if (isOp('+')) {
      p++
      return unary()
    }
    return primary()
  }
  function primary(): MathNode | null {
    const t = at()
    if (!t) return null
    if (t.t === 'num') {
      p++
      return { k: 'num', v: t.v }
    }
    if (t.t === 'sym') {
      p++
      return { k: 'sym', v: t.v }
    }
    if (t.t === 'fn') {
      p++
      if (at()?.t !== 'lp') return null
      p++
      const arg = expr()
      if (!arg || at()?.t !== 'rp') return null
      p++
      return { k: 'fn', name: t.v, a: arg }
    }
    if (t.t === 'lp') {
      p++
      const v = expr()
      if (!v || at()?.t !== 'rp') return null
      p++
      return v
    }
    return null
  }
  const tree = expr()
  return tree && p === T.length ? tree : null
}

function evalNode(n: MathNode): number | null {
  switch (n.k) {
    case 'num':
      return n.v
    case 'sym':
      return n.v === 'pi' ? Math.PI : n.v === 'e' ? Math.E : null
    case 'neg': {
      const a = evalNode(n.a)
      return a === null ? null : -a
    }
    case 'bin': {
      const a = evalNode(n.a)
      const b = evalNode(n.b)
      if (a === null || b === null) return null
      const r =
        n.op === '+'
          ? a + b
          : n.op === '-'
            ? a - b
            : n.op === '*'
              ? a * b
              : n.op === '/'
                ? a / b
                : Math.pow(a, b)
      return Number.isFinite(r) ? r : null
    }
    case 'fn': {
      const a = evalNode(n.a)
      if (a === null) return null
      const r =
        n.name === 'sqrt'
          ? Math.sqrt(a)
          : n.name === 'sin'
            ? Math.sin(a)
            : n.name === 'cos'
              ? Math.cos(a)
              : n.name === 'tan'
                ? Math.tan(a)
                : n.name === 'log'
                  ? Math.log10(a)
                  : n.name === 'ln'
                    ? Math.log(a)
                    : n.name === 'abs'
                      ? Math.abs(a)
                      : NaN
      return Number.isFinite(r) ? r : null
    }
  }
}

/** Evaluate a maths string to a number (numeric grading), or null if it can't be. */
export function evalMath(input: string): number | null {
  const tree = parseMath(input)
  return tree ? evalNode(tree) : null
}

/** Normalise a maths string for exact comparison (whitespace-insensitive). */
export function normalizeMath(input: string): string {
  return input.replace(/\s+/g, '')
}

function nodeToLatex(n: MathNode): string {
  const wrap = (x: MathNode) =>
    x.k === 'bin' && (x.op === '+' || x.op === '-') ? `(${nodeToLatex(x)})` : nodeToLatex(x)
  switch (n.k) {
    case 'num':
      return String(n.v)
    case 'sym':
      return n.v === 'pi' ? '\\pi' : n.v
    case 'neg':
      return `-${wrap(n.a)}`
    case 'bin':
      if (n.op === '/') return `\\frac{${nodeToLatex(n.a)}}{${nodeToLatex(n.b)}}`
      if (n.op === '*') return `${wrap(n.a)} \\times ${wrap(n.b)}`
      if (n.op === '^') return `${wrap(n.a)}^{${nodeToLatex(n.b)}}`
      return `${nodeToLatex(n.a)} ${n.op} ${nodeToLatex(n.b)}`
    case 'fn':
      return n.name === 'sqrt' ? `\\sqrt{${nodeToLatex(n.a)}}` : `\\${n.name}(${nodeToLatex(n.a)})`
  }
}

/** Convert a maths string to LaTeX (for export / future advanced rendering). */
export function mathToLatex(input: string): string | null {
  const tree = parseMath(input)
  return tree ? nodeToLatex(tree) : null
}

/** Enter a maths expression with an on-screen keyboard (audience-adaptive). */
export const MathQuestion = z
  .object({
    ...questionBase,
    type: z.literal('math'),
    answer: z.string().min(1).describe('Correct expression as linear maths ("3/4", "x^2", "pi*r^2").'),
    gradeMode: z
      .enum(['numeric', 'exact'])
      .default('numeric')
      .describe('numeric = compare values; exact = compare normalised text (algebra).'),
    level: z
      .enum(['preschool', 'primary', 'secondary', 'advanced'])
      .default('primary')
      .describe('Chooses the default keyboard layout for the audience.'),
    keys: z.array(z.string()).optional().describe('Override the keyboard keys.'),
    tolerance: z.number().min(0).default(1e-9).describe('Numeric grading tolerance.'),
    placeholder: z.string().optional().describe('Greyed-out hint text inside the input.'),
  })
  .describe('Enter a maths expression (fractions, powers, symbols).')

/** Read aloud / speaking — an open response (record your voice). */
export const SpeechQuestion = z
  .object({
    ...questionBase,
    type: z.literal('speech'),
    text: z.string().optional().describe('The passage/word to read aloud.'),
    maxSeconds: z.number().int().min(1).max(300).optional().describe('Recording time limit.'),
    transcriptTarget: z
      .string()
      .optional()
      .describe('Expected transcript (reserved for future ASR grading).'),
  })
  .describe('Read a prompt aloud and record it (author-checked).')

/** Report duplicate values in a list of ids. */
function findDuplicate(ids: string[]): string | undefined {
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) return id
    seen.add(id)
  }
  return undefined
}

/**
 * Cross-field semantic rules a structurally-valid question must ALSO satisfy —
 * answers must reference real ids, blanks must line up, ids must be unique.
 * JSON Schema can't express these, so the validator enforces them and an LLM
 * repair loop gets a precise message pointing at the broken field.
 */
function checkQuestion(q: z.infer<typeof QuizQuestionShape>, ctx: z.RefinementCtx): void {
  const dupIssue = (path: (string | number)[], id: string) =>
    ctx.addIssue({ code: 'custom', path, message: `duplicate id "${id}" — ids must be unique` })
  const missingIssue = (path: (string | number)[], id: string, source: string) =>
    ctx.addIssue({ code: 'custom', path, message: `id "${id}" does not exist in ${source}` })

  switch (q.type) {
    case 'single': {
      const ids = q.choices.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['choices'], dup)
      if (!ids.includes(q.answerId)) missingIssue(['answerId'], q.answerId, 'choices')
      return
    }
    case 'multiple': {
      const ids = q.choices.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['choices'], dup)
      q.answerIds.forEach((id, i) => {
        if (!ids.includes(id)) missingIssue(['answerIds', i], id, 'choices')
      })
      return
    }
    case 'fill': {
      const blanks = q.segments.filter((s) => 'blank' in s).length
      if (blanks === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['segments'],
          message: 'at least one blank segment is required',
        })
      if (q.answers.length !== blanks)
        ctx.addIssue({
          code: 'custom',
          path: ['answers'],
          message: `answers has ${q.answers.length} entries but segments has ${blanks} blank(s) — they must match 1:1, in order`,
        })
      return
    }
    case 'order': {
      const ids = q.items.map((it) => it.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['items'], dup)
      const wanted = [...ids].sort().join('\u0000')
      const got = [...q.correctOrder].sort().join('\u0000')
      if (wanted !== got)
        ctx.addIssue({
          code: 'custom',
          path: ['correctOrder'],
          message: 'correctOrder must be a permutation of items ids (same ids, each exactly once)',
        })
      return
    }
    case 'match': {
      const leftIds = q.left.map((it) => it.id)
      const rightIds = q.right.map((it) => it.id)
      const dupL = findDuplicate(leftIds)
      if (dupL) dupIssue(['left'], dupL)
      const dupR = findDuplicate(rightIds)
      if (dupR) dupIssue(['right'], dupR)
      for (const l of leftIds) {
        if (!(l in q.pairs))
          ctx.addIssue({
            code: 'custom',
            path: ['pairs'],
            message: `left id "${l}" has no pair — every left item needs one`,
          })
      }
      for (const [l, r] of Object.entries(q.pairs)) {
        if (!leftIds.includes(l)) missingIssue(['pairs', l], l, 'left')
        if (!rightIds.includes(r)) missingIssue(['pairs', l], r, 'right')
      }
      return
    }
    case 'wordbank': {
      // Every answer token must be available in the bank, respecting duplicates.
      const supply = new Map<string, number>()
      for (const t of q.bank) supply.set(t, (supply.get(t) ?? 0) + 1)
      for (const t of q.answer) {
        const left = supply.get(t) ?? 0
        if (left === 0) {
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `answer token "${t}" is not available in bank (or used more times than it appears)`,
          })
        } else supply.set(t, left - 1)
      }
      return
    }
    case 'categorize': {
      const catIds = q.categories.map((c) => c.id)
      const itemIds = q.items.map((it) => it.id)
      const dupC = findDuplicate(catIds)
      if (dupC) dupIssue(['categories'], dupC)
      const dupI = findDuplicate(itemIds)
      if (dupI) dupIssue(['items'], dupI)
      for (const id of itemIds) {
        if (!(id in q.assignment))
          ctx.addIssue({
            code: 'custom',
            path: ['assignment'],
            message: `item id "${id}" has no category assigned`,
          })
      }
      for (const [itemId, catId] of Object.entries(q.assignment)) {
        if (!itemIds.includes(itemId)) missingIssue(['assignment', itemId], itemId, 'items')
        if (!catIds.includes(catId)) missingIssue(['assignment', itemId], catId, 'categories')
      }
      return
    }
    case 'highlight': {
      const seen = new Set<number>()
      for (const idx of q.correctIndexes) {
        if (idx >= q.tokens.length)
          ctx.addIssue({
            code: 'custom',
            path: ['correctIndexes'],
            message: `index ${idx} is out of range — tokens has ${q.tokens.length} entries`,
          })
        if (seen.has(idx))
          ctx.addIssue({
            code: 'custom',
            path: ['correctIndexes'],
            message: `duplicate index ${idx}`,
          })
        seen.add(idx)
      }
      return
    }
    case 'numberline': {
      if (q.max <= q.min)
        ctx.addIssue({ code: 'custom', path: ['max'], message: 'max must be greater than min' })
      if (q.answer < q.min || q.answer > q.max)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} is outside [${q.min}, ${q.max}]`,
        })
      return
    }
    case 'venn': {
      const itemIds = q.items.map((it) => it.id)
      const dup = findDuplicate(itemIds)
      if (dup) dupIssue(['items'], dup)
      for (const id of itemIds) {
        if (!(id in q.assignment))
          ctx.addIssue({
            code: 'custom',
            path: ['assignment'],
            message: `item id "${id}" has no region assigned`,
          })
      }
      for (const id of Object.keys(q.assignment)) {
        if (!itemIds.includes(id)) missingIssue(['assignment', id], id, 'items')
      }
      return
    }
    case 'tablefill': {
      const blankIds = new Set<string>()
      q.rows.forEach((row, ri) => {
        if (row.cells.length !== q.columns.length)
          ctx.addIssue({
            code: 'custom',
            path: ['rows', ri, 'cells'],
            message: `row has ${row.cells.length} cells but there are ${q.columns.length} columns`,
          })
        row.cells.forEach((cell, ci) => {
          if (cell.blankId) {
            if (blankIds.has(cell.blankId))
              ctx.addIssue({
                code: 'custom',
                path: ['rows', ri, 'cells', ci],
                message: `duplicate blankId "${cell.blankId}"`,
              })
            blankIds.add(cell.blankId)
            if (!cell.answers || cell.answers.length === 0)
              ctx.addIssue({
                code: 'custom',
                path: ['rows', ri, 'cells', ci],
                message: 'a blank cell needs at least one accepted answer',
              })
          }
        })
      })
      if (blankIds.size === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['rows'],
          message: 'the table has no blank cells to fill',
        })
      return
    }
    case 'tenframe': {
      const cap = 10 * q.frames
      if (q.answer > cap)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} exceeds capacity ${cap} (10·frames)`,
        })
      return
    }
    case 'partwhole': {
      const nulls = [q.whole, ...q.parts].filter((v) => v === null).length
      if (nulls !== 1) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts'],
          message: `exactly one value (whole or a part) must be null (the blank); found ${nulls}`,
        })
        return
      }
      const knownParts = q.parts.reduce<number>((s, v) => s + (v ?? 0), 0)
      // whole = sum(parts). The answer fills whichever is null.
      const expected = q.whole === null ? knownParts : q.whole - knownParts
      if (expected !== q.answer)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer must make whole = sum(parts) — expected ${expected}`,
        })
      return
    }
    case 'pattern': {
      if (q.answer.length !== q.blanks)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer has ${q.answer.length} entries but blanks = ${q.blanks}`,
        })
      const paletteIds = q.palette.map((p) => p.id)
      q.answer.forEach((id, i) => {
        if (!paletteIds.includes(id)) missingIssue(['answer', i], id, 'palette')
      })
      return
    }
    case 'label': {
      const hotspotIds = q.hotspots.map((h) => h.id)
      const labelIds = q.labels.map((l) => l.id)
      const dupH = findDuplicate(hotspotIds)
      if (dupH) dupIssue(['hotspots'], dupH)
      const dupL = findDuplicate(labelIds)
      if (dupL) dupIssue(['labels'], dupL)
      for (const id of labelIds) {
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `label id "${id}" has no hotspot in answer`,
          })
      }
      for (const [labelId, hotspotId] of Object.entries(q.answer)) {
        if (!labelIds.includes(labelId)) missingIssue(['answer', labelId], labelId, 'labels')
        if (!hotspotIds.includes(hotspotId)) missingIssue(['answer', labelId], hotspotId, 'hotspots')
      }
      return
    }
    case 'hotspot': {
      const ids = q.hotspots.map((h) => h.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['hotspots'], dup)
      q.correctIds.forEach((id, i) => {
        if (!ids.includes(id)) missingIssue(['correctIds', i], id, 'hotspots')
      })
      return
    }
    case 'arrow': {
      const ids = q.nodes.map((n) => n.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['nodes'], dup)
      const seen = new Set<string>()
      q.answer.forEach((e, i) => {
        if (!ids.includes(e.from)) missingIssue(['answer', i, 'from'], e.from, 'nodes')
        if (!ids.includes(e.to)) missingIssue(['answer', i, 'to'], e.to, 'nodes')
        if (e.from === e.to)
          ctx.addIssue({
            code: 'custom',
            path: ['answer', i],
            message: 'an arrow cannot start and end at the same node',
          })
        const k = q.directed === false ? [e.from, e.to].sort().join('-') : `${e.from}->${e.to}`
        if (seen.has(k))
          ctx.addIssue({ code: 'custom', path: ['answer', i], message: `duplicate arrow "${k}"` })
        seen.add(k)
      })
      return
    }
    case 'wordsearch': {
      const width = q.rows[0]?.length ?? 0
      q.rows.forEach((row, i) => {
        if (row.length !== width)
          ctx.addIssue({
            code: 'custom',
            path: ['rows', i],
            message: `row ${i} has length ${row.length}, expected ${width} (grid must be rectangular)`,
          })
      })
      const dupW = findDuplicate(q.words.map((w) => w.toUpperCase()))
      if (dupW) dupIssue(['words'], dupW)
      q.words.forEach((w, i) => {
        if (!solveWordSearch(q.rows, w))
          ctx.addIssue({
            code: 'custom',
            path: ['words', i],
            message: `word "${w}" is not hidden anywhere in the grid`,
          })
      })
      return
    }
    case 'fraction': {
      if (q.answer > q.parts)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} exceeds the number of parts ${q.parts}`,
        })
      return
    }
    case 'carroll': {
      const ids = q.items.map((it) => it.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['items'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `item id "${id}" has no cell in answer`,
          })
      for (const [itemId, cell] of Object.entries(q.answer)) {
        if (!ids.includes(itemId)) missingIssue(['answer', itemId], itemId, 'items')
        const seg = cell.split('-')
        const rr = Number(seg[0])
        const cc = Number(seg[1])
        if (!(
          Number.isInteger(rr) &&
          rr >= 0 &&
          rr < q.rows.length &&
          Number.isInteger(cc) &&
          cc >= 0 &&
          cc < q.cols.length
        ))
          ctx.addIssue({
            code: 'custom',
            path: ['answer', itemId],
            message: `cell "${cell}" is outside the ${q.rows.length}×${q.cols.length} grid`,
          })
      }
      return
    }
    case 'money': {
      const dup = findDuplicate(q.denominations.map((dn) => dn.id))
      if (dup) dupIssue(['denominations'], dup)
      const g = q.denominations.map((dn) => dn.value).reduce((a, b) => gcd(a, b))
      if (g > 0 && q.target % g !== 0)
        ctx.addIssue({
          code: 'custom',
          path: ['target'],
          message: `target ${q.target} can't be made from these denominations`,
        })
      return
    }
    case 'balance': {
      const expected = q.left < q.right ? 'lt' : q.left > q.right ? 'gt' : 'eq'
      if (q.answer !== expected)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer "${q.answer}" contradicts left ${q.left} vs right ${q.right} (expected "${expected}")`,
        })
      return
    }
    case 'barchart': {
      const ids = q.categories.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['categories'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `category "${id}" has no height in answer`,
          })
      for (const [id, h] of Object.entries(q.answer)) {
        if (!ids.includes(id)) missingIssue(['answer', id], id, 'categories')
        if (h > q.maxValue)
          ctx.addIssue({
            code: 'custom',
            path: ['answer', id],
            message: `height ${h} exceeds maxValue ${q.maxValue}`,
          })
      }
      return
    }
    case 'ruler': {
      if (q.start + q.length > q.max)
        ctx.addIssue({
          code: 'custom',
          path: ['length'],
          message: `object (start ${q.start} + length ${q.length}) runs past the ruler end ${q.max}`,
        })
      return
    }
    case 'symmetry': {
      for (const key of q.filled) {
        const seg = key.split('-')
        const r = Number(seg[0])
        const c = Number(seg[1])
        if (!(Number.isInteger(r) && r >= 0 && r < q.rows && Number.isInteger(c) && c >= 0 && c < q.cols))
          ctx.addIssue({
            code: 'custom',
            path: ['filled'],
            message: `cell "${key}" is outside the ${q.rows}×${q.cols} grid`,
          })
      }
      if (q.axis === 'diagonal' && q.rows !== q.cols)
        ctx.addIssue({
          code: 'custom',
          path: ['axis'],
          message: `a diagonal mirror needs a square grid (got ${q.rows}×${q.cols})`,
        })
      if (q.mode === 'design') {
        if (q.cellCount === undefined)
          ctx.addIssue({
            code: 'custom',
            path: ['cellCount'],
            message: 'design mode needs cellCount',
          })
        else if (q.cellCount > q.rows * q.cols)
          ctx.addIssue({
            code: 'custom',
            path: ['cellCount'],
            message: `cellCount ${q.cellCount} exceeds the grid`,
          })
        return
      }
      if (q.filled.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['filled'],
          message: 'mirror mode needs at least one given cell',
        })
      else if (symmetryExpected(q).length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['filled'],
          message: 'the given cells are already symmetric — nothing for the learner to add',
        })
      return
    }
    case 'tally': {
      const ids = q.categories.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['categories'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `category "${id}" has no count in answer`,
          })
      for (const id of Object.keys(q.answer))
        if (!ids.includes(id)) missingIssue(['answer', id], id, 'categories')
      return
    }
    case 'pictogram': {
      const ids = q.categories.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['categories'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `category "${id}" has no icons in answer`,
          })
      for (const [id, n] of Object.entries(q.answer)) {
        if (!ids.includes(id)) missingIssue(['answer', id], id, 'categories')
        if (n > q.maxIcons)
          ctx.addIssue({
            code: 'custom',
            path: ['answer', id],
            message: `icons ${n} exceed maxIcons ${q.maxIcons}`,
          })
      }
      return
    }
    case 'array': {
      if (q.answer.rows > q.maxRows)
        ctx.addIssue({
          code: 'custom',
          path: ['answer', 'rows'],
          message: `rows ${q.answer.rows} exceed maxRows ${q.maxRows}`,
        })
      if (q.answer.cols > q.maxCols)
        ctx.addIssue({
          code: 'custom',
          path: ['answer', 'cols'],
          message: `cols ${q.answer.cols} exceed maxCols ${q.maxCols}`,
        })
      return
    }
    case 'rotation': {
      if (q.start >= q.steps)
        ctx.addIssue({
          code: 'custom',
          path: ['start'],
          message: `start ${q.start} must be < steps ${q.steps}`,
        })
      if (q.answer >= q.steps)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} must be < steps ${q.steps}`,
        })
      return
    }
    case 'scale': {
      if (q.max <= q.min)
        ctx.addIssue({
          code: 'custom',
          path: ['max'],
          message: `max ${q.max} must be greater than min ${q.min}`,
        })
      if (q.answer < q.min || q.answer > q.max)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} is outside [${q.min}, ${q.max}]`,
        })
      if ((q.answer - q.min) % q.step !== 0)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer ${q.answer} is not on a step of ${q.step}`,
        })
      return
    }
    case 'digitalclock': {
      if (q.mode === '12h' && (q.answer.hour < 1 || q.answer.hour > 12))
        ctx.addIssue({
          code: 'custom',
          path: ['answer', 'hour'],
          message: `12h hour must be 1–12, got ${q.answer.hour}`,
        })
      return
    }
    case 'route': {
      const inGrid = (k: string) => {
        const [r, c] = rc(k)
        return Number.isInteger(r) && r >= 0 && r < q.rows && Number.isInteger(c) && c >= 0 && c < q.cols
      }
      const blocked = new Set(q.blocked)
      if (!inGrid(q.start))
        ctx.addIssue({
          code: 'custom',
          path: ['start'],
          message: `start "${q.start}" is outside the grid`,
        })
      if (!inGrid(q.target))
        ctx.addIssue({
          code: 'custom',
          path: ['target'],
          message: `target "${q.target}" is outside the grid`,
        })
      if (blocked.has(q.start) || blocked.has(q.target))
        ctx.addIssue({
          code: 'custom',
          path: ['blocked'],
          message: 'start/target cannot be blocked',
        })
      if (
        inGrid(q.start) &&
        inGrid(q.target) &&
        !blocked.has(q.start) &&
        !blocked.has(q.target) &&
        !routeSolution(q)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['target'],
          message: 'no route exists from start to target',
        })
      return
    }
    case 'crossword': {
      const expected: Record<string, string> = {}
      q.entries.forEach((e, i) => {
        const letters = e.answer.toUpperCase()
        for (let k = 0; k < letters.length; k++) {
          const r = e.dir === 'across' ? e.row : e.row + k
          const c = e.dir === 'across' ? e.col + k : e.col
          if (r < 0 || r >= q.rows || c < 0 || c >= q.cols) {
            ctx.addIssue({
              code: 'custom',
              path: ['entries', i],
              message: `entry "${e.answer}" runs outside the grid`,
            })
            return
          }
          const key = `${r}-${c}`
          if (expected[key] && expected[key] !== letters[k])
            ctx.addIssue({
              code: 'custom',
              path: ['entries', i],
              message: `letter clash at ${key}: "${expected[key]}" vs "${letters[k]}"`,
            })
          expected[key] = letters[k]!
        }
      })
      return
    }
    case 'math': {
      if (q.gradeMode === 'numeric' && evalMath(q.answer) === null)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer "${q.answer}" is not numerically evaluable — fix it or use gradeMode "exact"`,
        })
      return
    }
    case 'gridshape': {
      const t = q.target
      if (t.area === undefined && t.perimeter === undefined && t.cells === undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['target'],
          message: 'target needs at least one of area / perimeter / cells',
        })
      const inGrid = (k: string) => {
        const seg = k.split('-')
        const r = Number(seg[0])
        const c = Number(seg[1])
        return Number.isInteger(r) && r >= 0 && r < q.rows && Number.isInteger(c) && c >= 0 && c < q.cols
      }
      for (const k of q.given)
        if (!inGrid(k))
          ctx.addIssue({
            code: 'custom',
            path: ['given'],
            message: `cell "${k}" is outside the ${q.rows}×${q.cols} grid`,
          })
      for (const k of t.cells ?? [])
        if (!inGrid(k))
          ctx.addIssue({
            code: 'custom',
            path: ['target', 'cells'],
            message: `cell "${k}" is outside the grid`,
          })
      if (t.area !== undefined && t.area > q.rows * q.cols)
        ctx.addIssue({
          code: 'custom',
          path: ['target', 'area'],
          message: `area ${t.area} exceeds the grid (${q.rows * q.cols} squares)`,
        })
      return
    }
    case 'chance': {
      const levelIds = q.levels.map((l) => l.id)
      const dupL = findDuplicate(levelIds)
      if (dupL) dupIssue(['levels'], dupL)
      const ids = q.items.map((it) => it.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['items'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `item "${id}" has no level in answer`,
          })
      for (const [itemId, levelId] of Object.entries(q.answer)) {
        if (!ids.includes(itemId)) missingIssue(['answer', itemId], itemId, 'items')
        if (!levelIds.includes(levelId)) missingIssue(['answer', itemId], levelId, 'levels')
      }
      return
    }
    case 'solid': {
      const parts = solidPartIds(makeSolid(q.shape as Solid3DName), q.task as SolidPartKind)
      if (parts.length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['task'],
          message: `a ${q.shape} has no "${q.task}" to tap — pick another task`,
        })
      return
    }
    case 'branchkey': {
      const ids = q.nodes.map((n) => n.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['nodes'], dup)
      if (!ids.includes(q.root)) missingIssue(['root'], q.root, 'nodes')
      const answerNode = q.nodes.find((n) => n.id === q.answer)
      if (!answerNode) missingIssue(['answer'], q.answer, 'nodes')
      else if (answerNode.result === undefined)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `node "${q.answer}" is not a result (leaf) node`,
        })
      q.nodes.forEach((n, i) => {
        const isLeaf = n.result !== undefined
        if (isLeaf) return
        if (!n.question)
          ctx.addIssue({
            code: 'custom',
            path: ['nodes', i],
            message: `node "${n.id}" needs a question or a result`,
          })
        for (const branch of ['yes', 'no'] as const) {
          const target = n[branch]
          if (!target)
            ctx.addIssue({
              code: 'custom',
              path: ['nodes', i, branch],
              message: `node "${n.id}" has no "${branch}" branch`,
            })
          else if (!ids.includes(target)) missingIssue(['nodes', i, branch], target, 'nodes')
        }
      })
      return
    }
    case 'proofread': {
      for (const [idx, fix] of Object.entries(q.errors)) {
        const i = Number(idx)
        if (!Number.isInteger(i) || i < 0 || i >= q.tokens.length)
          ctx.addIssue({
            code: 'custom',
            path: ['errors', idx],
            message: `token index ${idx} is outside the text`,
          })
        else if (q.tokens[i] === fix)
          ctx.addIssue({
            code: 'custom',
            path: ['errors', idx],
            message: `token ${idx} "${fix}" is not a mistake — the fix equals the original`,
          })
      }
      if (Object.keys(q.errors).length === 0)
        ctx.addIssue({
          code: 'custom',
          path: ['errors'],
          message: 'there must be at least one mistake to find',
        })
      return
    }
    case 'coordinates': {
      q.coords.forEach((pt, i) => {
        if (pt.x > q.maxX || pt.y > q.maxY)
          ctx.addIssue({
            code: 'custom',
            path: ['coords', i],
            message: `point (${pt.x}, ${pt.y}) is outside the ${q.maxX}×${q.maxY} grid`,
          })
        if (q.task === 'read' && !pt.label)
          ctx.addIssue({
            code: 'custom',
            path: ['coords', i],
            message: 'the "read" task needs a label (A, B…) on every point',
          })
      })
      const dup = findDuplicate(q.coords.map((pt) => `${pt.x},${pt.y}`))
      if (dup) dupIssue(['coords'], dup)
      return
    }
    case 'angle': {
      if (q.task === 'set' && q.angle > 180)
        ctx.addIssue({
          code: 'custom',
          path: ['angle'],
          message: 'the angle maker only builds 1–180°; use estimate/classify for reflex angles',
        })
      return
    }
    case 'linegraph': {
      if (q.answer.length !== q.xLabels.length)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `answer has ${q.answer.length} values but there are ${q.xLabels.length} x labels`,
        })
      q.answer.forEach((v, i) => {
        if (v > q.maxY)
          ctx.addIssue({
            code: 'custom',
            path: ['answer', i],
            message: `value ${v} exceeds maxY ${q.maxY}`,
          })
      })
      return
    }
    case 'waffle': {
      const ids = q.categories.map((c) => c.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['categories'], dup)
      for (const id of ids)
        if (!(id in q.answer))
          ctx.addIssue({
            code: 'custom',
            path: ['answer'],
            message: `category "${id}" has no square count in answer`,
          })
      let total = 0
      for (const [id, n] of Object.entries(q.answer)) {
        if (!ids.includes(id)) missingIssue(['answer', id], id, 'categories')
        total += n
      }
      if (total > q.size * q.size)
        ctx.addIssue({
          code: 'custom',
          path: ['answer'],
          message: `the squares add up to ${total}, but the grid only holds ${q.size * q.size}`,
        })
      return
    }
    case 'translation': {
      const inGrid = (k: string) => {
        const seg = k.split('-')
        const r = Number(seg[0])
        const c = Number(seg[1])
        return Number.isInteger(r) && r >= 0 && r < q.rows && Number.isInteger(c) && c >= 0 && c < q.cols
      }
      for (const k of q.cells)
        if (!inGrid(k))
          ctx.addIssue({
            code: 'custom',
            path: ['cells'],
            message: `cell "${k}" is outside the ${q.rows}×${q.cols} grid`,
          })
      if (q.dx === 0 && q.dy === 0)
        ctx.addIssue({ code: 'custom', path: ['dx'], message: 'the translation cannot be zero' })
      for (const k of translateCells(q.cells, q.dx, q.dy))
        if (!inGrid(k))
          ctx.addIssue({
            code: 'custom',
            path: ['dx'],
            message: `translating by (${q.dx}, ${q.dy}) pushes the shape off the grid`,
          })
      return
    }
    case 'drawing':
    case 'writing': {
      const dup = findDuplicate(q.criteria.map((c) => c.id))
      if (dup) dupIssue(['criteria'], dup)
      if (q.pass !== undefined && q.pass > q.criteria.length)
        ctx.addIssue({
          code: 'custom',
          path: ['pass'],
          message: `pass (${q.pass}) is more than the ${q.criteria.length} criteria there are`,
        })
      if (
        q.type === 'writing' &&
        q.minWords !== undefined &&
        q.maxWords !== undefined &&
        q.minWords > q.maxWords
      )
        ctx.addIssue({
          code: 'custom',
          path: ['minWords'],
          message: 'minWords is greater than maxWords',
        })
      return
    }
    case 'estimate':
      return
    case 'net': {
      if (q.task === 'pick') {
        if (!q.solid)
          ctx.addIssue({
            code: 'custom',
            path: ['solid'],
            message: 'the "pick" task needs a target solid',
          })
        if (!q.options?.length)
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message: 'the "pick" task needs net options',
          })
        for (const id of q.options ?? [])
          if (!getNet(id))
            ctx.addIssue({
              code: 'custom',
              path: ['options'],
              message: `"${id}" is not a net in NET_LIBRARY`,
            })
        const dup = findDuplicate(q.options ?? [])
        if (dup) dupIssue(['options'], dup)
        const hits = (q.options ?? []).filter((id) => getNet(id)?.solid === q.solid)
        if (q.solid && q.options?.length && hits.length !== 1)
          ctx.addIssue({
            code: 'custom',
            path: ['options'],
            message:
              hits.length === 0
                ? `none of the options folds into a ${q.solid}`
                : `${hits.length} options fold into a ${q.solid} — exactly one must`,
          })
      } else {
        const def = q.net ? getNet(q.net) : undefined
        if (!q.net || !def)
          ctx.addIssue({
            code: 'custom',
            path: ['net'],
            message: `"${q.net}" is not a net in NET_LIBRARY`,
          })
        else if (def.solid === null)
          ctx.addIssue({
            code: 'custom',
            path: ['net'],
            message: `"${q.net}" folds into nothing — it cannot be named`,
          })
        if (!q.solidOptions?.length)
          ctx.addIssue({
            code: 'custom',
            path: ['solidOptions'],
            message: 'the "name" task needs solid options',
          })
        else {
          const dup = findDuplicate(q.solidOptions)
          if (dup) dupIssue(['solidOptions'], dup)
          if (def?.solid && !q.solidOptions.includes(def.solid))
            ctx.addIssue({
              code: 'custom',
              path: ['solidOptions'],
              message: `the right answer (${def.solid}) is not among the options`,
            })
        }
      }
      return
    }
    case 'compass': {
      const ids = q.places.map((p) => p.id)
      const dup = findDuplicate(ids)
      if (dup) dupIssue(['places'], dup)
      q.places.forEach((p, i) => {
        if (p.x > q.maxX || p.y > q.maxY)
          ctx.addIssue({
            code: 'custom',
            path: ['places', i],
            message: `place "${p.id}" is outside the map`,
          })
      })
      const a = q.places.find((p) => p.id === q.from)
      const b = q.places.find((p) => p.id === q.to)
      if (!a) missingIssue(['from'], q.from, 'places')
      if (!b) missingIssue(['to'], q.to, 'places')
      if (a && b) {
        if (compassDirection(a, b) === null)
          ctx.addIssue({
            code: 'custom',
            path: ['to'],
            message: 'from and to are the same place — there is no direction',
          })
        else if (compassSkew(a, b) > 12)
          ctx.addIssue({
            code: 'custom',
            path: ['to'],
            message: `the bearing from "${q.from}" to "${q.to}" is ${compassSkew(a, b).toFixed(0)}° off a clean 8-point direction — the answer would be ambiguous`,
          })
      }
      return
    }
    case 'speech':
    case 'annotate':
    case 'placevalue':
    case 'clock':
    case 'numeric':
    case 'boolean':
      return
  }
}

const QuizQuestionShape = z.discriminatedUnion('type', [
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  BooleanQuestion,
  FillBlankQuestion,
  OrderQuestion,
  MatchQuestion,
  NumericQuestion,
  WordBankQuestion,
  CategorizeQuestion,
  HighlightQuestion,
  NumberLineQuestion,
  ClockQuestion,
  VennQuestion,
  TableFillQuestion,
  TenFrameQuestion,
  PartWholeQuestion,
  PlaceValueQuestion,
  PatternQuestion,
  LabelQuestion,
  HotspotFindQuestion,
  ArrowQuestion,
  WordSearchQuestion,
  FractionQuestion,
  CarrollQuestion,
  MoneyQuestion,
  BalanceQuestion,
  BarChartQuestion,
  RulerQuestion,
  SymmetryQuestion,
  AnnotateQuestion,
  TallyQuestion,
  PictogramQuestion,
  ArrayQuestion,
  RotationQuestion,
  ScaleQuestion,
  DigitalClockQuestion,
  RouteQuestion,
  CrosswordQuestion,
  MathQuestion,
  SpeechQuestion,
  GridShapeQuestion,
  ChanceQuestion,
  SolidQuestion,
  BranchKeyQuestion,
  ProofreadQuestion,
  CoordinatesQuestion,
  AngleQuestion,
  LineGraphQuestion,
  WaffleQuestion,
  TranslationQuestion,
  CompassQuestion,
  NetQuestion,
  DrawingQuestion,
  WritingQuestion,
  EstimateQuestion,
])

export const QuizQuestion = QuizQuestionShape.superRefine(checkQuestion)

/**
 * Every question type, DERIVED from the union above. Anything that needs to
 * enumerate them (an LLM's authoring contract, a picker in the admin) reads this
 * — so adding a question type makes the list grow by itself, and no hand-written
 * copy of it can go stale.
 */
export const QUIZ_TYPES = QuizQuestionShape.options.map((o) => o.shape.type.value) as string[]

/** A list of quiz questions (a quiz). Question ids must be unique. */
export const Quiz = z.array(QuizQuestion).superRefine((qs, ctx) => {
  const dup = findDuplicate(qs.map((q) => q.id))
  if (dup) ctx.addIssue({ code: 'custom', message: `duplicate question id "${dup}"` })
})

export type QuizItem = z.infer<typeof QuizItem>
export type FillSegment = z.infer<typeof FillSegment>
export type SingleChoiceQuestion = z.infer<typeof SingleChoiceQuestion>
export type MultipleChoiceQuestion = z.infer<typeof MultipleChoiceQuestion>
export type BooleanQuestion = z.infer<typeof BooleanQuestion>
export type FillBlankQuestion = z.infer<typeof FillBlankQuestion>
export type OrderQuestion = z.infer<typeof OrderQuestion>
export type MatchQuestion = z.infer<typeof MatchQuestion>
export type NumericQuestion = z.infer<typeof NumericQuestion>
export type WordBankQuestion = z.infer<typeof WordBankQuestion>
export type CategorizeQuestion = z.infer<typeof CategorizeQuestion>
export type HighlightQuestion = z.infer<typeof HighlightQuestion>
export type NumberLineQuestion = z.infer<typeof NumberLineQuestion>
export type ClockQuestion = z.infer<typeof ClockQuestion>
export type VennQuestion = z.infer<typeof VennQuestion>
export type VennRegion = z.infer<typeof VennRegion>
export type TableFillQuestion = z.infer<typeof TableFillQuestion>
export type TenFrameQuestion = z.infer<typeof TenFrameQuestion>
export type PartWholeQuestion = z.infer<typeof PartWholeQuestion>
export type PlaceValueQuestion = z.infer<typeof PlaceValueQuestion>
export type PatternQuestion = z.infer<typeof PatternQuestion>
export type DiagramHotspot = z.infer<typeof DiagramHotspot>
export type LabelQuestion = z.infer<typeof LabelQuestion>
export type HotspotFindQuestion = z.infer<typeof HotspotFindQuestion>
export type ArrowQuestion = z.infer<typeof ArrowQuestion>
export type ArrowEdge = { from: string; to: string }
export type WordSearchQuestion = z.infer<typeof WordSearchQuestion>
export type FractionQuestion = z.infer<typeof FractionQuestion>
export type CarrollQuestion = z.infer<typeof CarrollQuestion>
export type MoneyItem = z.infer<typeof MoneyItem>
export type CurrencyCode = z.infer<typeof Currency>
export type MoneyQuestion = z.infer<typeof MoneyQuestion>
export type BalanceQuestion = z.infer<typeof BalanceQuestion>
export type BarChartQuestion = z.infer<typeof BarChartQuestion>
export type RulerQuestion = z.infer<typeof RulerQuestion>
export type SymmetryQuestion = z.infer<typeof SymmetryQuestion>
export type AnnotateQuestion = z.infer<typeof AnnotateQuestion>
export type TallyQuestion = z.infer<typeof TallyQuestion>
export type PictogramQuestion = z.infer<typeof PictogramQuestion>
export type ArrayQuestion = z.infer<typeof ArrayQuestion>
export type RotationQuestion = z.infer<typeof RotationQuestion>
export type ScaleQuestion = z.infer<typeof ScaleQuestion>
export type DigitalClockQuestion = z.infer<typeof DigitalClockQuestion>
export type RouteQuestion = z.infer<typeof RouteQuestion>
export type CrosswordEntry = z.infer<typeof CrosswordEntry>
export type CrosswordQuestion = z.infer<typeof CrosswordQuestion>
export type MathQuestion = z.infer<typeof MathQuestion>
export type SpeechQuestion = z.infer<typeof SpeechQuestion>
export type GridShapeQuestion = z.infer<typeof GridShapeQuestion>
export type ChanceQuestion = z.infer<typeof ChanceQuestion>
export type SolidQuestion = z.infer<typeof SolidQuestion>
export type BranchKeyNode = z.infer<typeof BranchKeyNode>
export type BranchKeyQuestion = z.infer<typeof BranchKeyQuestion>
export type ProofreadQuestion = z.infer<typeof ProofreadQuestion>
export type CoordPoint = z.infer<typeof CoordPoint>
export type CoordinatesQuestion = z.infer<typeof CoordinatesQuestion>
export type AngleQuestion = z.infer<typeof AngleQuestion>
export type LineGraphQuestion = z.infer<typeof LineGraphQuestion>
export type WaffleQuestion = z.infer<typeof WaffleQuestion>
export type TranslationQuestion = z.infer<typeof TranslationQuestion>
export type CompassQuestion = z.infer<typeof CompassQuestion>
export type NetQuestion = z.infer<typeof NetQuestion>
export type DrawingQuestion = z.infer<typeof DrawingQuestion>
export type WritingQuestion = z.infer<typeof WritingQuestion>
export type EstimateQuestion = z.infer<typeof EstimateQuestion>
export type RubricCriterion = z.infer<typeof RubricCriterion>
export type Assist = z.infer<typeof Assist>
export type QuizQuestion = z.infer<typeof QuizQuestion>
export type QuizQuestionType = QuizQuestion['type']

/** Validate unknown data (e.g. LLM output) as a quiz. */
export function safeParseQuiz(data: unknown) {
  return Quiz.safeParse(data)
}

/** JSON Schema for a quiz — feed to an LLM as a structured-output / tool spec. */
export function quizJsonSchema(): unknown {
  return z.toJSONSchema(Quiz)
}

/* -------------------------------- Responses ------------------------------- */

export type QuizResponse =
  | { type: 'single'; choiceId: string | null }
  | { type: 'multiple'; choiceIds: string[] }
  | { type: 'boolean'; value: boolean | null }
  | { type: 'fill'; values: string[] }
  | { type: 'order'; order: string[] }
  | { type: 'match'; pairs: Record<string, string> }
  | { type: 'numeric'; value: string }
  | { type: 'wordbank'; picks: number[] }
  | { type: 'categorize'; assignment: Record<string, string> }
  | { type: 'highlight'; indexes: number[] }
  | { type: 'numberline'; value: number | null }
  | { type: 'clock'; hour: number | null; minute: number | null }
  | { type: 'venn'; assignment: Record<string, VennRegion> }
  | { type: 'tablefill'; values: Record<string, string> }
  | { type: 'tenframe'; count: number }
  | { type: 'partwhole'; value: string }
  | { type: 'placevalue'; tens: number; ones: number }
  | { type: 'pattern'; picks: string[] }
  | { type: 'label'; assignment: Record<string, string> }
  | { type: 'hotspot'; selected: string[] }
  | { type: 'arrow'; edges: ArrowEdge[] }
  | { type: 'wordsearch'; found: string[] }
  | { type: 'fraction'; shaded: number[] }
  | { type: 'carroll'; assignment: Record<string, string> }
  | { type: 'money'; picks: string[] }
  | { type: 'balance'; choice: 'lt' | 'eq' | 'gt' | null }
  | { type: 'barchart'; heights: Record<string, number> }
  | { type: 'ruler'; value: number | null }
  | { type: 'symmetry'; filled: string[] }
  | { type: 'annotate'; strokes: DrawStroke[] }
  | { type: 'tally'; counts: Record<string, number> }
  | { type: 'pictogram'; counts: Record<string, number> }
  | { type: 'array'; rows: number; cols: number }
  | { type: 'rotation'; position: number | null }
  | { type: 'scale'; value: number | null }
  | { type: 'digitalclock'; hour: number | null; minute: number | null }
  | { type: 'route'; path: string[] }
  | { type: 'crossword'; letters: Record<string, string> }
  | { type: 'math'; value: string }
  | { type: 'speech'; recorded: boolean; durationMs?: number }
  | { type: 'gridshape'; cells: string[] }
  | { type: 'chance'; assignment: Record<string, string> }
  | { type: 'solid'; selected: string[] }
  | { type: 'branchkey'; answers: Record<string, boolean> }
  | { type: 'proofread'; fixes: Record<string, string> }
  | { type: 'coordinates'; coords: Array<{ x: number; y: number } | null> }
  | { type: 'angle'; degrees: number | null; kind: AngleKind | null }
  | { type: 'linegraph'; values: Array<number | null> }
  | { type: 'waffle'; cells: Record<string, string> }
  | { type: 'translation'; dx: number | null; dy: number | null }
  | { type: 'compass'; direction: CompassDirection | null }
  | { type: 'net'; choice: string | null }
  | { type: 'drawing'; strokes: DrawStroke[]; met: string[] }
  | { type: 'writing'; text: string; met: string[] }
  | { type: 'estimate'; estimate: number | null; actual: number | null }

/** A fresh, empty response for a question — the UI's initial controlled value. */
export function emptyResponse(q: QuizQuestion): QuizResponse {
  switch (q.type) {
    case 'single':
      return { type: 'single', choiceId: null }
    case 'multiple':
      return { type: 'multiple', choiceIds: [] }
    case 'boolean':
      return { type: 'boolean', value: null }
    case 'fill':
      return { type: 'fill', values: q.answers.map(() => '') }
    case 'order':
      return { type: 'order', order: q.items.map((i) => i.id) }
    case 'match':
      return { type: 'match', pairs: {} }
    case 'numeric':
      return { type: 'numeric', value: '' }
    case 'wordbank':
      return { type: 'wordbank', picks: [] }
    case 'categorize':
      return { type: 'categorize', assignment: {} }
    case 'highlight':
      return { type: 'highlight', indexes: [] }
    case 'numberline':
      return { type: 'numberline', value: null }
    case 'clock':
      return { type: 'clock', hour: null, minute: null }
    case 'venn':
      return { type: 'venn', assignment: {} }
    case 'tablefill':
      return { type: 'tablefill', values: {} }
    case 'tenframe':
      return { type: 'tenframe', count: 0 }
    case 'partwhole':
      return { type: 'partwhole', value: '' }
    case 'placevalue':
      return { type: 'placevalue', tens: 0, ones: 0 }
    case 'pattern':
      return { type: 'pattern', picks: [] }
    case 'label':
      return { type: 'label', assignment: {} }
    case 'hotspot':
      return { type: 'hotspot', selected: [] }
    case 'arrow':
      return { type: 'arrow', edges: [] }
    case 'wordsearch':
      return { type: 'wordsearch', found: [] }
    case 'fraction':
      return { type: 'fraction', shaded: [] }
    case 'carroll':
      return { type: 'carroll', assignment: {} }
    case 'money':
      return { type: 'money', picks: [] }
    case 'balance':
      return { type: 'balance', choice: null }
    case 'barchart':
      return { type: 'barchart', heights: {} }
    case 'ruler':
      return { type: 'ruler', value: null }
    case 'symmetry':
      return { type: 'symmetry', filled: [] }
    case 'annotate':
      return { type: 'annotate', strokes: [] }
    case 'tally':
      return { type: 'tally', counts: {} }
    case 'pictogram':
      return { type: 'pictogram', counts: {} }
    case 'array':
      return { type: 'array', rows: 0, cols: 0 }
    case 'rotation':
      return { type: 'rotation', position: null }
    case 'scale':
      return { type: 'scale', value: null }
    case 'digitalclock':
      return { type: 'digitalclock', hour: null, minute: null }
    case 'route':
      return { type: 'route', path: [] }
    case 'crossword':
      return { type: 'crossword', letters: {} }
    case 'math':
      return { type: 'math', value: '' }
    case 'speech':
      return { type: 'speech', recorded: false }
    case 'gridshape':
      return { type: 'gridshape', cells: [] }
    case 'chance':
      return { type: 'chance', assignment: {} }
    case 'solid':
      return { type: 'solid', selected: [] }
    case 'branchkey':
      return { type: 'branchkey', answers: {} }
    case 'proofread':
      return { type: 'proofread', fixes: {} }
    case 'coordinates':
      return { type: 'coordinates', coords: [] }
    case 'angle':
      return { type: 'angle', degrees: null, kind: null }
    case 'linegraph':
      return { type: 'linegraph', values: [] }
    case 'waffle':
      return { type: 'waffle', cells: {} }
    case 'translation':
      return { type: 'translation', dx: null, dy: null }
    case 'compass':
      return { type: 'compass', direction: null }
    case 'net':
      return { type: 'net', choice: null }
    case 'drawing':
      return { type: 'drawing', strokes: [], met: [] }
    case 'writing':
      return { type: 'writing', text: '', met: [] }
    case 'estimate':
      return { type: 'estimate', estimate: null, actual: null }
  }
}

/** All blank cell ids of a table-fill question (in row-major order). */
export function tableBlankIds(q: TableFillQuestion): string[] {
  const ids: string[] = []
  for (const row of q.rows) for (const cell of row.cells) if (cell.blankId) ids.push(cell.blankId)
  return ids
}

/** Whether a response holds enough input to be checked (enables the Check button). */
export function isResponded(q: QuizQuestion, r: QuizResponse | undefined): boolean {
  if (!r) return false
  switch (q.type) {
    case 'single':
      return r.type === 'single' && r.choiceId != null
    case 'multiple':
      return r.type === 'multiple' && r.choiceIds.length > 0
    case 'boolean':
      return r.type === 'boolean' && r.value != null
    case 'fill':
      return (
        r.type === 'fill' && r.values.length === q.answers.length && r.values.every((v) => v.trim() !== '')
      )
    case 'order':
      return r.type === 'order' && r.order.length === q.items.length
    case 'match':
      return r.type === 'match' && Object.keys(r.pairs).length === q.left.length
    case 'numeric':
      return r.type === 'numeric' && r.value.trim() !== ''
    case 'wordbank':
      return r.type === 'wordbank' && r.picks.length === q.answer.length
    case 'categorize':
      return r.type === 'categorize' && q.items.every((it) => it.id in r.assignment)
    case 'highlight':
      return r.type === 'highlight' && r.indexes.length > 0
    case 'numberline':
      return r.type === 'numberline' && r.value != null
    case 'clock':
      return r.type === 'clock' && r.hour != null && r.minute != null
    case 'venn':
      return r.type === 'venn' && q.items.every((it) => it.id in r.assignment)
    case 'tablefill':
      return r.type === 'tablefill' && tableBlankIds(q).every((id) => (r.values[id] ?? '').trim() !== '')
    case 'tenframe':
      return r.type === 'tenframe' && r.count > 0
    case 'partwhole':
      return r.type === 'partwhole' && r.value.trim() !== ''
    case 'placevalue':
      return r.type === 'placevalue' && (r.tens > 0 || r.ones > 0)
    case 'pattern':
      return r.type === 'pattern' && r.picks.length === q.blanks
    case 'label':
      return r.type === 'label' && q.labels.every((l) => l.id in r.assignment)
    case 'hotspot':
      return r.type === 'hotspot' && r.selected.length > 0
    case 'arrow':
      return r.type === 'arrow' && r.edges.length > 0
    case 'wordsearch':
      return r.type === 'wordsearch' && r.found.length > 0
    case 'fraction':
      return r.type === 'fraction' && r.shaded.length > 0
    case 'carroll':
      return r.type === 'carroll' && q.items.every((it) => it.id in r.assignment)
    case 'money':
      return r.type === 'money' && r.picks.length > 0
    case 'balance':
      return r.type === 'balance' && r.choice != null
    case 'barchart':
      return r.type === 'barchart' && Object.values(r.heights).some((h) => h > 0)
    case 'ruler':
      return r.type === 'ruler' && r.value != null
    case 'symmetry':
      return r.type === 'symmetry' && r.filled.length > 0
    case 'annotate':
      return r.type === 'annotate' && r.strokes.length > 0
    case 'tally':
      return r.type === 'tally' && Object.values(r.counts).some((n) => n > 0)
    case 'pictogram':
      return r.type === 'pictogram' && Object.values(r.counts).some((n) => n > 0)
    case 'array':
      return r.type === 'array' && r.rows > 0 && r.cols > 0
    case 'rotation':
      return r.type === 'rotation' && r.position != null
    case 'scale':
      return r.type === 'scale' && r.value != null
    case 'digitalclock':
      return r.type === 'digitalclock' && r.hour != null && r.minute != null
    case 'route':
      return r.type === 'route' && r.path.length > 1
    case 'crossword':
      return r.type === 'crossword' && Object.values(r.letters).some((ch) => ch.trim() !== '')
    case 'math':
      return r.type === 'math' && r.value.trim() !== ''
    case 'speech':
      return r.type === 'speech' && r.recorded
    case 'gridshape':
      return r.type === 'gridshape' && r.cells.length > 0
    case 'chance':
      return r.type === 'chance' && q.items.every((it) => it.id in r.assignment)
    case 'solid':
      return r.type === 'solid' && r.selected.length > 0
    case 'branchkey':
      // Responded once the walk actually reaches a result.
      return r.type === 'branchkey' && traverseKey(q, r.answers) !== null
    case 'proofread':
      return r.type === 'proofread' && Object.values(r.fixes).some((v) => v.trim() !== '')
    case 'coordinates':
      return r.type === 'coordinates' && r.coords.some((pt) => pt !== null)
    case 'angle':
      return r.type === 'angle' && (q.task === 'classify' ? r.kind != null : r.degrees != null)
    case 'linegraph':
      return r.type === 'linegraph' && r.values.some((v) => v != null)
    case 'waffle':
      return r.type === 'waffle' && Object.keys(r.cells).length > 0
    case 'translation':
      return r.type === 'translation' && r.dx != null && r.dy != null && !(r.dx === 0 && r.dy === 0)
    case 'compass':
      return r.type === 'compass' && r.direction != null
    case 'net':
      return r.type === 'net' && r.choice != null
    case 'drawing':
      return r.type === 'drawing' && r.strokes.length > 0
    case 'writing':
      return r.type === 'writing' && countWords(r.text) >= (q.minWords ?? 1)
    // The estimate is the point of the exercise — you cannot check without making one.
    case 'estimate':
      return r.type === 'estimate' && r.estimate != null && r.actual != null
  }
}

/* --------------------------------- Grading -------------------------------- */

export interface Grade {
  /** Fully correct (score === 1). */
  correct: boolean
  /** Partial credit 0–1 (multiple / order / match can land in between). */
  score: number
}

/** Normalize free text for comparison: trim, collapse inner whitespace, lowercase. */
function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

const fraction = (hit: number, total: number): number => (total === 0 ? 0 : clamp(hit / total, 0, 1))
const grade = (score: number): Grade => ({ correct: score >= 1, score: clamp(score, 0, 1) })

/** Grade a single response against its question. Pure — same result everywhere. */
export function gradeQuestion(q: QuizQuestion, r: QuizResponse | undefined): Grade {
  if (!r || r.type !== q.type) return grade(0)
  switch (q.type) {
    case 'single':
      return grade(r.type === 'single' && r.choiceId === q.answerId ? 1 : 0)

    case 'boolean':
      return grade(r.type === 'boolean' && r.value === q.answer ? 1 : 0)

    case 'multiple': {
      if (r.type !== 'multiple') return grade(0)
      const correct = new Set(q.answerIds)
      const picked = new Set(r.choiceIds)
      let hits = 0
      let wrong = 0
      for (const id of picked) {
        if (correct.has(id)) hits++
        else wrong++
      }
      // Reward correct picks, penalize wrong ones, floor at 0.
      return grade(fraction(hits - wrong, correct.size))
    }

    case 'fill': {
      if (r.type !== 'fill') return grade(0)
      let hits = 0
      q.answers.forEach((accepted, i) => {
        const given = normalizeText(r.values[i] ?? '')
        if (given !== '' && accepted.some((a) => normalizeText(a) === given)) hits++
      })
      return grade(fraction(hits, q.answers.length))
    }

    case 'order': {
      if (r.type !== 'order') return grade(0)
      let hits = 0
      q.correctOrder.forEach((id, i) => {
        if (r.order[i] === id) hits++
      })
      return grade(fraction(hits, q.correctOrder.length))
    }

    case 'match': {
      if (r.type !== 'match') return grade(0)
      const ids = Object.keys(q.pairs)
      let hits = 0
      for (const leftId of ids) if (r.pairs[leftId] === q.pairs[leftId]) hits++
      return grade(fraction(hits, ids.length))
    }

    case 'numeric': {
      if (r.type !== 'numeric') return grade(0)
      const value = parseNumericInput(r.value)
      if (value == null) return grade(0)
      return grade(Math.abs(value - q.answer) <= (q.tolerance ?? 0) ? 1 : 0)
    }

    case 'wordbank': {
      if (r.type !== 'wordbank') return grade(0)
      let hits = 0
      q.answer.forEach((token, i) => {
        const pick = r.picks[i]
        if (pick != null && q.bank[pick] === token) hits++
      })
      const complete = r.picks.length === q.answer.length
      const score = fraction(hits, q.answer.length)
      return { correct: complete && score >= 1, score }
    }

    case 'categorize': {
      if (r.type !== 'categorize') return grade(0)
      let hits = 0
      for (const item of q.items) if (r.assignment[item.id] === q.assignment[item.id]) hits++
      return grade(fraction(hits, q.items.length))
    }

    case 'highlight': {
      if (r.type !== 'highlight') return grade(0)
      const correct = new Set(q.correctIndexes)
      let hits = 0
      let wrong = 0
      for (const idx of r.indexes) {
        if (correct.has(idx)) hits++
        else wrong++
      }
      // Like `multiple`: reward correct picks, penalize wrong ones, floor at 0.
      return grade(fraction(hits - wrong, correct.size))
    }

    case 'numberline': {
      if (r.type !== 'numberline' || r.value == null) return grade(0)
      // Correct if within half a step of the target (snap tolerance).
      return grade(Math.abs(r.value - q.answer) <= q.step / 2 ? 1 : 0)
    }

    case 'clock': {
      if (r.type !== 'clock' || r.hour == null || r.minute == null) return grade(0)
      return grade(r.hour % 12 === q.answerHour % 12 && r.minute === q.answerMinute ? 1 : 0)
    }

    case 'venn': {
      if (r.type !== 'venn') return grade(0)
      let hits = 0
      for (const item of q.items) if (r.assignment[item.id] === q.assignment[item.id]) hits++
      return grade(fraction(hits, q.items.length))
    }

    case 'tablefill': {
      if (r.type !== 'tablefill') return grade(0)
      const blanks = tableBlankIds(q)
      const answerFor = new Map<string, string[]>()
      for (const row of q.rows)
        for (const cell of row.cells) if (cell.blankId) answerFor.set(cell.blankId, cell.answers ?? [])
      let hits = 0
      for (const id of blanks) {
        const given = normalizeText(r.values[id] ?? '')
        const accepted = answerFor.get(id) ?? []
        if (given !== '' && accepted.some((a) => normalizeText(a) === given)) hits++
      }
      return grade(fraction(hits, blanks.length))
    }

    case 'tenframe':
      return grade(r.type === 'tenframe' && r.count === q.answer ? 1 : 0)

    case 'partwhole': {
      if (r.type !== 'partwhole') return grade(0)
      const v = parseNumericInput(r.value)
      return grade(v != null && v === q.answer ? 1 : 0)
    }

    case 'placevalue':
      return grade(r.type === 'placevalue' && r.tens * 10 + r.ones === q.answer ? 1 : 0)

    case 'pattern': {
      if (r.type !== 'pattern') return grade(0)
      let hits = 0
      q.answer.forEach((id, i) => {
        if (r.picks[i] === id) hits++
      })
      return grade(fraction(hits, q.answer.length))
    }

    case 'label': {
      if (r.type !== 'label') return grade(0)
      let hits = 0
      for (const label of q.labels) if (r.assignment[label.id] === q.answer[label.id]) hits++
      return grade(fraction(hits, q.labels.length))
    }

    case 'hotspot': {
      if (r.type !== 'hotspot') return grade(0)
      const correct = new Set(q.correctIds)
      let hits = 0
      let wrong = 0
      for (const id of r.selected) {
        if (correct.has(id)) hits++
        else wrong++
      }
      return grade(fraction(hits - wrong, correct.size))
    }

    case 'arrow': {
      if (r.type !== 'arrow') return grade(0)
      const key = (e: ArrowEdge) =>
        q.directed === false ? [e.from, e.to].sort().join('-') : `${e.from}->${e.to}`
      const want = new Set(q.answer.map(key))
      const seen = new Set<string>()
      let hits = 0
      let wrong = 0
      for (const e of r.edges) {
        const k = key(e)
        if (seen.has(k)) continue
        seen.add(k)
        if (want.has(k)) hits++
        else wrong++
      }
      return grade(fraction(hits - wrong, want.size))
    }

    case 'wordsearch': {
      if (r.type !== 'wordsearch') return grade(0)
      const target = new Set(q.words.map((w) => w.toUpperCase()))
      const found = new Set(r.found.map((w) => w.toUpperCase()))
      let hits = 0
      for (const w of target) if (found.has(w)) hits++
      return grade(fraction(hits, target.size))
    }

    case 'fraction': {
      if (r.type !== 'fraction') return grade(0)
      return grade(r.shaded.length === q.answer ? 1 : 0)
    }

    case 'carroll': {
      if (r.type !== 'carroll') return grade(0)
      let hits = 0
      for (const item of q.items) if (r.assignment[item.id] === q.answer[item.id]) hits++
      return grade(fraction(hits, q.items.length))
    }

    case 'money': {
      if (r.type !== 'money') return grade(0)
      const byId = new Map(q.denominations.map((dn) => [dn.id, dn.value]))
      const total = r.picks.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0)
      return grade(total === q.target ? 1 : 0)
    }

    case 'balance': {
      if (r.type !== 'balance') return grade(0)
      return grade(r.choice === q.answer ? 1 : 0)
    }

    case 'barchart': {
      if (r.type !== 'barchart') return grade(0)
      let hits = 0
      for (const c of q.categories) if ((r.heights[c.id] ?? 0) === (q.answer[c.id] ?? 0)) hits++
      return grade(fraction(hits, q.categories.length))
    }

    case 'ruler': {
      if (r.type !== 'ruler') return grade(0)
      return grade(r.value === q.start + q.length ? 1 : 0)
    }

    case 'symmetry': {
      if (r.type !== 'symmetry') return grade(0)
      if (q.mode === 'design') {
        const all = [...new Set([...q.filled, ...r.filled])]
        const ok = all.length === q.cellCount && isSymmetricSet(all, q.rows, q.cols, q.axis)
        return grade(ok ? 1 : 0)
      }
      const expected = new Set(symmetryExpected(q))
      let hits = 0
      let wrong = 0
      for (const key of new Set(r.filled)) {
        if (expected.has(key)) hits++
        else wrong++
      }
      return grade(fraction(hits - wrong, expected.size))
    }

    case 'annotate':
      // Open response: any annotation counts (teacher/self review).
      return grade(r.type === 'annotate' && r.strokes.length > 0 ? 1 : 0)

    case 'tally': {
      if (r.type !== 'tally') return grade(0)
      let hits = 0
      for (const c of q.categories) if ((r.counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)) hits++
      return grade(fraction(hits, q.categories.length))
    }

    case 'pictogram': {
      if (r.type !== 'pictogram') return grade(0)
      let hits = 0
      for (const c of q.categories) if ((r.counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)) hits++
      return grade(fraction(hits, q.categories.length))
    }

    case 'array': {
      if (r.type !== 'array') return grade(0)
      const exact = r.rows === q.answer.rows && r.cols === q.answer.cols
      const flipped = q.allowTranspose && r.rows === q.answer.cols && r.cols === q.answer.rows
      return grade(exact || flipped ? 1 : 0)
    }

    case 'rotation': {
      if (r.type !== 'rotation') return grade(0)
      return grade(r.position === q.answer ? 1 : 0)
    }

    case 'scale': {
      if (r.type !== 'scale') return grade(0)
      return grade(r.value === q.answer ? 1 : 0)
    }

    case 'digitalclock': {
      if (r.type !== 'digitalclock') return grade(0)
      return grade(r.hour === q.answer.hour && r.minute === q.answer.minute ? 1 : 0)
    }

    case 'route': {
      if (r.type !== 'route') return grade(0)
      return grade(isValidRoute(q, r.path) ? 1 : 0)
    }

    case 'crossword': {
      if (r.type !== 'crossword') return grade(0)
      const { expected } = crosswordCells(q)
      const keys = Object.keys(expected)
      let hits = 0
      for (const k of keys) if ((r.letters[k] ?? '').toUpperCase() === expected[k]) hits++
      return grade(fraction(hits, keys.length))
    }

    case 'math': {
      if (r.type !== 'math') return grade(0)
      if (q.gradeMode === 'exact') return grade(normalizeMath(r.value) === normalizeMath(q.answer) ? 1 : 0)
      const a = evalMath(q.answer)
      const v = evalMath(r.value)
      return grade(a !== null && v !== null && Math.abs(a - v) <= q.tolerance ? 1 : 0)
    }

    case 'speech':
      // Open response: recording your voice counts (teacher/self review; ASR later).
      return grade(r.type === 'speech' && r.recorded ? 1 : 0)

    case 'gridshape': {
      if (r.type !== 'gridshape') return grade(0)
      const all = [...new Set([...q.given, ...r.cells])]
      if (all.length === 0) return grade(0)
      if (q.requireContiguous && !isContiguous(all)) return grade(0)
      const t = q.target
      if (t.cells && JSON.stringify([...all].sort()) !== JSON.stringify([...new Set(t.cells)].sort()))
        return grade(0)
      if (t.area !== undefined && gridArea(all) !== t.area) return grade(0)
      if (t.perimeter !== undefined && gridPerimeter(all) !== t.perimeter) return grade(0)
      return grade(1)
    }

    case 'chance': {
      if (r.type !== 'chance') return grade(0)
      let hits = 0
      for (const it of q.items) if (r.assignment[it.id] === q.answer[it.id]) hits++
      return grade(fraction(hits, q.items.length))
    }

    case 'solid': {
      if (r.type !== 'solid') return grade(0)
      const want = new Set(solidPartIds(makeSolid(q.shape as Solid3DName), q.task as SolidPartKind))
      const got = new Set(r.selected)
      let hits = 0
      let wrong = 0
      for (const id of got) {
        if (want.has(id)) hits++
        else wrong++
      }
      return grade(fraction(hits - wrong, want.size))
    }

    case 'branchkey': {
      if (r.type !== 'branchkey') return grade(0)
      return grade(traverseKey(q, r.answers) === q.answer ? 1 : 0)
    }

    case 'proofread': {
      if (r.type !== 'proofread') return grade(0)
      const norm = (t: string) => t.trim().toLowerCase()
      let hits = 0
      let wrong = 0
      for (const [idx, typed] of Object.entries(r.fixes)) {
        if (norm(typed) === '') continue
        const expected = q.errors[idx]
        // Editing a token that was never wrong costs a mark.
        if (expected === undefined) wrong++
        else if (norm(typed) === norm(expected)) hits++
        else wrong++
      }
      return grade(fraction(hits - wrong, Object.keys(q.errors).length))
    }

    case 'coordinates': {
      if (r.type !== 'coordinates') return grade(0)
      if (q.task === 'plot') {
        // Order doesn't matter — compare the SETS of plotted points.
        const key = (p: { x: number; y: number }) => `${p.x},${p.y}`
        const want = new Set(q.coords.map(key))
        const got = new Set(r.coords.filter((p): p is { x: number; y: number } => p !== null).map(key))
        let hits = 0
        let wrong = 0
        for (const k of got) {
          if (want.has(k)) hits++
          else wrong++
        }
        return grade(fraction(hits - wrong, want.size))
      }
      // read: the learner writes the coordinates of each marked point, in order.
      let hits = 0
      q.coords.forEach((pt, i) => {
        const got = r.coords[i]
        if (got && got.x === pt.x && got.y === pt.y) hits++
      })
      return grade(fraction(hits, q.coords.length))
    }

    case 'angle': {
      if (r.type !== 'angle') return grade(0)
      if (q.task === 'classify') return grade(r.kind === classifyAngle(q.angle) ? 1 : 0)
      if (r.degrees === null) return grade(0)
      return grade(Math.abs(r.degrees - q.angle) <= q.tolerance ? 1 : 0)
    }

    case 'linegraph': {
      if (r.type !== 'linegraph') return grade(0)
      let hits = 0
      q.answer.forEach((want, i) => {
        if (r.values[i] === want) hits++
      })
      return grade(fraction(hits, q.answer.length))
    }

    case 'waffle': {
      if (r.type !== 'waffle') return grade(0)
      const counts: Record<string, number> = {}
      for (const catId of Object.values(r.cells)) counts[catId] = (counts[catId] ?? 0) + 1
      let hits = 0
      for (const c of q.categories) if ((counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)) hits++
      return grade(fraction(hits, q.categories.length))
    }

    case 'translation': {
      if (r.type !== 'translation') return grade(0)
      return grade(r.dx === q.dx && r.dy === q.dy ? 1 : 0)
    }

    case 'compass': {
      if (r.type !== 'compass') return grade(0)
      const a = q.places.find((p) => p.id === q.from)
      const b = q.places.find((p) => p.id === q.to)
      if (!a || !b) return grade(0)
      return grade(r.direction === compassDirection(a, b) ? 1 : 0)
    }

    case 'net': {
      if (r.type !== 'net') return grade(0)
      const want = netAnswer(q)
      return grade(want !== null && r.choice === want ? 1 : 0)
    }

    // Open work: the learner's own tick-list against the success criteria.
    case 'drawing':
    case 'writing': {
      if (r.type !== q.type) return grade(0)
      const ids = new Set(q.criteria.map((c) => c.id))
      const met = new Set(r.met.filter((id) => ids.has(id)))
      const need = q.pass ?? q.criteria.length
      const result = grade(fraction(met.size, q.criteria.length))
      return { ...result, correct: met.size >= need }
    }

    // Only the ACTUAL value is marked — an estimate is never right or wrong.
    case 'estimate': {
      if (r.type !== 'estimate') return grade(0)
      return grade(r.actual === q.actual ? 1 : 0)
    }
  }
}

/** Parse learner numeric input: trims, accepts comma decimals ("3,5" → 3.5). */
export function parseNumericInput(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.')
  if (cleaned === '' || !/^[-+]?\d*\.?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/* --------------------------------- Reveal --------------------------------- */

/** Per-choice reveal marker. */
export type ChoiceReveal = 'correct' | 'incorrect'

/**
 * The correctness detail a UI needs to *show* a checked answer, computed once
 * here so web and native reveal it identically. Returned only after a `check`.
 */
export type QuestionReveal =
  | { type: 'single' | 'multiple'; choices: Record<string, ChoiceReveal> }
  | { type: 'boolean'; answer: boolean }
  | { type: 'fill'; blanks: boolean[] }
  | { type: 'order'; items: Record<string, boolean> }
  | { type: 'match'; left: Record<string, boolean> }
  | { type: 'numeric'; correct: boolean; answer: number }
  | { type: 'wordbank'; positions: boolean[]; answer: string[] }
  | { type: 'categorize'; items: Record<string, boolean> }
  | { type: 'highlight'; tokens: Record<number, ChoiceReveal> }
  | { type: 'numberline'; correct: boolean; answer: number }
  | { type: 'clock'; correct: boolean; hour: number; minute: number }
  | { type: 'venn'; items: Record<string, boolean>; answer: Record<string, VennRegion> }
  | { type: 'tablefill'; cells: Record<string, boolean> }
  | { type: 'tenframe'; correct: boolean; answer: number }
  | { type: 'partwhole'; correct: boolean; answer: number }
  | { type: 'placevalue'; correct: boolean; answer: number }
  | { type: 'pattern'; positions: boolean[]; answer: string[] }
  | { type: 'label'; items: Record<string, boolean>; answer: Record<string, string> }
  | { type: 'hotspot'; spots: Record<string, ChoiceReveal> }
  | {
      type: 'arrow'
      answer: ArrowEdge[]
      marks: Array<{ from: string; to: string; ok: boolean }>
    }
  | { type: 'wordsearch'; words: string[]; found: string[] }
  | { type: 'fraction'; correct: boolean; answer: number; parts: number }
  | { type: 'carroll'; items: Record<string, boolean>; answer: Record<string, string> }
  | { type: 'money'; correct: boolean; target: number; total: number }
  | { type: 'balance'; correct: boolean; answer: 'lt' | 'eq' | 'gt' }
  | { type: 'barchart'; cells: Record<string, boolean>; answer: Record<string, number> }
  | { type: 'ruler'; correct: boolean; answer: number }
  | {
      type: 'symmetry'
      mode: 'mirror' | 'design'
      correct: boolean
      expected: string[]
      filled: string[]
    }
  | { type: 'annotate' }
  | { type: 'tally'; cells: Record<string, boolean>; answer: Record<string, number> }
  | { type: 'pictogram'; cells: Record<string, boolean>; answer: Record<string, number> }
  | { type: 'array'; correct: boolean; rows: number; cols: number }
  | { type: 'rotation'; correct: boolean; answer: number }
  | { type: 'scale'; correct: boolean; answer: number }
  | { type: 'digitalclock'; correct: boolean; hour: number; minute: number }
  | { type: 'route'; correct: boolean; target: string; solution: string[] }
  | { type: 'crossword'; cells: Record<string, { expected: string; ok: boolean }> }
  | { type: 'math'; correct: boolean; answer: string }
  | { type: 'speech' }
  | {
      type: 'gridshape'
      correct: boolean
      area: number
      perimeter: number
      target: { area?: number; perimeter?: number; cells?: string[] }
    }
  | { type: 'chance'; items: Record<string, boolean>; answer: Record<string, string> }
  | { type: 'solid'; correct: boolean; expected: string[]; count: number }
  | { type: 'branchkey'; correct: boolean; reached: string | null; answer: string }
  | {
      type: 'proofread'
      marks: Record<string, { ok: boolean; expected?: string }>
      errors: Record<string, string>
    }
  | {
      type: 'coordinates'
      correct: boolean
      marks: Array<boolean>
      answer: Array<{ x: number; y: number; label?: string }>
    }
  | { type: 'angle'; correct: boolean; answer: number; kind: AngleKind }
  | { type: 'linegraph'; correct: boolean; marks: boolean[]; answer: number[] }
  | {
      type: 'waffle'
      correct: boolean
      cells: Record<string, boolean>
      counts: Record<string, number>
      answer: Record<string, number>
    }
  | { type: 'translation'; correct: boolean; dx: number; dy: number }
  | { type: 'compass'; correct: boolean; answer: CompassDirection | null }
  | { type: 'net'; correct: boolean; answer: string | null }
  | {
      type: 'drawing'
      correct: boolean
      met: string[]
      need: number
      exemplarImage?: string
    }
  | { type: 'writing'; correct: boolean; met: string[]; need: number; exemplar?: string }
  | {
      type: 'estimate'
      correct: boolean
      actual: number
      /** The learner's estimate landed within `tolerance` of the true value. */
      close: boolean
      off: number | null
    }

/** Which blanks of a fill question are correct (index-aligned with `answers`). */
export function fillBlankResults(q: FillBlankQuestion, values: string[]): boolean[] {
  return q.answers.map((accepted, i) => {
    const given = normalizeText(values[i] ?? '')
    return given !== '' && accepted.some((a) => normalizeText(a) === given)
  })
}

/** Build the reveal detail for a question + response (call after checking). */
export function revealFor(q: QuizQuestion, r: QuizResponse | undefined): QuestionReveal {
  switch (q.type) {
    case 'single': {
      const picked = r?.type === 'single' ? r.choiceId : null
      const choices: Record<string, ChoiceReveal> = { [q.answerId]: 'correct' }
      if (picked && picked !== q.answerId) choices[picked] = 'incorrect'
      return { type: 'single', choices }
    }
    case 'multiple': {
      const picked = new Set(r?.type === 'multiple' ? r.choiceIds : [])
      const correct = new Set(q.answerIds)
      const choices: Record<string, ChoiceReveal> = {}
      for (const id of correct) choices[id] = 'correct'
      for (const id of picked) if (!correct.has(id)) choices[id] = 'incorrect'
      return { type: 'multiple', choices }
    }
    case 'boolean':
      return { type: 'boolean', answer: q.answer }
    case 'fill':
      return { type: 'fill', blanks: fillBlankResults(q, r?.type === 'fill' ? r.values : []) }
    case 'order': {
      const order = r?.type === 'order' ? r.order : []
      const items: Record<string, boolean> = {}
      order.forEach((id, i) => {
        items[id] = q.correctOrder[i] === id
      })
      return { type: 'order', items }
    }
    case 'match': {
      const pairs = r?.type === 'match' ? r.pairs : {}
      const left: Record<string, boolean> = {}
      for (const id of Object.keys(q.pairs)) left[id] = pairs[id] === q.pairs[id]
      return { type: 'match', left }
    }
    case 'numeric': {
      const value = r?.type === 'numeric' ? parseNumericInput(r.value) : null
      const correct = value != null && Math.abs(value - q.answer) <= (q.tolerance ?? 0)
      return { type: 'numeric', correct, answer: q.answer }
    }
    case 'wordbank': {
      const picks = r?.type === 'wordbank' ? r.picks : []
      const positions = q.answer.map((token, i) => {
        const pick = picks[i]
        return pick != null && q.bank[pick] === token
      })
      return { type: 'wordbank', positions, answer: q.answer }
    }
    case 'categorize': {
      const assignment = r?.type === 'categorize' ? r.assignment : {}
      const items: Record<string, boolean> = {}
      for (const item of q.items) items[item.id] = assignment[item.id] === q.assignment[item.id]
      return { type: 'categorize', items }
    }
    case 'highlight': {
      const picked = new Set(r?.type === 'highlight' ? r.indexes : [])
      const tokens: Record<number, ChoiceReveal> = {}
      for (const idx of q.correctIndexes) tokens[idx] = 'correct'
      for (const idx of picked) if (!q.correctIndexes.includes(idx)) tokens[idx] = 'incorrect'
      return { type: 'highlight', tokens }
    }
    case 'numberline': {
      const value = r?.type === 'numberline' ? r.value : null
      return {
        type: 'numberline',
        correct: value != null && Math.abs(value - q.answer) <= q.step / 2,
        answer: q.answer,
      }
    }
    case 'clock': {
      const hour = r?.type === 'clock' ? r.hour : null
      const minute = r?.type === 'clock' ? r.minute : null
      const correct =
        hour != null && minute != null && hour % 12 === q.answerHour % 12 && minute === q.answerMinute
      return { type: 'clock', correct, hour: q.answerHour, minute: q.answerMinute }
    }
    case 'venn': {
      const assignment = r?.type === 'venn' ? r.assignment : {}
      const items: Record<string, boolean> = {}
      for (const item of q.items) items[item.id] = assignment[item.id] === q.assignment[item.id]
      return { type: 'venn', items, answer: q.assignment }
    }
    case 'tablefill': {
      const values = r?.type === 'tablefill' ? r.values : {}
      const cells: Record<string, boolean> = {}
      for (const row of q.rows)
        for (const cell of row.cells)
          if (cell.blankId) {
            const given = normalizeText(values[cell.blankId] ?? '')
            cells[cell.blankId] = given !== '' && (cell.answers ?? []).some((a) => normalizeText(a) === given)
          }
      return { type: 'tablefill', cells }
    }
    case 'tenframe': {
      const count = r?.type === 'tenframe' ? r.count : -1
      return { type: 'tenframe', correct: count === q.answer, answer: q.answer }
    }
    case 'partwhole': {
      const v = r?.type === 'partwhole' ? parseNumericInput(r.value) : null
      return { type: 'partwhole', correct: v === q.answer, answer: q.answer }
    }
    case 'placevalue': {
      const value = r?.type === 'placevalue' ? r.tens * 10 + r.ones : -1
      return { type: 'placevalue', correct: value === q.answer, answer: q.answer }
    }
    case 'pattern': {
      const picks = r?.type === 'pattern' ? r.picks : []
      const positions = q.answer.map((id, i) => picks[i] === id)
      return { type: 'pattern', positions, answer: q.answer }
    }
    case 'label': {
      const assignment = r?.type === 'label' ? r.assignment : {}
      const items: Record<string, boolean> = {}
      for (const label of q.labels) items[label.id] = assignment[label.id] === q.answer[label.id]
      return { type: 'label', items, answer: q.answer }
    }
    case 'hotspot': {
      const picked = new Set(r?.type === 'hotspot' ? r.selected : [])
      const spots: Record<string, ChoiceReveal> = {}
      for (const id of q.correctIds) spots[id] = 'correct'
      for (const id of picked) if (!q.correctIds.includes(id)) spots[id] = 'incorrect'
      return { type: 'hotspot', spots }
    }
    case 'arrow': {
      const edges = r?.type === 'arrow' ? r.edges : []
      const key = (e: ArrowEdge) =>
        q.directed === false ? [e.from, e.to].sort().join('-') : `${e.from}->${e.to}`
      const want = new Set(q.answer.map(key))
      const marks = edges.map((e) => ({ from: e.from, to: e.to, ok: want.has(key(e)) }))
      return { type: 'arrow', answer: q.answer, marks }
    }
    case 'wordsearch': {
      const found = r?.type === 'wordsearch' ? r.found.map((w) => w.toUpperCase()) : []
      return { type: 'wordsearch', words: q.words, found }
    }
    case 'fraction': {
      const shaded = r?.type === 'fraction' ? r.shaded.length : -1
      return { type: 'fraction', correct: shaded === q.answer, answer: q.answer, parts: q.parts }
    }
    case 'carroll': {
      const assignment = r?.type === 'carroll' ? r.assignment : {}
      const items: Record<string, boolean> = {}
      for (const item of q.items) items[item.id] = assignment[item.id] === q.answer[item.id]
      return { type: 'carroll', items, answer: q.answer }
    }
    case 'money': {
      const byId = new Map(q.denominations.map((dn) => [dn.id, dn.value]))
      const picks = r?.type === 'money' ? r.picks : []
      const total = picks.reduce((sum, id) => sum + (byId.get(id) ?? 0), 0)
      return { type: 'money', correct: total === q.target, target: q.target, total }
    }
    case 'balance':
      return {
        type: 'balance',
        correct: (r?.type === 'balance' ? r.choice : null) === q.answer,
        answer: q.answer,
      }
    case 'barchart': {
      const heights = r?.type === 'barchart' ? r.heights : {}
      const cells: Record<string, boolean> = {}
      for (const c of q.categories) cells[c.id] = (heights[c.id] ?? 0) === (q.answer[c.id] ?? 0)
      return { type: 'barchart', cells, answer: q.answer }
    }
    case 'ruler': {
      const value = r?.type === 'ruler' ? r.value : null
      const answer = q.start + q.length
      return { type: 'ruler', correct: value === answer, answer }
    }
    case 'symmetry':
      return {
        type: 'symmetry',
        mode: q.mode,
        correct: gradeQuestion(q, r).correct,
        expected: q.mode === 'design' ? [] : symmetryExpected(q),
        filled: r?.type === 'symmetry' ? r.filled : [],
      }
    case 'annotate':
      return { type: 'annotate' }
    case 'tally': {
      const counts = r?.type === 'tally' ? r.counts : {}
      const cells: Record<string, boolean> = {}
      for (const c of q.categories) cells[c.id] = (counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)
      return { type: 'tally', cells, answer: q.answer }
    }
    case 'pictogram': {
      const counts = r?.type === 'pictogram' ? r.counts : {}
      const cells: Record<string, boolean> = {}
      for (const c of q.categories) cells[c.id] = (counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)
      return { type: 'pictogram', cells, answer: q.answer }
    }
    case 'array': {
      const rows = r?.type === 'array' ? r.rows : 0
      const cols = r?.type === 'array' ? r.cols : 0
      const exact = rows === q.answer.rows && cols === q.answer.cols
      const flipped = q.allowTranspose === true && rows === q.answer.cols && cols === q.answer.rows
      return { type: 'array', correct: exact || flipped, rows: q.answer.rows, cols: q.answer.cols }
    }
    case 'rotation':
      return {
        type: 'rotation',
        correct: (r?.type === 'rotation' ? r.position : null) === q.answer,
        answer: q.answer,
      }
    case 'scale':
      return {
        type: 'scale',
        correct: (r?.type === 'scale' ? r.value : null) === q.answer,
        answer: q.answer,
      }
    case 'digitalclock': {
      const hour = r?.type === 'digitalclock' ? r.hour : null
      const minute = r?.type === 'digitalclock' ? r.minute : null
      return {
        type: 'digitalclock',
        correct: hour === q.answer.hour && minute === q.answer.minute,
        hour: q.answer.hour,
        minute: q.answer.minute,
      }
    }
    case 'route': {
      const path = r?.type === 'route' ? r.path : []
      return {
        type: 'route',
        correct: isValidRoute(q, path),
        target: q.target,
        solution: routeSolution(q) ?? [],
      }
    }
    case 'crossword': {
      const { expected } = crosswordCells(q)
      const letters = r?.type === 'crossword' ? r.letters : {}
      const cells: Record<string, { expected: string; ok: boolean }> = {}
      for (const k of Object.keys(expected))
        cells[k] = { expected: expected[k]!, ok: (letters[k] ?? '').toUpperCase() === expected[k] }
      return { type: 'crossword', cells }
    }
    case 'math': {
      const value = r?.type === 'math' ? r.value : ''
      const correct =
        q.gradeMode === 'exact'
          ? normalizeMath(value) === normalizeMath(q.answer)
          : (() => {
              const a = evalMath(q.answer)
              const v = evalMath(value)
              return a !== null && v !== null && Math.abs(a - v) <= q.tolerance
            })()
      return { type: 'math', correct, answer: q.answer }
    }
    case 'speech':
      return { type: 'speech' }
    case 'gridshape': {
      const cells = r?.type === 'gridshape' ? r.cells : []
      const all = [...new Set([...q.given, ...cells])]
      return {
        type: 'gridshape',
        correct: gradeQuestion(q, r).correct,
        area: gridArea(all),
        perimeter: gridPerimeter(all),
        target: q.target,
      }
    }
    case 'chance': {
      const assignment = r?.type === 'chance' ? r.assignment : {}
      const items: Record<string, boolean> = {}
      for (const it of q.items) items[it.id] = assignment[it.id] === q.answer[it.id]
      return { type: 'chance', items, answer: q.answer }
    }
    case 'solid': {
      const expected = solidPartIds(makeSolid(q.shape as Solid3DName), q.task as SolidPartKind)
      return {
        type: 'solid',
        correct: gradeQuestion(q, r).correct,
        expected,
        count: expected.length,
      }
    }
    case 'branchkey': {
      const answers = r?.type === 'branchkey' ? r.answers : {}
      const reached = traverseKey(q, answers)
      return { type: 'branchkey', correct: reached === q.answer, reached, answer: q.answer }
    }
    case 'proofread': {
      const fixes = r?.type === 'proofread' ? r.fixes : {}
      const norm = (t: string) => t.trim().toLowerCase()
      const marks: Record<string, { ok: boolean; expected?: string }> = {}
      // Every real mistake: was it fixed correctly?
      for (const [idx, expected] of Object.entries(q.errors))
        marks[idx] = { ok: norm(fixes[idx] ?? '') === norm(expected), expected }
      // Tokens the learner edited that were never wrong.
      for (const [idx, typed] of Object.entries(fixes))
        if (norm(typed) !== '' && q.errors[idx] === undefined) marks[idx] = { ok: false }
      return { type: 'proofread', marks, errors: q.errors }
    }
    case 'coordinates': {
      const got = r?.type === 'coordinates' ? r.coords : []
      const marks =
        q.task === 'plot'
          ? got.map((p) => !!p && q.coords.some((t) => t.x === p.x && t.y === p.y))
          : q.coords.map((t, i) => {
              const g = got[i]
              return !!g && g.x === t.x && g.y === t.y
            })
      return { type: 'coordinates', correct: gradeQuestion(q, r).correct, marks, answer: q.coords }
    }
    case 'angle':
      return {
        type: 'angle',
        correct: gradeQuestion(q, r).correct,
        answer: q.angle,
        kind: classifyAngle(q.angle),
      }
    case 'linegraph': {
      const values = r?.type === 'linegraph' ? r.values : []
      return {
        type: 'linegraph',
        correct: gradeQuestion(q, r).correct,
        marks: q.answer.map((want, i) => values[i] === want),
        answer: q.answer,
      }
    }
    case 'waffle': {
      const cells = r?.type === 'waffle' ? r.cells : {}
      const counts: Record<string, number> = {}
      for (const catId of Object.values(cells)) counts[catId] = (counts[catId] ?? 0) + 1
      const catOk: Record<string, boolean> = {}
      for (const c of q.categories) catOk[c.id] = (counts[c.id] ?? 0) === (q.answer[c.id] ?? 0)
      // Per-cell: is the category it was painted with one whose count is right?
      const cellOk: Record<string, boolean> = {}
      for (const [idx, catId] of Object.entries(cells)) cellOk[idx] = catOk[catId] === true
      return {
        type: 'waffle',
        correct: gradeQuestion(q, r).correct,
        cells: cellOk,
        counts,
        answer: q.answer,
      }
    }
    case 'translation':
      return { type: 'translation', correct: gradeQuestion(q, r).correct, dx: q.dx, dy: q.dy }
    case 'compass': {
      const a = q.places.find((p) => p.id === q.from)
      const b = q.places.find((p) => p.id === q.to)
      return {
        type: 'compass',
        correct: gradeQuestion(q, r).correct,
        answer: a && b ? compassDirection(a, b) : null,
      }
    }
    case 'net':
      return { type: 'net', correct: gradeQuestion(q, r).correct, answer: netAnswer(q) }
    case 'drawing':
      return {
        type: 'drawing',
        correct: gradeQuestion(q, r).correct,
        met: r?.type === 'drawing' ? r.met : [],
        need: q.pass ?? q.criteria.length,
        exemplarImage: q.exemplarImage,
      }
    case 'writing':
      return {
        type: 'writing',
        correct: gradeQuestion(q, r).correct,
        met: r?.type === 'writing' ? r.met : [],
        need: q.pass ?? q.criteria.length,
        exemplar: q.exemplar,
      }
    case 'estimate': {
      const est = r?.type === 'estimate' ? r.estimate : null
      const off = est === null ? null : Math.abs(est - q.actual)
      return {
        type: 'estimate',
        correct: gradeQuestion(q, r).correct,
        actual: q.actual,
        close: off !== null && off <= q.tolerance,
        off,
      }
    }
  }
}

/* ---------------------------- Session (reducer) --------------------------- */

export type QuizStatus = 'active' | 'complete' | 'failed'

export interface QuizConfig {
  questions: QuizQuestion[]
  /** Lives mode: each wrong check costs a life; 0 lives → `failed`. Omit = unlimited. */
  lives?: number
  /** Allow navigating back to earlier questions (default: true). */
  allowBack?: boolean
  /** Require Check before Next can advance (default: true). */
  requireCheck?: boolean
}

export interface QuizState {
  questions: QuizQuestion[]
  index: number
  responses: Record<string, QuizResponse | undefined>
  grades: Record<string, Grade | undefined>
  /** Hints revealed so far, per question id. */
  hintsUsed: Record<string, number>
  /** Remaining lives, or null in unlimited mode. */
  livesLeft: number | null
  livesMax: number | null
  allowBack: boolean
  requireCheck: boolean
  status: QuizStatus
}

export type QuizAction =
  | { type: 'respond'; response: QuizResponse }
  | { type: 'check' }
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'goto'; index: number }
  | { type: 'hint' }
  | { type: 'restart' }

/** Build the initial session state from a config. */
export function initQuiz(config: QuizConfig): QuizState {
  const responses: QuizState['responses'] = {}
  for (const q of config.questions) responses[q.id] = emptyResponse(q)
  return {
    questions: config.questions,
    index: 0,
    responses,
    grades: {},
    hintsUsed: {},
    livesLeft: config.lives ?? null,
    livesMax: config.lives ?? null,
    allowBack: config.allowBack ?? true,
    requireCheck: config.requireCheck ?? true,
    status: 'active',
  }
}

const at = (s: QuizState): QuizQuestion | undefined => s.questions[s.index]

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  const q = at(state)

  switch (action.type) {
    case 'respond': {
      // Locked once graded — you can't change a checked answer.
      if (!q || state.grades[q.id]) return state
      return { ...state, responses: { ...state.responses, [q.id]: action.response } }
    }

    case 'check': {
      if (!q || state.grades[q.id]) return state
      const g = gradeQuestion(q, state.responses[q.id])
      const livesLeft =
        state.livesLeft == null ? null : g.correct ? state.livesLeft : Math.max(0, state.livesLeft - 1)
      const status: QuizStatus = livesLeft === 0 ? 'failed' : state.status
      return { ...state, grades: { ...state.grades, [q.id]: g }, livesLeft, status }
    }

    case 'next': {
      const last = state.index >= state.questions.length - 1
      if (last) return { ...state, status: state.status === 'failed' ? 'failed' : 'complete' }
      return { ...state, index: state.index + 1 }
    }

    case 'prev':
      if (!state.allowBack || state.index === 0) return state
      return { ...state, index: state.index - 1 }

    case 'goto': {
      const index = clamp(action.index, 0, state.questions.length - 1)
      return { ...state, index }
    }

    case 'hint': {
      if (!q) return state
      const available = q.hints?.length ?? 0
      const used = Math.min((state.hintsUsed[q.id] ?? 0) + 1, available)
      return { ...state, hintsUsed: { ...state.hintsUsed, [q.id]: used } }
    }

    case 'restart':
      return initQuiz({
        questions: state.questions,
        lives: state.livesMax ?? undefined,
        allowBack: state.allowBack,
        requireCheck: state.requireCheck,
      })
  }
}

/* -------------------------------- Selectors ------------------------------- */

/** The question at the current index. */
export function currentQuestion(s: QuizState): QuizQuestion | undefined {
  return at(s)
}

export interface QuizProgress {
  index: number
  total: number
  /** Number of questions checked so far. */
  checked: number
  /** Number checked fully-correct. */
  correct: number
  /** Overall score across ALL questions (0–1), using partial credit. */
  scorePct: number
}

export function quizProgress(s: QuizState): QuizProgress {
  const total = s.questions.length
  let checked = 0
  let correct = 0
  let scoreSum = 0
  let weightSum = 0
  for (const item of s.questions) {
    const weight = item.points ?? 1
    weightSum += weight
    const g = s.grades[item.id]
    if (g) {
      checked++
      scoreSum += g.score * weight
      if (g.correct) correct++
    }
  }
  return {
    index: s.index,
    total,
    checked,
    correct,
    scorePct: weightSum === 0 ? 0 : Math.round((scoreSum / weightSum) * 100),
  }
}

export interface QuizReviewItem {
  question: QuizQuestion
  response: QuizResponse | undefined
  grade: Grade | undefined
}

export interface QuizSummary {
  total: number
  correct: number
  /** Whole-percent accuracy across all questions (partial credit averaged). */
  accuracy: number
  passed: boolean
  review: QuizReviewItem[]
}

/** Aggregate the finished session for a result screen. `passMark` is 0–1 (default 0.6). */
export function quizSummary(s: QuizState, passMark = 0.6): QuizSummary {
  const review: QuizReviewItem[] = s.questions.map((question) => ({
    question,
    response: s.responses[question.id],
    grade: s.grades[question.id],
  }))
  const correct = review.filter((r) => r.grade?.correct).length
  // Weighted by each question's `points` (default 1) — arena-ready scoring.
  const scoreSum = review.reduce((sum, r) => sum + (r.grade?.score ?? 0) * (r.question.points ?? 1), 0)
  const weightSum = review.reduce((sum, r) => sum + (r.question.points ?? 1), 0)
  const accuracy = weightSum === 0 ? 0 : Math.round((scoreSum / weightSum) * 100)
  return {
    total: s.questions.length,
    correct,
    accuracy,
    passed: accuracy >= passMark * 100,
    review,
  }
}

/* ------------------------- Which subject is a type for? ------------------------ */
export const QUIZ_SUBJECTS = ['general', 'math', 'english', 'science'] as const
export type QuizSubject = (typeof QUIZ_SUBJECTS)[number]

/**
 * Every question type, filed under the subject it belongs to — `general` means it
 * carries any subject (a multiple-choice works as well in history as in biology).
 * Typed as a total Record, so adding a question type without filing it here is a
 * compile error. Authoring UIs read this to group the type list.
 */
export const QUIZ_TYPE_SUBJECT: Record<QuizQuestion['type'], QuizSubject> = {
  // general
  drawing: 'general',
  writing: 'general',
  estimate: 'general',
  single: 'general',
  multiple: 'general',
  boolean: 'general',
  fill: 'general',
  match: 'general',
  order: 'general',
  categorize: 'general',
  highlight: 'general',
  hotspot: 'general',
  label: 'general',
  annotate: 'general',
  tablefill: 'general',
  venn: 'general',
  carroll: 'general',
  route: 'general',
  arrow: 'general',
  // math
  math: 'math',
  numeric: 'math',
  numberline: 'math',
  fraction: 'math',
  partwhole: 'math',
  placevalue: 'math',
  tenframe: 'math',
  array: 'math',
  tally: 'math',
  pattern: 'math',
  money: 'math',
  clock: 'math',
  digitalclock: 'math',
  ruler: 'math',
  scale: 'math',
  balance: 'math',
  chance: 'math',
  barchart: 'math',
  pictogram: 'math',
  linegraph: 'math',
  waffle: 'math',
  gridshape: 'math',
  symmetry: 'math',
  rotation: 'math',
  translation: 'math',
  coordinates: 'math',
  angle: 'math',
  compass: 'math',
  solid: 'math',
  net: 'math',
  // english
  crossword: 'english',
  wordsearch: 'english',
  wordbank: 'english',
  proofread: 'english',
  speech: 'english',
  // science
  branchkey: 'science',
}

/** The question types of one subject, in registry order. */
export function quizTypesOfSubject(subject: QuizSubject): Array<QuizQuestion['type']> {
  return (Object.keys(QUIZ_TYPE_SUBJECT) as Array<QuizQuestion['type']>).filter(
    (t) => QUIZ_TYPE_SUBJECT[t] === subject,
  )
}

/**
 * Build a { type -> one-line description } map straight from the schema's own
 * `.describe()` calls — so the catalogue and any tooling read the SAME text an LLM
 * sees when authoring, and it can never drift from the schema.
 */
function unionDescriptions(schema: {
  def: { options?: unknown[]; innerType?: { def: { options?: unknown[] } } }
}): Record<string, string> {
  const opts = schema.def.options ?? schema.def.innerType?.def.options ?? []
  const out: Record<string, string> = {}
  for (const o of opts as Array<{
    description?: string
    def: { shape: { type?: { value?: string } } }
  }>) {
    const key = o.def.shape.type?.value
    if (key && o.description) out[key] = o.description
  }
  return out
}

/** One-line description of every quiz question type, from the schema itself. */
export const QUIZ_TYPE_DESCRIPTIONS: Record<string, string> = unionDescriptions(
  QuizQuestion as unknown as Parameters<typeof unionDescriptions>[0],
)
