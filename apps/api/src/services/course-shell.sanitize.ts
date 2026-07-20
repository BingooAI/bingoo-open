/**
 * LÕI THUẦN của sinh vỏ khoá — biến output LLM (đầy rác, thiếu trường, slug bịa) thành CoursePlan neo
 * vào đồ thị thật. Không I/O, không provider, không db → test được offline (đúng R2: lõi thuần tách
 * khỏi lớp vỏ I/O trong course-shell.service.ts).
 *
 * Đây là chỗ giữ hai lời hứa với người dùng khi nguồn là SÁCH:
 *   ① THỨ TỰ của sách được giữ nguyên (mảng units/lessons theo đúng model trả về, không sắp lại).
 *   ② Bài không map được KC nào VẪN giữ đúng chỗ (bỏ đi là nói dối về cấu trúc sách).
 */

import type { Slug } from '@bingoo/knowledge-engine';
import type { CoursePlan, LessonInstructionPlan, LocalizedText, UnitPlan } from '@bingoo/plans';

export const rec = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;
const strArr = (v: unknown): string[] =>
  arr(v)
    .map(str)
    .filter((s): s is string => s !== undefined);

function loc(v: unknown, fallback = ''): LocalizedText {
  const o = rec(v);
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(o))
    if (typeof val === 'string' && val.trim()) out[k] = val.trim();
  return Object.keys(out).length ? out : { en: fallback, vi: fallback };
}

/** Lấy khối JSON đầu tiên trong text LLM; hỏng → {} (lớp gọi phải tự bắt trường hợp rỗng, không nuốt). */
export function firstJson(text: string): Record<string, unknown> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try {
    return rec(JSON.parse(m[0]));
  } catch {
    return {};
  }
}

export interface SanitizedCourse {
  readonly plan: CoursePlan;
  /** Bài GIỮ LẠI đúng vị trí nhưng chưa neo vào KC nào (ôn tập, kiểm tra, kiến thức ngoài stage…). */
  readonly unmappedLessons: readonly string[];
}

export interface SanitizeOpts {
  /** GIỮ NGUYÊN thứ tự & mọi bài, kể cả bài teaches rỗng (dùng khi nguồn là SÁCH — sách là sự thật). */
  readonly preserveStructure?: boolean;
  readonly frameworkVersionId?: string;
}

/**
 * LLM output → CoursePlan skeleton. Slug lạ (model bịa) bị LOẠI khỏi teaches — vỏ khoá luôn neo vào
 * đồ thị thật. Thứ tự units[]/lessons[] GIỮ NGUYÊN theo mảng model trả về.
 *
 * `preserveStructure` (nguồn = SÁCH): một bài không map được KC nào VẪN được giữ đúng chỗ (teaches
 * rỗng) và ghi vào `unmappedLessons`. Bỏ bài đi là nói dối về cấu trúc sách — người soạn phải tự quyết.
 * Không bật cờ (nguồn = PROMPT): bài rỗng teaches bị loại, vì ở đó không có "cấu trúc gốc" để trung thành.
 */
export function sanitizeCourse(
  o: Record<string, unknown>,
  allowed: ReadonlySet<Slug>,
  opts: SanitizeOpts = {},
): SanitizedCourse {
  const keep = (v: unknown): Slug[] => strArr(v).filter((s) => allowed.has(s));
  const unmapped: string[] = [];

  const units: UnitPlan[] = arr(o.units).map((u, ui): UnitPlan => {
    const uo = rec(u);
    const rawLessons = arr(uo.lessons).map((l, li): LessonInstructionPlan => {
      const lo = rec(l);
      const teaches = keep(lo.teaches);
      const title = loc(lo.title);
      const ref = str(lo.sourceRef);
      if (teaches.length === 0) unmapped.push(ref ?? title.en ?? `u${ui}-l${li}`);
      return {
        slug: str(lo.slug) ?? `u${ui}-l${li}`,
        version: 1,
        title,
        teaches,
        knowledgePoints: [], // vỏ khoá: chi tiết bài sinh sau (/plan/generate)
      };
    });
    // Nguồn SÁCH giữ hết bài (kể cả rỗng teaches). Nguồn PROMPT bỏ bài rỗng.
    const lessons = opts.preserveStructure
      ? rawLessons
      : rawLessons.filter((l) => l.teaches.length > 0);
    return {
      slug: str(uo.slug) ?? `unit-${ui + 1}`,
      version: 1,
      title: loc(uo.title),
      concepts: keep(uo.concepts),
      lessons,
    };
  });

  return {
    plan: {
      slug: str(o.slug) ?? 'course',
      title: loc(o.title, 'Course'),
      objectives: keep(o.objectives),
      units,
      ...(opts.frameworkVersionId !== undefined
        ? { frameworkVersionId: opts.frameworkVersionId }
        : {}),
    },
    unmappedLessons: unmapped,
  };
}
