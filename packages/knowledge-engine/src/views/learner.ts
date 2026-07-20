/** learnerView — mặt đọc của người học. BỔ SUNG §3.4. */

import type { Millis, SkillSnapshot, Slug } from '../contracts';
import type { EnginePolicy } from '../policy';
import type { SkillGraph } from '../graph/build';
import { frontierComposite, type FrontierNode } from '../graph/frontier';
import type { SkillMastery } from '../mastery/observe';
import { dueForReview, type DueItem } from '../sequencer/review';
import { learningCurve, type CurvePoint } from './curve';

export interface LearnerViewInput {
  readonly graph: SkillGraph;
  readonly states: ReadonlyMap<Slug, SkillMastery>;
  readonly relevant: Iterable<Slug>;
  readonly encountered: ReadonlySet<Slug>;
  readonly nowMs: Millis;
  readonly snapshots?: readonly SkillSnapshot[];
}

export interface LearnerView {
  readonly frontier: FrontierNode[];
  readonly due: DueItem[];
  readonly curve: Map<Slug, CurvePoint[]>;
}

/** Biên học + đến hạn ôn + đường cong (sequencing prior 0.25 cho frontier/due). */
export function learnerView(input: LearnerViewInput, policy: EnginePolicy): LearnerView {
  return {
    frontier: frontierComposite(input.graph, input.states, policy.mastery.threshold),
    due: dueForReview(
      input.graph,
      input.states,
      input.relevant,
      input.encountered,
      input.nowMs,
      policy,
    ),
    curve: learningCurve(input.snapshots ?? []),
  };
}
