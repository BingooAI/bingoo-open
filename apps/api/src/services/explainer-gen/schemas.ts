/**
 * gen/schemas.ts — zod contracts for the multi-stage generation pipeline.
 *
 * The pipeline (outline → write → critic → regen) exchanges small, validated
 * JSON between stages so a bad stage output is caught + repaired locally instead
 * of corrupting the whole lesson. These schemas are the studio-side quality
 * contract; pedagogy still comes from the LessonBrief upstream.
 */
import { z } from 'zod';

/* -------------------------------------------------------------- outline */
/** A lightweight plan the writer follows: ordered scenes, each tied to the
 *  objective it advances and the teaching move / kit to use. Cheap to generate,
 *  keeps the heavy WRITE stage focused instead of inventing structure ad hoc. */
export const Outline = z.object({
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(['exposition', 'gate']),
        /** the single idea this scene advances (one-idea-per-scene) */
        goal: z.string().min(1),
        /** which brief objective id(s) this scene teaches or assesses */
        objectiveIds: z.array(z.string()).default([]),
        /** kit/diagram/verb hint for the writer (e.g. "equationbalance", "diagram:flow") */
        suggest: z.string().default(''),
      }),
    )
    .min(2),
});
export type Outline = z.infer<typeof Outline>;

/* -------------------------------------------------------------- critique */
/** The LLM-judge verdict per scene. `score` 1–5; anything below the pipeline's
 *  threshold is regenerated with `fix` as guidance. `dimensions` records WHY so
 *  the report is actionable and the regen prompt is specific. */
export const SceneCritique = z.object({
  id: z.string().min(1),
  score: z.number().min(1).max(5),
  /** short, specific problems ("gate tests division but lesson only taught adding") */
  issues: z.array(z.string()).default([]),
  /** one concrete instruction for the rewrite */
  fix: z.string().default(''),
});
export type SceneCritique = z.infer<typeof SceneCritique>;

export const Critique = z.object({
  scenes: z.array(SceneCritique).default([]),
  /** 1–2 sentence overall read of the lesson */
  overall: z.string().default(''),
});
export type Critique = z.infer<typeof Critique>;

/* ------------------------------------------------- scene replacement (regen) */
/** A regenerated scene + its narration segment, spliced back into the doc/bundle
 *  by `id` so untouched scenes stay byte-identical. `narration` is the bundle
 *  entry keyed by the scene's narrationRef. */
export const SceneReplacement = z.object({
  id: z.string().min(1),
  scene: z.unknown(), // validated against the engine Scene schema on splice
  /** bundle pieces this scene owns: element strings + its narration segment(s) */
  strings: z.record(z.string(), z.string()).default({}),
  narration: z.record(z.string(), z.unknown()).default({}),
});
export type SceneReplacement = z.infer<typeof SceneReplacement>;

export const RegenResult = z.object({
  scenes: z.array(SceneReplacement).default([]),
});
export type RegenResult = z.infer<typeof RegenResult>;

/** Scenes scoring at or below this are regenerated (max 1 round by default). */
export const REGEN_THRESHOLD = 3;
