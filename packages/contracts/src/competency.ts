// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'
import { facets } from './facets.js'
import { code, id, localizedText, slug, unitInterval } from './refs.js'

/**
 * The capability graph — nodes and the typed edges between them.
 *
 * This is the core of the whole family. A curriculum (programme → course → unit → lesson) is
 * **a view projected from this graph**, not the other way round; content points at nodes and
 * nodes never point at content.
 *
 * ## Two orthogonal axes
 *
 * `kind` says what a node *is* — which instrument measures it. `altitude` says how coarse it
 * is. They are independent: a node at `altitude: 'concept'` may be `KNOWLEDGE` or `SKILL`.
 *
 * Conflating them is the mistake this model exists to avoid. A single "domain" axis forces
 * "is this knowledge or a skill?" and "is this atomic or a whole competency?" into one field —
 * and the second question is the one that decides where mastery may be stored.
 *
 * ```
 * role        vai trò nghề            "Data analyst"
 * outcome     chuẩn đầu ra            programme-level
 * competency  năng lực lớn            arithmetic-fluency
 * skill       kỹ năng ghép            add-carry
 * concept     NGUYÊN TỬ ← evidence    kc-carry-write
 * ```
 */

/**
 * What a node is, and therefore how it is measured.
 *
 * - `KNOWLEDGE` — what is *known*. BKT + Elo on binary correctness.
 * - `SKILL` — what can be *done*. BKT + Elo, usually after a rubric.
 * - `DISPOSITION` · `BEHAVIOR` · `ATTITUDE` — how a person habitually acts. Measured as an
 *   accumulated **frequency** (Beta-Binomial), at low confidence per observation, never graded
 *   right or wrong. Real curricula need this: Cambridge Primary English has "Enjoy and engage
 *   with books" as an objective. See ADR 0005 for the ruling that these are measured, and for
 *   what protection moved to the reporting layer as a result.
 * - `PROCEDURE` — a multi-step operational task.
 * - `OBJECTIVE` — a standard's stated aim. **The only kind that belongs to a framework version.**
 * - `OUTCOME` — a programme-level exit standard.
 */
export const competencyKind = z.enum([
  'OBJECTIVE',
  'OUTCOME',
  'SKILL',
  'KNOWLEDGE',
  'PROCEDURE',
  'BEHAVIOR',
  'ATTITUDE',
  'DISPOSITION',
])
export type CompetencyKind = z.infer<typeof competencyKind>

/**
 * Kinds a learner can be taught and measured on.
 *
 * `OBJECTIVE` and `OUTCOME` are **reporting overlays** — a standard's way of naming a target,
 * not a thing to practise. Offering one as "learn next" sends a learner at a bureaucratic label
 * instead of at a concept, which is why the exclusion is a named constant rather than an
 * incidental filter somewhere in a sequencer.
 */
export const LEARNABLE_KINDS = ['KNOWLEDGE', 'SKILL', 'DISPOSITION'] as const

export function isLearnable(kind: CompetencyKind): boolean {
  return (LEARNABLE_KINDS as readonly string[]).includes(kind)
}

/**
 * How coarse a node is.
 *
 * `concept` is the atom, and the **only** altitude at which evidence lands. Everything above is
 * a derived function computed on demand — never stored, so it can never disagree with the
 * evidence underneath it.
 */
export const altitude = z.enum(['concept', 'skill', 'competency', 'outcome', 'role'])
export type Altitude = z.infer<typeof altitude>

/**
 * Edge types, in two families that must not be mixed.
 *
 * **Ordering** — `PREREQUISITE`, `ENABLES`, `COMPOSES`. These build the learning DAG, gate
 * readiness, and must stay acyclic. `from` is the earlier or the part; `to` is the later or the
 * whole.
 *
 * **Lateral** — `ALIGNS`, `VARIANT_OF`, `MAPS_TO`. Cross-references. They never affect learning
 * order, and traversal must not follow them — or an equivalence between two national standards
 * becomes a prerequisite, and a learner is blocked by a curriculum they are not studying.
 *
 * `MAPS_TO` is what makes multi-standard reporting work: an objective maps down onto the shared
 * concepts that certify it.
 */
export const relType = z.enum(['PREREQUISITE', 'ENABLES', 'COMPOSES', 'ALIGNS', 'VARIANT_OF', 'MAPS_TO'])
export type RelType = z.infer<typeof relType>

export const ORDERING_RELS = ['PREREQUISITE', 'ENABLES', 'COMPOSES'] as const

/** Defaults to `PREREQUISITE`, so edge data written without a `relType` keeps its meaning. */
export function isOrdering(rel: RelType | undefined): boolean {
  return (ORDERING_RELS as readonly string[]).includes(rel ?? 'PREREQUISITE')
}

/**
 * Whether an unmet prerequisite blocks.
 *
 * `REQUIRED` gates; `RECOMMENDED` renders a soft "you may want this first" and never locks.
 * The distinction is what makes a rich graph safe to author — an author can record a helpful
 * relationship without accidentally walling a learner off from a lesson they could manage.
 */
export const prereqMode = z.enum(['REQUIRED', 'RECOMMENDED'])
export type PrereqMode = z.infer<typeof prereqMode>

/** The Dreyfus bands. A node's `targetLevel` and a learner's derived level share this scale. */
export const dreyfusLevel = z.enum(['novice', 'competent', 'proficient', 'expert'])
export type DreyfusLevel = z.infer<typeof dreyfusLevel>

/**
 * A node.
 *
 * `parent` is **taxonomy** — topic grouping, for browsing. It is *not* a prerequisite and must
 * never be traversed as one. Confusing the two turns a tidy content outline into a wall of
 * invented dependencies that nobody authored.
 *
 * `stage`, `strand` and `subject` are curriculum labels the engine never reads. They exist so
 * an author and an interface can find things; branching on them would teach the engine that
 * "Cambridge" or "Lớp 1" exists, and it must not know.
 *
 * The refinement enforces one authoring invariant at the type boundary: **`stage` belongs only
 * on an `OBJECTIVE`.** A concept is framework-neutral by construction — "add within 20" sits in
 * Cambridge Stage 2 *and* Vietnamese Grade 1, so it cannot carry one stage without lying about
 * the other.
 */
export const skillNode = z
  .object({
    slug,
    /** Display text. `en` is canonical: slugs derive from it, and alignment compares it. */
    title: localizedText,
    kind: competencyKind,
    altitude: altitude.optional(),
    /** Taxonomy parent. Grouping only — never a prerequisite. */
    parent: slug.optional(),
    /** Authoring difficulty hint, 1..5. Not a measurement. */
    level: z.number().int().min(1).max(5).optional(),
    /** The Dreyfus band this *node* targets. Not a learner's band — see `SkillState.level`. */
    targetLevel: dreyfusLevel.optional(),
    /** Curriculum stage label. **Only on `OBJECTIVE`.** */
    stage: z.string().max(128).optional(),
    /** Strand / mạch kiến thức, e.g. "Number". Label only. */
    strand: z.string().max(128).optional(),
    /** Subject key — selects the `DomainProfile` used when checking facets. */
    subject: z.string().max(64).optional(),
    facets: facets.optional(),
    /** Provenance: the standard code or textbook unit this came from. */
    source: z.string().max(1000).optional(),
    /** External standard code. Display and reporting only, never logic. */
    code: code.optional(),
    description: localizedText.optional(),
    version: z.number().int().min(1).default(1),
    /** The node this version replaces, for lineage. */
    supersedes: slug.optional(),
  })
  .refine((n) => n.stage === undefined || n.kind === 'OBJECTIVE', {
    message:
      'stage belongs only on an OBJECTIVE: a concept is framework-neutral, and "add within 20" ' +
      'is Cambridge Stage 2 and Vietnamese Grade 1 at the same time',
    path: ['stage'],
  })
export type SkillNode = z.infer<typeof skillNode>

/**
 * An edge.
 *
 * `weight` is coverage for `MAPS_TO` and `ALIGNS` — an objective may be only partly certified by
 * one concept — and strength elsewhere. `relType` defaults to `PREREQUISITE`.
 */
export const skillEdge = z.object({
  from: slug,
  to: slug,
  mode: prereqMode.default('REQUIRED'),
  relType: relType.optional(),
  weight: unitInterval.default(1),
})
export type SkillEdge = z.infer<typeof skillEdge>

/** The raw material an in-memory graph is built from. */
export const graphData = z.object({
  nodes: z.array(skillNode).default([]),
  edges: z.array(skillEdge).default([]),
})
export type GraphData = z.infer<typeof graphData>

/**
 * A prerequisite that can lock a unit of content.
 *
 * Distinct from `SkillEdge`, which relates two competencies. This one relates a *lesson or
 * course* to something it requires, and lives at the curriculum layer. Merging the two was
 * tried and abandoned: overloading one polymorphic table made every graph query filter on a
 * discriminator it did not care about.
 */
export const prerequisiteRef = z.object({
  requiredType: z.enum(['COMPETENCY', 'LESSON']),
  requiredId: id,
  mode: prereqMode.default('REQUIRED'),
})
export type PrerequisiteRef = z.infer<typeof prerequisiteRef>

/**
 * A weighted anchor from content to a competency, for roll-up.
 *
 * Referenced by `id` rather than slug: an attachment must outlive a re-slug, and content
 * bindings are exactly the thing that must not break when a node is renamed.
 */
export const competencyAnchor = z.object({
  competencyId: id,
  weight: unitInterval.default(1),
})
export type CompetencyAnchor = z.infer<typeof competencyAnchor>
