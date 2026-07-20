/**
 * Authorable-content registry — the single entry point an LLM (or any authoring
 * tool) uses. For every kind of content the platform renders, it exposes a JSON
 * Schema (what to emit) and a validator (verify + repair before render). Because
 * each schema is the same Zod object the components' types derive from, "valid
 * output" is guaranteed to render correctly. Still gate through moderation (§R5).
 *
 * Usage sketch:
 *   const spec = jsonSchemaFor('quiz');          // → feed to the model as a tool
 *   const res  = safeParseAuthorable('quiz', x); // → res.success ? render : repair
 */

import { Content, contentJsonSchema, Lesson, lessonJsonSchema } from './content';
import { Course, courseJsonSchema } from './course';
import {
  ColoringPicture,
  coloringPictureJsonSchema,
  TracingGlyph,
  tracingGlyphJsonSchema,
} from './draw';
import { FlashcardDeck, flashcardDeckJsonSchema } from './flashcard';
import { Quiz, quizJsonSchema } from './quiz';

export interface AuthorableEntry {
  /** Human/LLM-readable description of what this content kind is. */
  description: string;
  /** JSON Schema for structured output / tool definitions. */
  jsonSchema: () => unknown;
  /** Validate unknown data; returns a Zod SafeParse result. */
  safeParse: (data: unknown) => { success: boolean };
}

export const AUTHORABLE_SCHEMAS = {
  quiz: {
    description:
      'A quiz: an ordered list of questions spanning ~40 interaction types (choice, fill, order, match, numeric, fraction, clock, number-line, tally, pictogram, chart, route, crossword, math, speech, …).',
    jsonSchema: quizJsonSchema,
    safeParse: (d: unknown) => Quiz.safeParse(d),
  },
  content: {
    description:
      'A content body: ordered blocks — text (heading, paragraph, quote, list, term, math, table), media (image, video, audio, embed), layout (callout, code, accordion, tabs, timeline, steps), learning surfaces (workedExample, learningGoals, selfAssessment, experiment) and embedded activities (quiz, flashcards, tracing, coloring). See CONTENT_BLOCK_TYPES / CONTENT_BLOCK_META.',
    jsonSchema: contentJsonSchema,
    safeParse: (d: unknown) => Content.safeParse(d),
  },
  lesson: {
    description: 'A titled lesson made of content blocks.',
    jsonSchema: lessonJsonSchema,
    safeParse: (d: unknown) => Lesson.safeParse(d),
  },
  flashcardDeck: {
    description:
      'A deck of flashcards (front/back, optional hint/example) for spaced-repetition study.',
    jsonSchema: flashcardDeckJsonSchema,
    safeParse: (d: unknown) => FlashcardDeck.safeParse(d),
  },
  course: {
    description: 'A course outline: chapters, each with lesson nodes (lesson/quiz/video/practice).',
    jsonSchema: courseJsonSchema,
    safeParse: (d: unknown) => Course.safeParse(d),
  },
  tracingGlyph: {
    description:
      'A traceable glyph (letter/digit/shape): ordered guide strokes as [x,y] polylines in a 0–100 viewBox.',
    jsonSchema: tracingGlyphJsonSchema,
    safeParse: (d: unknown) => TracingGlyph.safeParse(d),
  },
  coloringPicture: {
    description:
      'A coloring picture: fillable SVG-path regions (optional target colors) + line-art outline, 0–100 viewBox.',
    jsonSchema: coloringPictureJsonSchema,
    safeParse: (d: unknown) => ColoringPicture.safeParse(d),
  },
} satisfies Record<string, AuthorableEntry>;

export type AuthorableKind = keyof typeof AUTHORABLE_SCHEMAS;

/** All authorable kinds (e.g. to enumerate tools for the model). */
export const AUTHORABLE_KINDS = Object.keys(AUTHORABLE_SCHEMAS) as AuthorableKind[];

/** JSON Schema for a given content kind. */
export function jsonSchemaFor(kind: AuthorableKind): unknown {
  return AUTHORABLE_SCHEMAS[kind].jsonSchema();
}

/** Validate unknown data against a content kind's schema. */
export function safeParseAuthorable(kind: AuthorableKind, data: unknown) {
  return AUTHORABLE_SCHEMAS[kind].safeParse(data);
}
