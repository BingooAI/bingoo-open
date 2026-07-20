// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import type { GraphData, PrerequisiteRef, SkillNode } from './competency.js'
import type { DomainProfile } from './facets.js'
import type { Framework, FrameworkReport, FrameworkVersion } from './framework.js'
import type { Candidate, Gap, Observation, SkillSnapshot, SkillState } from './evidence.js'
import type { LearnerProfile } from './profile.js'
import type { ModerationVerdict } from './xai.js'

/**
 * Ports — how one repo asks another for something without depending on it.
 *
 * A repo that needs data from a sibling declares a port and receives an implementation. Run it
 * alone and it gets a stub from its own `/testing` subpath; wire it up and it gets an adapter.
 * Neither case involves importing the sibling.
 *
 * The consequence worth stating plainly: **any repo here can be replaced by a third-party
 * implementation of the same port.** A ministry that already runs a competency service does not
 * have to adopt ours to use everything else.
 *
 * ## What belongs here
 *
 * A port belongs in this package when **two or more repos must agree on it**. An interface that
 * is one repo's internal extension point does not, however good it is — hoisting a
 * `MasteryEstimator` here would make swapping BKT for DKT a change to the family's constitution.
 * The blast radius is the test, not the elegance.
 *
 * Plain TypeScript interfaces throughout: behaviour cannot be parsed, and the data crossing
 * these boundaries is already validated by the other modules.
 */

/** A result set that may not fit in memory. Graphs and evidence logs both get large. */
export interface Page<T> {
  items: T[]
  /** Opaque. Pass it back for the next page; absent means this was the last. */
  cursor?: string
}

/**
 * Supplies the concept graph. Implemented by Competency Studio, or any CASE source.
 *
 * `graph()` returns nodes and edges together because they are only meaningful together — a
 * consumer that fetched them separately would spend the interval between calls holding a graph
 * that might not be acyclic.
 */
export interface GraphProvider {
  graph(scope?: { subject?: string; slugs?: readonly string[] }): Promise<GraphData>
  node(slug: string): Promise<SkillNode | null>
  /** The facet rules for a subject, for identity checks during authoring. */
  domainProfile?(domain: string): Promise<DomainProfile | null>
}

/**
 * Supplies standards overlays.
 *
 * Versions are addressed explicitly. A caller that asked only for "Cambridge 0845" would get
 * whatever is newest, which is exactly the silent reinterpretation that pinning exists to
 * prevent.
 */
export interface FrameworkProvider {
  framework(slug: string): Promise<Framework | null>
  version(
    frameworkSlug: string,
    version?: { major: number; minor: number; patch: number },
  ): Promise<FrameworkVersion | null>
  /** Objectives belonging to one release, for reporting. */
  objectives(frameworkSlug: string, versionId?: string): Promise<SkillNode[]>
}

/**
 * Where evidence is written. Implemented by an observation store.
 *
 * Takes an array because the offline case is the normal case: a phone in a rural classroom
 * accumulates a session and flushes it when it next sees a network. Implementations must be
 * idempotent on `attemptId` — the same flush arriving twice must fold once.
 */
export interface ObservationSink {
  record(observations: readonly Observation[]): Promise<void>
}

/** Where evidence is read from, for replay and audit. */
export interface ObservationProvider {
  query(filter: {
    learnerId?: string
    skillSlug?: string
    sinceMs?: number
    untilMs?: number
    limit?: number
    cursor?: string
  }): Promise<Page<Observation>>
}

/**
 * Supplies current belief. Implemented by the Competency Engine.
 *
 * **Read-only by design.** Nothing outside the engine may assert a mastery value: beliefs are
 * derived from observations, and a system where any component can write one has no defensible
 * answer to "why does it say that?".
 */
export interface MasteryProvider {
  state(learnerId: string, skillSlugs?: readonly string[]): Promise<SkillState[]>
  gaps(learnerId: string, options?: { scope?: readonly string[]; limit?: number }): Promise<Gap[]>
  /** Attainment read through one standard — computed, never stored. */
  report(learnerId: string, frameworkSlug: string): Promise<FrameworkReport>
  /** The exportable record. Concepts and evidence only; no personal data. */
  profile(learnerId: string): Promise<LearnerProfile>
  history?(learnerId: string, skillSlug: string): Promise<SkillSnapshot[]>
}

/**
 * Supplies items the sequencer may choose between.
 *
 * Returns abstract candidates, never content. The engine picks on concepts and difficulty and
 * never learns what a question says — which is what keeps it content-agnostic and the item bank
 * replaceable.
 */
export interface CandidateProvider {
  candidates(query: {
    skills: readonly string[]
    difficulty?: { min?: number; max?: number }
    lang?: string
    limit?: number
  }): Promise<Candidate[]>
}

/** Whether a unit of content is unlocked for a learner. */
export interface GateProvider {
  prerequisitesOf(unitId: string): Promise<PrerequisiteRef[]>
}

/**
 * Persistence — declared here, implemented **inside each repo that needs it**.
 *
 * There is deliberately no shared store package. A shared storage abstraction in the dependency
 * path of every repo would be bent out of shape by the first one needing a transaction or a
 * different consistency model. Storage is a thing an independent repo owns.
 */
export interface Repository<T> {
  get(id: string): Promise<T | null>
  put(id: string, value: T): Promise<void>
  delete(id: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<Page<T>>
}

/**
 * The single door every model call goes through.
 *
 * One port rather than a vendor SDK per repo, because cost, privacy and lock-in are all decided
 * by routing, and routing needs one place to happen. A school that must keep student-adjacent
 * prompts on its own hardware configures that once.
 *
 * Capabilities are asked, never assumed. Code that branches on a vendor name has hardcoded the
 * thing this port exists to make configurable.
 */
export interface ModelGateway {
  generate(request: {
    prompt: string
    system?: string
    /** A logical role — `extract`, `propose-edges`, `adjudicate` — resolved by gateway config. */
    role?: string
    maxTokens?: number
    temperature?: number
    timeoutMs?: number
  }): Promise<{ text: string; model: string; usage?: { input: number; output: number } }>

  embed(request: { texts: string[]; role?: string }): Promise<{ vectors: number[][]; model: string }>

  classify(request: {
    text: string
    labels: string[]
    role?: string
  }): Promise<{ label: string; scores: Record<string, number>; model: string }>

  moderate(request: { text: string; role?: string }): Promise<ModerationVerdict>

  capabilities(): Promise<{
    generate: boolean
    embed: boolean
    classify: boolean
    moderate: boolean
    /** True when everything is served locally — the offline and privacy guarantee. */
    local: boolean
  }>
}
