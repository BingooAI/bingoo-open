/** Nhân objective, đối chiếu, di trú course — change-set thuần. SPEC §9. */

import type { FrameworkReleaseType, PrereqMode } from '../domain';
import type { Slug } from '../contracts';
import { formatSemver, type Semver } from './semver';

export type ForwardRelType = 'MAPS_TO' | 'ALIGNS';

/** SPEC §9.2 — slug bản mới có hậu tố phiên bản. */
export function slugForVersion(slug: Slug, v: Semver): Slug {
  return `${slug}@${formatSemver(v)}`;
}

export interface SourceObjective {
  readonly id: string;
  readonly slug: Slug;
  readonly version: number;
}

/** Cạnh MAPS_TO/ALIGNS của objective nguồn (toSlug = concept nền được GIỮ NGUYÊN). */
export interface LateralEdgeRef {
  readonly fromSlug: Slug;
  readonly toSlug: Slug;
  readonly relType: ForwardRelType;
  readonly mode: PrereqMode;
  readonly weight?: number;
}

export interface ClonedObjective {
  readonly sourceId: string;
  readonly sourceSlug: Slug;
  readonly newSlug: Slug;
  readonly newVersion: number;
  readonly supersedesId: string;
  readonly frameworkVersionId: string;
}

export interface ClonedEdge {
  readonly fromSlug: Slug;
  readonly toSlug: Slug;
  readonly relType: ForwardRelType;
  readonly mode: PrereqMode;
  readonly weight?: number;
}

export interface ClonePlan {
  readonly objectives: ClonedObjective[];
  readonly edges: ClonedEdge[];
  readonly skipped: Slug[];
}

/**
 * SPEC §9.2 — kế hoạch nhân objective sang bản mới. Clone verbatim nhưng version+1,
 * supersedesId=nguồn.id, frameworkVersionId=to. Cạnh MAPS_TO/ALIGNS sao lên clone nhưng
 * GIỮ NGUYÊN toSlug (trỏ về cùng concept nền) → đó là lý do SkillState không phải di trú.
 * Idempotent: bỏ qua objective mà slug bản mới đã tồn tại.
 */
export function cloneObjectivesForward(
  objectives: readonly SourceObjective[],
  edges: readonly LateralEdgeRef[],
  toVersion: Semver,
  toVersionId: string,
  existingSlugs: ReadonlySet<Slug>,
): ClonePlan {
  const objs: ClonedObjective[] = [];
  const skipped: Slug[] = [];
  const newSlugBySource = new Map<Slug, Slug>();

  for (const o of objectives) {
    const newSlug = slugForVersion(o.slug, toVersion);
    if (existingSlugs.has(newSlug)) {
      skipped.push(newSlug);
      continue;
    }
    newSlugBySource.set(o.slug, newSlug);
    objs.push({
      sourceId: o.id,
      sourceSlug: o.slug,
      newSlug,
      newVersion: o.version + 1,
      supersedesId: o.id,
      frameworkVersionId: toVersionId,
    });
  }

  const clonedEdges: ClonedEdge[] = [];
  for (const e of edges) {
    const newFrom = newSlugBySource.get(e.fromSlug);
    if (newFrom === undefined) continue; // nguồn bị skip / không thuộc lô
    clonedEdges.push({
      fromSlug: newFrom,
      toSlug: e.toSlug, // GIỮ NGUYÊN
      relType: e.relType,
      mode: e.mode,
      ...(e.weight !== undefined ? { weight: e.weight } : {}),
    });
  }

  return { objectives: objs, edges: clonedEdges, skipped };
}

export interface VersionObjective {
  readonly slug: Slug;
  /** slug objective nguồn bị thay thế; undefined = identity MỚI (cần soạn tay khi MAJOR). */
  readonly supersedesSlug?: Slug;
}

export interface Crosswalk {
  readonly map: ReadonlyMap<Slug, Slug>;
  readonly unmapped: readonly Slug[];
}

/** SPEC §9.3 — map slug cũ → slug mới qua supersedes; unmapped = objective identity mới. */
export function crosswalk(objectives: readonly VersionObjective[]): Crosswalk {
  const map = new Map<Slug, Slug>();
  const unmapped: Slug[] = [];
  for (const o of objectives) {
    if (o.supersedesSlug !== undefined) map.set(o.supersedesSlug, o.slug);
    else unmapped.push(o.slug);
  }
  return { map, unmapped };
}

/** SPEC §9.3 — hoán skillTags qua crosswalk map (host áp cho item/lesson). */
export function repointTags(
  tags: readonly Slug[],
  map: ReadonlyMap<Slug, Slug>,
): { tags: Slug[]; changed: boolean } {
  let changed = false;
  const out = tags.map((t) => {
    const n = map.get(t);
    if (n !== undefined && n !== t) {
      changed = true;
      return n;
    }
    return t;
  });
  return { tags: out, changed };
}

/** SPEC §9.1 — bản ghim cứng thắng; else bản published mới nhất của framework; else null. */
export function resolveCourseVersion(
  course: { readonly frameworkVersionId?: string; readonly frameworkId?: string },
  latestPublished: (frameworkId: string) => string | null,
): string | null {
  if (course.frameworkVersionId) return course.frameworkVersionId;
  if (course.frameworkId) return latestPublished(course.frameworkId);
  return null;
}

export interface MigrationPolicy {
  readonly courseDrift: 'auto' | 'opt-in';
  readonly skillState: 'keep' | 'carry' | 'rebaseline';
}

/** SPEC §9.3 — ba chính sách di trú theo releaseType. */
export function migrationPolicy(releaseType: FrameworkReleaseType): MigrationPolicy {
  if (releaseType === 'PATCH') return { courseDrift: 'auto', skillState: 'keep' };
  if (releaseType === 'MINOR') return { courseDrift: 'opt-in', skillState: 'carry' };
  return { courseDrift: 'opt-in', skillState: 'rebaseline' }; // MAJOR
}

/** SPEC §9.3 — chỉ PATCH tự trôi course đã ghim khi publish. */
export function shouldAutoDrift(releaseType: FrameworkReleaseType): boolean {
  return releaseType === 'PATCH';
}
