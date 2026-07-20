/**
 * planQuality — chấm chất lượng Instruction Plan TRÊN đồ thị năng lực (CONTENT-ARCHITECTURE §8,§24).
 * Bắt lỗi LLM hay mắc: trỏ slug không có, dạy sai thứ tự tiên quyết, đánh giá cái chưa dạy,
 * thiếu pedagogy (misconception/representation/tiêu chí). Ra điểm → chặn publish nếu kém.
 */

import { coverageReport, type SkillGraph, type Slug } from '@bingoo/knowledge-engine';
import type { CoursePlan, LessonInstructionPlan } from './model';

export type PlanIssueCode =
  | 'ORPHAN_TARGET'
  | 'UNCOVERED_OBJECTIVE'
  | 'PREREQ_ORDER_VIOLATION'
  | 'ASSESS_WITHOUT_TEACH'
  | 'ASSESSMENT_NO_BLUEPRINT'
  | 'LESSON_NO_ASSESSMENT'
  | 'KP_MISSING_MISCONCEPTION'
  | 'KP_MISSING_REPRESENTATION'
  | 'KP_MISSING_SUCCESS_CRITERIA'
  | 'CONCEPT_UNDERSERVED'
  | 'NO_ARCS'
  | 'KC_NO_ARC'
  | 'KC_NOT_TAUGHT'
  | 'KC_NOT_ASSESSED'
  | 'ARC_PREREQ_ORDER'
  | 'ARC_EMPTY'
  | 'STEP_VAGUE'
  | 'ARC_NO_NOVICE_PATH';

export interface PlanIssue {
  readonly code: PlanIssueCode;
  readonly severity: 'error' | 'warning';
  readonly message: string;
  readonly refs?: readonly string[];
}

export interface PlanQuality {
  readonly issues: readonly PlanIssue[];
  readonly score: number;
  readonly approvable: boolean;
}

function flattenLessons(course: CoursePlan): LessonInstructionPlan[] {
  const out: LessonInstructionPlan[] = [];
  for (const u of course.units) for (const l of u.lessons) out.push(l);
  return out;
}

/** Tập khái niệm khoá dạy (lesson.teaches ∪ KP.targets). */
function taughtConcepts(lessons: readonly LessonInstructionPlan[]): Set<Slug> {
  const taught = new Set<Slug>();
  for (const l of lessons) {
    for (const t of l.teaches) taught.add(t);
    for (const kp of l.knowledgePoints) for (const kc of kp.targets) taught.add(kc);
  }
  return taught;
}

export function planQuality(course: CoursePlan, graph: SkillGraph): PlanQuality {
  const issues: PlanIssue[] = [];
  const err = (code: PlanIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'error', message, ...(refs ? { refs } : {}) });
  };
  const warn = (code: PlanIssueCode, message: string, refs?: string[]): void => {
    issues.push({ code, severity: 'warning', message, ...(refs ? { refs } : {}) });
  };

  const lessons = flattenLessons(course);
  const taught = taughtConcepts(lessons);

  // 1) ANCHOR — mọi slug tham chiếu phải có trong đồ thị
  const anchor = (slug: Slug, where: string): void => {
    if (!graph.has(slug))
      err('ORPHAN_TARGET', `"${slug}" (${where}) không có trong đồ thị năng lực.`, [slug]);
  };
  for (const o of course.objectives) anchor(o, 'course.objective');
  for (const u of course.units) for (const c of u.concepts) anchor(c, 'unit.concepts');
  for (const l of lessons) {
    for (const t of l.teaches) anchor(t, `lesson ${l.slug}.teaches`);
    for (const kp of l.knowledgePoints)
      for (const kc of kp.targets) anchor(kc, `KP ${kp.slug}.targets`);
    for (const a of l.activities ?? []) for (const c of a.concepts) anchor(c, `activity ${a.slug}`);
    if (l.assessment) {
      for (const o of l.assessment.objectives)
        anchor(o, `assessment ${l.assessment.slug}.objectives`);
      for (const b of l.assessment.blueprint) anchor(b.concept, `blueprint ${l.assessment.slug}`);
    }
  }

  // 2) COVERAGE — objective khoá được bài học phủ (qua MAPS_TO/trực tiếp)
  if (course.objectives.length > 0) {
    const cov = coverageReport(graph, course.objectives, new Set(), taught);
    for (const m of cov.missing)
      err('UNCOVERED_OBJECTIVE', `Objective "${m}" chưa được bài nào phủ.`, [m]);
  }

  // 3) PREREQ-ORDER — không dạy khái niệm trước tiên quyết REQUIRED (trong phạm vi khoá)
  const seen = new Set<Slug>();
  for (const l of lessons) {
    const conceptsHere = new Set<Slug>(l.teaches);
    for (const kp of l.knowledgePoints) for (const kc of kp.targets) conceptsHere.add(kc);
    for (const c of conceptsHere) {
      for (const e of graph.prereqsOf(c)) {
        if (e.mode !== 'REQUIRED') continue;
        if (!taught.has(e.from)) continue; // tiên quyết ngoài khoá → coi là nền
        if (!seen.has(e.from) && !conceptsHere.has(e.from)) {
          err(
            'PREREQ_ORDER_VIOLATION',
            `Bài "${l.slug}" dạy "${c}" trước tiên quyết "${e.from}".`,
            [l.slug, c, e.from],
          );
        }
      }
    }
    for (const c of conceptsHere) seen.add(c);
  }

  // 4) ASSESS-TAUGHT + blueprint
  for (const l of lessons) {
    const a = l.assessment;
    if (!a) {
      warn('LESSON_NO_ASSESSMENT', `Bài "${l.slug}" chưa có bài đo.`, [l.slug]);
      continue;
    }
    if (a.blueprint.length === 0)
      err('ASSESSMENT_NO_BLUEPRINT', `Bài đo "${a.slug}" trống blueprint.`, [a.slug]);
    if (a.objectives.length > 0) {
      const cov = coverageReport(graph, a.objectives, new Set(), taught);
      for (const m of cov.missing)
        err('ASSESS_WITHOUT_TEACH', `Bài đo "${a.slug}" đánh giá "${m}" mà khoá chưa dạy.`, [
          a.slug,
          m,
        ]);
    }
  }

  // 5) PRESENCE — mỗi KP đủ pedagogy (thiếu là plan kém, không chỉ neo/thứ tự)
  for (const l of lessons) {
    for (const kp of l.knowledgePoints) {
      if (kp.misconceptions.length === 0)
        warn('KP_MISSING_MISCONCEPTION', `KP "${kp.slug}" thiếu điểm sai (distractor sẽ bừa).`, [
          kp.slug,
        ]);
      if (kp.representations.length === 0)
        warn(
          'KP_MISSING_REPRESENTATION',
          `KP "${kp.slug}" thiếu cách trình bày (explainer sẽ nhạt).`,
          [kp.slug],
        );
      if (kp.successCriteria.length === 0)
        warn('KP_MISSING_SUCCESS_CRITERIA', `KP "${kp.slug}" thiếu tiêu chí đạt.`, [kp.slug]);
    }
  }

  // 6) BALANCE — mỗi khái niệm dạy có ≥1 hoạt động LUYỆN/ĐO. Tính TỪ CẢ HAI nguồn: `activities` (cũ) VÀ
  //    `kcArcs` (mới — một KC được phục vụ nếu arc của nó có bước practice/assessment). Không gộp kcArcs
  //    thì plan kiểu mới (dùng arc, không dùng activities) bị CONCEPT_UNDERSERVED oan → không duyệt được.
  const served = new Set<Slug>();
  for (const l of lessons) {
    for (const a of l.activities ?? []) {
      if (a.purpose === 'teach') continue;
      for (const c of a.concepts) served.add(c);
    }
    for (const arc of l.kcArcs ?? []) {
      if (arc.steps.some((s) => s.deliveryKind === 'practice' || s.deliveryKind === 'assessment'))
        served.add(arc.kc);
    }
  }
  for (const c of taught) {
    if (!served.has(c))
      warn('CONCEPT_UNDERSERVED', `Khái niệm "${c}" chưa có hoạt động luyện/đo.`, [c]);
  }

  // 7) CẤU TRÚC THEO TỪNG KC (kcArcs). Nguyên tắc: mỗi KC một chuỗi bước RIÊNG, mỗi arc phải có bước
  //    DẠY và bước ĐO; các arc xếp theo TIÊN QUYẾT. KHÔNG ép một luồng bước cứng bên trong arc.
  for (const l of lessons) {
    const arcs = l.kcArcs ?? [];
    if (arcs.length === 0) {
      warn('NO_ARCS', `Bài "${l.slug}" chưa chia cấu trúc theo từng KC — nội dung sẽ rời rạc.`, [
        l.slug,
      ]);
      continue;
    }

    const arcOf = new Map<Slug, (typeof arcs)[number]>();
    arcs.forEach((a) => arcOf.set(a.kc, a));
    const arcPos = new Map<Slug, number>();
    arcs.forEach((a, i) => arcPos.set(a.kc, i));

    // Mỗi KC dạy phải có arc riêng; mỗi arc phải có bước DẠY + bước ĐO (không rút ngắn KC nào).
    for (const kc of l.teaches) {
      const arc = arcOf.get(kc);
      if (!arc) {
        warn('KC_NO_ARC', `KC "${kc}" (bài "${l.slug}") không có chuỗi bước riêng.`, [l.slug, kc]);
        continue;
      }
      if (arc.steps.length === 0) {
        warn('ARC_EMPTY', `Chuỗi của KC "${kc}" (bài "${l.slug}") rỗng.`, [l.slug, kc]);
        continue;
      }
      const kinds = new Set(arc.steps.map((s) => s.deliveryKind));
      if (!kinds.has('explainer') && !kinds.has('content'))
        warn(
          'KC_NOT_TAUGHT',
          `KC "${kc}" (bài "${l.slug}") không có bước DẠY (explainer/content).`,
          [l.slug, kc],
        );
      if (!kinds.has('assessment'))
        warn('KC_NOT_ASSESSED', `KC "${kc}" (bài "${l.slug}") không có bước ĐÁNH GIÁ.`, [
          l.slug,
          kc,
        ]);
      // Nội dung mỗi bước phải có brief CỤ THỂ — bước không brief thì generator sinh chung chung.
      for (const s of arc.steps)
        if (!s.brief || !Object.values(s.brief).some((v) => v.trim()))
          warn(
            'STEP_VAGUE',
            `Bước "${s.role}" của KC "${kc}" (bài "${l.slug}") thiếu brief chi tiết.`,
            [l.slug, kc, s.slug],
          );

      // NHÁNH NGƯỜI CHƯA BIẾT phải tồn tại: nếu arc CÓ gắn forStates nhưng KHÔNG bước nào phục vụ
      // 'novice' (kể cả bước mặc định), thì người mới vào không có gì để học. Bước không forStates =
      // mặc định (phục vụ mọi trạng thái) nên arc "một đường" luôn qua; chỉ chặn arc phân nhánh mà bỏ sót novice.
      const tagged = arc.steps.some((s) => s.forStates && s.forStates.length > 0);
      if (tagged) {
        const servesNovice = arc.steps.some(
          (s) => !s.forStates || s.forStates.length === 0 || s.forStates.includes('novice'),
        );
        if (!servesNovice)
          warn(
            'ARC_NO_NOVICE_PATH',
            `KC "${kc}" (bài "${l.slug}") phân nhánh theo trạng thái nhưng KHÔNG có nhánh cho người CHƯA BIẾT (novice).`,
            [l.slug, kc],
          );
      }
    }

    // THỨ TỰ ARC theo tiên quyết: A là tiên quyết REQUIRED của B, cả hai cùng dạy trong bài → arc A
    // phải ĐỨNG TRƯỚC arc B. (Tiên quyết dạy ở bài khác → nền, bỏ qua.)
    const lessonKcs = new Set<Slug>(arcs.map((a) => a.kc));
    for (const kc of lessonKcs) {
      const kcAt = arcPos.get(kc);
      if (kcAt === undefined) continue;
      for (const e of graph.prereqsOf(kc)) {
        if (e.mode !== 'REQUIRED' || !lessonKcs.has(e.from)) continue;
        const preAt = arcPos.get(e.from);
        if (preAt !== undefined && preAt > kcAt)
          warn(
            'ARC_PREREQ_ORDER',
            `Bài "${l.slug}": KC "${kc}" (arc ${kcAt + 1}) đứng TRƯỚC tiên quyết "${e.from}" (arc ${preAt + 1}).`,
            [l.slug, kc, e.from],
          );
      }
    }
  }

  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const score = Math.max(0, 100 - 15 * errors - 5 * warnings);
  return { issues, score, approvable: errors === 0 && score >= 80 };
}

export function hasBlockingIssue(q: PlanQuality): boolean {
  return q.issues.some((i) => i.severity === 'error');
}
