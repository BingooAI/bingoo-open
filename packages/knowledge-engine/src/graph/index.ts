/** Đồ thị năng lực + suy luận cấu trúc — SPEC Phụ lục A, §6–§7. */

export { SkillGraph, buildGraph, findOrderingCycle, type BuildOpts, type WeightedNode } from './build'
export {
  compositeMastery,
  effectiveMastery,
  kpMastery,
  nodeMastery,
  aggregate,
  type MasteryLike,
  type MasteryStates,
  type CompositeOpts,
  type NodeMasteryResult,
  type AggregateMember,
  type AggregateResult,
} from './composite'
export { frontier, frontierComposite, isMastered, isReady, type FrontierNode } from './frontier'
export { pathTo, gapsTo } from './path'
export { remediationFor, type Remediation } from './remediation'
export { prereqGate, competencyMetFactory, type PrereqCheck, type PrereqGateResult } from './prereq-gate'
export { expandRelevance } from './relevant'
