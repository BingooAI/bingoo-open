/** Lớp phủ chuẩn & di trú — SPEC §9–§10. Change-set thuần để host áp vào store. */

export { compareSemver, nextSemver, formatSemver, type Semver } from './semver';
export {
  slugForVersion,
  cloneObjectivesForward,
  crosswalk,
  repointTags,
  resolveCourseVersion,
  migrationPolicy,
  shouldAutoDrift,
  type ForwardRelType,
  type SourceObjective,
  type LateralEdgeRef,
  type ClonedObjective,
  type ClonedEdge,
  type ClonePlan,
  type VersionObjective,
  type Crosswalk,
  type MigrationPolicy,
} from './versioning';
export { inheritState, splitFactor, mergeStates } from './inherit';
