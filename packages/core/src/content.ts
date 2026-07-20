/**
 * Declarative content schema — the CONTRACT between content authors (incl. LLMs)
 * and the UI. One source of truth (§R3), platform-agnostic (§R2, Zod is pure TS).
 *
 * A lesson/feed/article body is an ordered list of BLOCKS. Blocks span the full
 * range of what a page can show: prose + media, layout containers, learning
 * surfaces, AND the interactive primitives (a `quiz` block embeds any of the ~40
 * `QuizQuestion` types; `flashcards`/`tracing`/`coloring` embed their schemas).
 * `CONTENT_BLOCK_TYPES` is the single place other packages read to discover every
 * content kind; `CONTENT_BLOCK_META` flags each block's category + interactivity
 * so an author/LLM/consumer can decide what fits a context.
 *
 * Why Zod: one schema yields TS types (`z.infer`), a JSON Schema
 * (`contentJsonSchema()`) to steer LLM generation, and a validator
 * (`safeParseContent`) to verify + repair output before render.
 */

import { z } from 'zod'
import { ColoringPicture, TracingGlyph } from './draw'
import { FlashcardDeck } from './flashcard'
import { QuizQuestion } from './quiz'
import { SOLID_NAMES } from './solid3d'

/** The block kinds a lesson/feed/article can be built from — the complete set. */
export const CONTENT_BLOCK_TYPES = [
  // Text
  'heading',
  'paragraph',
  'quote',
  'list',
  'term',
  'math',
  'table',
  'divider',
  // Media
  'image',
  'video',
  'audio',
  'embed',
  'shape',
  // Layout containers
  'callout',
  'code',
  'accordion',
  'tabs',
  'timeline',
  'steps',
  // Learning surfaces
  'workedExample',
  'learningGoals',
  'selfAssessment',
  'experiment',
  // Teaching surfaces (what the Learner's Books are actually made of)
  'vocabulary',
  'dialogue',
  'passage',
  'reflection',
  'discuss',
  'lyrics',
  // Interactive primitives (embed the authorable activity schemas)
  'quiz',
  'flashcards',
  'tracing',
  'coloring',
  'spinner',
] as const

export type ContentBlockType = (typeof CONTENT_BLOCK_TYPES)[number]

/** Per-block metadata so authors/LLMs/consumers can filter by context. */
export type ContentBlockCategory = 'text' | 'media' | 'layout' | 'learning' | 'interactive'
export interface ContentBlockMeta {
  category: ContentBlockCategory
  /** true = the learner acts on it (has state), false = passive display. */
  interactive: boolean
  /** true = a machine can mark it right or wrong (quiz, tracing, coloring, experiment). */
  gradeable: boolean
  /**
   * true = the learner judges their OWN work — a flashcard's again/good/easy, a rubric
   * tick-list, a confidence face. It produces a signal but never a right/wrong verdict,
   * so it is NOT `gradeable`. Kept apart because an authoring UI must be able to tell
   * "nothing is assessed here" from "assessed, but only by the learner".
   */
  selfAssessed: boolean
}

export const CONTENT_BLOCK_META: Record<ContentBlockType, ContentBlockMeta> = {
  heading: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  paragraph: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  quote: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  list: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  term: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  math: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  table: { category: 'text', interactive: false, gradeable: false, selfAssessed: false },
  divider: { category: 'layout', interactive: false, gradeable: false, selfAssessed: false },
  image: { category: 'media', interactive: false, gradeable: false, selfAssessed: false },
  video: { category: 'media', interactive: false, gradeable: false, selfAssessed: false },
  audio: { category: 'media', interactive: false, gradeable: false, selfAssessed: false },
  embed: { category: 'media', interactive: false, gradeable: false, selfAssessed: false },
  shape: { category: 'media', interactive: false, gradeable: false, selfAssessed: false },
  callout: { category: 'layout', interactive: false, gradeable: false, selfAssessed: false },
  code: { category: 'layout', interactive: false, gradeable: false, selfAssessed: false },
  accordion: { category: 'layout', interactive: true, gradeable: false, selfAssessed: false },
  tabs: { category: 'layout', interactive: true, gradeable: false, selfAssessed: false },
  timeline: { category: 'layout', interactive: false, gradeable: false, selfAssessed: false },
  steps: { category: 'layout', interactive: false, gradeable: false, selfAssessed: false },
  workedExample: {
    category: 'learning',
    interactive: false,
    gradeable: false,
    selfAssessed: false,
  },
  learningGoals: {
    category: 'learning',
    interactive: false,
    gradeable: false,
    selfAssessed: false,
  },
  selfAssessment: { category: 'learning', interactive: true, gradeable: false, selfAssessed: true },
  experiment: { category: 'learning', interactive: true, gradeable: true, selfAssessed: false },
  vocabulary: { category: 'learning', interactive: true, gradeable: false, selfAssessed: false },
  dialogue: { category: 'learning', interactive: false, gradeable: false, selfAssessed: false },
  passage: { category: 'learning', interactive: false, gradeable: false, selfAssessed: false },
  reflection: { category: 'learning', interactive: true, gradeable: false, selfAssessed: true },
  discuss: { category: 'learning', interactive: false, gradeable: false, selfAssessed: false },
  lyrics: { category: 'learning', interactive: true, gradeable: false, selfAssessed: false },
  quiz: { category: 'interactive', interactive: true, gradeable: true, selfAssessed: false },
  flashcards: { category: 'interactive', interactive: true, gradeable: false, selfAssessed: true },
  tracing: { category: 'interactive', interactive: true, gradeable: true, selfAssessed: false },
  coloring: { category: 'interactive', interactive: true, gradeable: true, selfAssessed: false },
  spinner: { category: 'interactive', interactive: true, gradeable: false, selfAssessed: false },
}

/** Block types filtered by a flag — helpers for authoring UIs / LLM tool specs. */
export const INTERACTIVE_BLOCK_TYPES = CONTENT_BLOCK_TYPES.filter((t) => CONTENT_BLOCK_META[t].interactive)
export const PASSIVE_BLOCK_TYPES = CONTENT_BLOCK_TYPES.filter((t) => !CONTENT_BLOCK_META[t].interactive)
/** Blocks a machine can mark right or wrong. */
export const GRADEABLE_BLOCK_TYPES = CONTENT_BLOCK_TYPES.filter((t) => CONTENT_BLOCK_META[t].gradeable)
/** Blocks the learner assesses themselves (rubric, SRS rating, confidence face). */
export const SELF_ASSESSED_BLOCK_TYPES = CONTENT_BLOCK_TYPES.filter((t) => CONTENT_BLOCK_META[t].selfAssessed)
/** Everything that yields ANY signal on how the learner did — marked or self-judged. */
export const ASSESSED_BLOCK_TYPES = CONTENT_BLOCK_TYPES.filter(
  (t) => CONTENT_BLOCK_META[t].gradeable || CONTENT_BLOCK_META[t].selfAssessed,
)

const ContentBlockShape = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('heading'),
      level: z.number().int().min(1).max(3).describe('Heading level, 1 (largest) to 3.'),
      text: z.string().min(1).describe('Heading text. Plain text, no markdown.'),
    })
    .describe('A section heading (level 1-3).'),
  z
    .object({
      type: z.literal('paragraph'),
      text: z.string().min(1).describe('A paragraph of body text. Plain text, one idea.'),
    })
    .describe('A paragraph of body text.'),
  z
    .object({
      type: z.literal('quote'),
      text: z.string().min(1).describe('The quoted text.'),
      cite: z.string().optional().describe('Optional attribution / source.'),
    })
    .describe('A quoted passage with optional attribution.'),
  z
    .object({
      type: z.literal('list'),
      ordered: z.boolean().describe('true = numbered list, false = bulleted list.'),
      items: z.array(z.string().min(1)).min(1).describe('List items, one string each.'),
    })
    .describe('A bulleted or numbered list.'),
  z
    .object({
      type: z.literal('term'),
      term: z.string().min(1).describe('The glossary term.'),
      definition: z.string().min(1).describe('A concise, kid-safe definition.'),
      example: z.string().optional().describe('Optional example sentence.'),
    })
    .describe('A glossary term with its definition.'),
  z
    .object({
      type: z.literal('math'),
      expr: z.string().min(1).describe('A maths expression in linear form ("3/4", "x^2", "pi*r^2").'),
      caption: z.string().optional().describe('Optional caption under the formula.'),
    })
    .describe('A display maths formula (shown, not answered).'),
  z
    .object({
      type: z.literal('table'),
      headers: z.array(z.string()).min(1).describe('Column headers.'),
      rows: z.array(z.array(z.string())).min(1).describe('Rows, each an array of cell strings.'),
      caption: z.string().optional(),
    })
    .describe('A static data table.'),
  z.object({ type: z.literal('divider') }).describe('A horizontal rule between sections.'),

  z
    .object({
      type: z.literal('image'),
      assetId: z
        .string()
        .optional()
        .describe('Media-library asset id (preferred — the server resolves the URL).'),
      src: z.string().url().optional().describe('Resolved/external absolute image URL.'),
      alt: z.string().min(1).describe('Alt text describing the image for accessibility.'),
      caption: z.string().optional().describe('Optional caption shown under the image.'),
    })
    .describe('An image with alt text and optional caption.'),
  z
    .object({
      type: z.literal('video'),
      assetId: z.string().optional().describe('Media-library asset id (preferred).'),
      src: z.string().url().optional().describe('Resolved/external absolute video URL (mp4/HLS).'),
      poster: z.string().url().optional().describe('Optional poster image URL.'),
      caption: z.string().optional().describe('Optional caption.'),
    })
    .describe('An embedded video.'),
  z
    .object({
      type: z.literal('audio'),
      assetId: z.string().optional().describe('Media-library asset id (preferred).'),
      src: z.string().url().optional().describe('Resolved/external absolute audio URL.'),
      caption: z.string().optional().describe('Optional caption / transcript summary.'),
    })
    .describe('An embedded audio clip.'),
  z
    .object({
      type: z.literal('embed'),
      src: z.string().url().describe('External embed URL (e.g. a video/interactive to iframe).'),
      title: z.string().optional(),
      aspect: z.enum(['16:9', '4:3', '1:1']).default('16:9').describe('Aspect ratio of the frame.'),
    })
    .describe('An embedded external frame (map, widget).'),

  z
    .object({
      type: z.literal('shape'),
      kind: z.enum(['2d', '3d']).describe('2D polygon or 3D solid.'),
      name: z
        .enum(['triangle', 'square', 'rectangle', 'pentagon', 'hexagon', 'octagon', 'circle', ...SOLID_NAMES])
        .describe('Which shape to draw. 2D: triangle→circle. 3D: every solid in SOLID_NAMES.'),
      color: z.string().optional().describe('Fill colour (hex).'),
      label: z.string().optional().describe('Caption under the figure.'),
      rotatable: z.boolean().default(true).describe('3D only: the learner can drag to turn the solid.'),
    })
    .describe('A 2D or 3D geometric figure to display.'),

  z
    .object({
      type: z.literal('callout'),
      variant: z.enum(['info', 'success', 'warning', 'danger']).describe('Tone of the callout.'),
      title: z.string().optional().describe('Optional bold title.'),
      text: z.string().min(1).describe('The callout body.'),
    })
    .describe('A highlighted note (info, success, warning, danger).'),
  z
    .object({
      type: z.literal('code'),
      language: z.string().optional().describe('Language id for highlighting, e.g. "python".'),
      code: z.string().min(1).describe('The code, verbatim, including newlines.'),
    })
    .describe('A formatted code block.'),
  z
    .object({
      type: z.literal('accordion'),
      items: z
        .array(z.object({ title: z.string().min(1), body: z.string().min(1) }))
        .min(1)
        .describe('Collapsible title/body panels.'),
    })
    .describe('Collapsible sections the learner can open.'),
  z
    .object({
      type: z.literal('tabs'),
      tabs: z
        .array(z.object({ label: z.string().min(1), body: z.string().min(1) }))
        .min(1)
        .describe('Tabbed panels.'),
    })
    .describe('Tabbed panels the learner can switch between.'),
  z
    .object({
      type: z.literal('timeline'),
      items: z
        .array(
          z.object({
            title: z.string().min(1),
            description: z.string().optional(),
            marker: z.string().optional(),
          }),
        )
        .min(1)
        .describe('Ordered timeline entries.'),
    })
    .describe('A sequence of dated or ordered events.'),
  z
    .object({
      type: z.literal('steps'),
      ordered: z.boolean().default(true).describe('Numbered steps (true) or plain (false).'),
      steps: z.array(z.object({ title: z.string().min(1), body: z.string().optional() })).min(1),
    })
    .describe('Numbered how-to steps.'),

  z
    .object({
      type: z.literal('workedExample'),
      label: z.string().min(1).describe('Badge text, e.g. "Worked example".'),
      prompt: z.string().min(1).describe('The problem being modelled.'),
      steps: z.array(z.string().min(1)).min(1).describe('Solution steps, one per line.'),
      answer: z.string().min(1).describe('The final answer.'),
      answerLabel: z.string().optional(),
      note: z.string().optional().describe('Optional tip under the answer.'),
    })
    .describe('A fully worked solution, shown step by step.'),
  z
    .object({
      type: z.literal('learningGoals'),
      title: z.string().optional().describe('e.g. "We are going to…".'),
      objectives: z.array(z.string().min(1)).min(1).describe('Lesson objectives.'),
      keywords: z.array(z.string()).optional().describe('Key-word chips (vocabulary box).'),
      keywordsTitle: z.string().optional(),
    })
    .describe('The objectives and key words for a unit.'),
  z
    .object({
      type: z.literal('selfAssessment'),
      title: z.string().optional().describe('e.g. "Look what I can do!".'),
      items: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
      levels: z
        .array(z.object({ emoji: z.string(), label: z.string().optional() }))
        .optional()
        .describe('Rating faces low→high; defaults to 😐/😊.'),
    })
    .describe('A confidence check the learner rates themselves.'),
  z
    .object({
      type: z.literal('experiment'),
      title: z.string().optional(),
      stageLabels: z.object({
        predict: z.string(),
        experiment: z.string(),
        observe: z.string(),
        conclude: z.string(),
      }),
      hypothesis: z.object({
        question: z.string().min(1),
        options: z
          .array(
            z.object({
              id: z.string().min(1),
              label: z.string().min(1),
              emoji: z.string().optional(),
            }),
          )
          .min(2),
        correctId: z.string().min(1),
      }),
      procedure: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) })).min(1),
      observation: z.string().min(1),
      conclusion: z.string().min(1),
    })
    .describe('A predict-observe-conclude investigation with a correct hypothesis.'),

  z
    .object({
      type: z.literal('quiz'),
      question: QuizQuestion.describe('An embedded quiz question — any of the ~40 interaction types.'),
    })
    .describe('An embedded, gradeable quiz question (any question type).'),
  z
    .object({
      type: z.literal('flashcards'),
      deck: FlashcardDeck.describe('An embedded flashcard deck.'),
    })
    .describe('A spaced-repetition flashcard deck.'),
  z
    .object({
      type: z.literal('tracing'),
      glyph: TracingGlyph.describe('An embedded traceable glyph.'),
    })
    .describe('A letter or number tracing activity.'),
  z
    .object({
      type: z.literal('coloring'),
      picture: ColoringPicture.describe('An embedded coloring picture.'),
    })
    .describe('A colour-by-region picture.'),
  z
    .object({
      type: z.literal('spinner'),
      segments: z
        .array(
          z.object({
            id: z.string().min(1),
            label: z.string().min(1),
            color: z.string().optional(),
          }),
        )
        .min(2)
        .describe('Wheel segments — a chance-experiment manipulative (not graded).'),
      spinLabel: z.string().optional(),
    })
    .describe('A random spinner wheel.'),

  /* --------------------------- Teaching surfaces ---------------------------- */
  z
    .object({
      type: z.literal('vocabulary'),
      title: z.string().optional().describe('Heading, e.g. "Key words".'),
      words: z
        .array(
          z.object({
            term: z.string().min(1),
            definition: z.string().min(1).describe('A concise, kid-safe definition.'),
            example: z.string().optional().describe('The word used in a sentence.'),
            emoji: z.string().optional(),
            audioSrc: z.string().url().optional().describe('Pronunciation — tap the word to hear it.'),
          }),
        )
        .min(1),
    })
    .describe('A key-words box with tap-to-reveal definitions.'),
  z
    .object({
      type: z.literal('dialogue'),
      // Cambridge teaches through characters arguing a method ("Zara says… Marcus says…").
      turns: z
        .array(
          z.object({
            speaker: z.string().min(1),
            text: z.string().min(1),
            emoji: z.string().optional().describe('Stands in for the character\u2019s face.'),
            avatarSrc: z.string().url().optional(),
            side: z.enum(['left', 'right']).default('left').describe('Which side the bubble sits on.'),
          }),
        )
        .min(1),
      question: z.string().optional().describe('What the learner should decide, e.g. "Who is right?".'),
    })
    .describe('Characters speaking in bubbles to introduce an idea.'),
  z
    .object({
      type: z.literal('passage'),
      title: z.string().optional(),
      author: z.string().optional(),
      // Numbered paragraphs so comprehension questions can point at them ("see paragraph 3").
      paragraphs: z.array(z.string().min(1)).min(1),
      numbered: z.boolean().default(true).describe('Show paragraph numbers in the margin.'),
      glossary: z
        .array(z.object({ term: z.string().min(1), definition: z.string().min(1) }))
        .optional()
        .describe('Hard words in the passage, defined underneath.'),
    })
    .describe('A numbered reading passage with an optional glossary.'),
  z
    .object({
      type: z.literal('reflection'),
      title: z.string().optional().describe('Heading, e.g. "Look what I can do".'),
      prompts: z.array(z.string().min(1)).min(1).describe('What to think back on.'),
      faces: z.boolean().default(true).describe('Show the 3-face confidence scale the books use (🙂 😐 🙁).'),
    })
    .describe('A look-what-I-can-do self-reflection with confidence faces.'),
  z
    .object({
      type: z.literal('discuss'),
      prompt: z.string().min(1).describe('What to talk about.'),
      mode: z
        .enum(['pair', 'group', 'class'])
        .default('pair')
        .describe('Talk partner, group, or whole class.'),
      points: z.array(z.string().min(1)).optional().describe('Talking points to get them started.'),
      minutes: z.number().int().min(1).max(30).optional().describe('Suggested time.'),
    })
    .describe('A talk-to-your-partner speaking prompt.'),
  z
    .object({
      type: z.literal('lyrics'),
      title: z.string().min(1),
      audioSrc: z.string().url().optional(),
      lines: z
        .array(
          z.object({
            text: z.string().min(1),
            /** Seconds into the audio — supply for every line to get karaoke highlighting. */
            at: z.number().min(0).optional(),
          }),
        )
        .min(1),
    })
    .describe('A song or chant with words and optional karaoke timing.'),
])

/** Media blocks must carry a library `assetId` or a resolved/external `src`. */
export const ContentBlock = ContentBlockShape.superRefine((block, ctx) => {
  if (block.type === 'image' || block.type === 'video' || block.type === 'audio') {
    if (!block.assetId && !block.src)
      ctx.addIssue({
        code: 'custom',
        message: `${block.type} block needs assetId (media library) or src (external) — at least one`,
      })
  }
})

/** An ordered list of blocks — a lesson section, feed post, or article body. */
export const Content = z
  .array(ContentBlock)
  .describe('Ordered content blocks making up a lesson section, feed post, or article.')

/** A titled lesson made of content blocks. */
export const Lesson = z.object({
  id: z.string().min(1),
  title: z.string().min(1).describe('Lesson title.'),
  summary: z.string().optional().describe('One-sentence summary / learning objective.'),
  blocks: Content,
})

export type ContentBlock = z.infer<typeof ContentBlock>
export type Content = z.infer<typeof Content>
export type Lesson = z.infer<typeof Lesson>

/**
 * One-line description of every content block, read straight from each block schema's
 * own `.describe()` — the catalogue and LLM authoring share one source of truth.
 */
export const CONTENT_BLOCK_DESCRIPTIONS: Record<ContentBlockType, string> = (() => {
  const d = (
    ContentBlock as unknown as {
      def: { options?: unknown[]; innerType?: { def: { options: unknown[] } } }
    }
  ).def
  const opts = (d.options ?? d.innerType?.def.options ?? []) as Array<{
    description?: string
    def: { shape: { type: { value: ContentBlockType } } }
  }>
  const out = {} as Record<ContentBlockType, string>
  for (const o of opts) out[o.def.shape.type.value] = o.description ?? ''
  return out
})()

/** Validate unknown data (e.g. LLM output) as Content — returns a typed result. */
export function safeParseContent(data: unknown) {
  return Content.safeParse(data)
}

/** Parse Content, throwing on invalid data. */
export function parseContent(data: unknown): Content {
  return Content.parse(data)
}

export function safeParseLesson(data: unknown) {
  return Lesson.safeParse(data)
}

/** JSON Schema for the Content array — feed to an LLM as a structured-output spec. */
export function contentJsonSchema(): unknown {
  return z.toJSONSchema(Content)
}

/** JSON Schema for a full Lesson. */
export function lessonJsonSchema(): unknown {
  return z.toJSONSchema(Lesson)
}
