/**
 * Data access cho ngân hàng item. AuthoredItem ↔ bảng content_item.
 * Đo được + đã duyệt → Candidate (CandidatePort); tra theo itemKey để chấm (GraderPort).
 */

import { db, type Prisma } from '@bingoo/db';
import type { AuthoredItem } from '@bingoo/authored-item';
import { compileBank } from '@bingoo/authored-item';
import type { Candidate, Slug } from '@bingoo/knowledge-engine';

type ItemStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'PUBLISHED';

function rowToItem(r: {
  itemKey: string;
  skills: string[];
  difficulty: number;
  mode: 'LEARN' | 'MEASURE';
  measurable: boolean;
  primitiveKind: string;
  lessonSlug: string | null;
  payload: unknown;
}): AuthoredItem {
  return {
    itemKey: r.itemKey,
    skills: r.skills,
    difficulty: r.difficulty,
    mode: r.mode,
    measurable: r.measurable,
    primitiveKind: r.primitiveKind,
    ...(r.lessonSlug !== null ? { lessonSlug: r.lessonSlug } : {}),
    payload: r.payload,
  };
}

/** Upsert item theo itemKey (idempotent). Trả số item đã ghi. */
export async function saveItems(
  items: readonly AuthoredItem[],
  status: ItemStatus = 'NEEDS_REVIEW',
): Promise<number> {
  for (const it of items) {
    const payload = it.payload as Prisma.InputJsonValue;
    const base = {
      skills: [...it.skills],
      difficulty: it.difficulty,
      mode: it.mode ?? 'LEARN',
      measurable: it.measurable ?? true,
      primitiveKind: it.primitiveKind,
      ...(it.lessonSlug !== undefined ? { lessonSlug: it.lessonSlug } : {}),
      payload,
    };
    await db.contentItem.upsert({
      where: { itemKey: it.itemKey },
      create: { itemKey: it.itemKey, status, ...base },
      update: base, // giữ nguyên status khi cập nhật nội dung
    });
  }
  return items.length;
}

/** Ứng viên đo được cho CandidatePort: mặc định chỉ item ĐÃ DUYỆT/PHÁT HÀNH, lọc theo skills. */
export async function loadCandidates(scope?: {
  skills?: readonly Slug[];
  statuses?: readonly ItemStatus[];
}): Promise<Candidate[]> {
  const statuses = scope?.statuses ?? (['APPROVED', 'PUBLISHED'] as const);
  const rows = await db.contentItem.findMany({
    where: {
      measurable: true,
      status: { in: [...statuses] },
      ...(scope?.skills && scope.skills.length ? { skills: { hasSome: [...scope.skills] } } : {}),
    },
    select: {
      itemKey: true,
      skills: true,
      difficulty: true,
      mode: true,
      measurable: true,
      primitiveKind: true,
      lessonSlug: true,
      payload: true,
    },
  });
  return compileBank(rows.map(rowToItem)).bank as Candidate[];
}

const ITEM_SELECT = {
  itemKey: true,
  skills: true,
  difficulty: true,
  mode: true,
  measurable: true,
  primitiveKind: true,
  lessonSlug: true,
  payload: true,
} as const;

/** Content HỌC (phơi bày, measurable=false, KHÔNG flashcard) để hiển thị — lọc theo skills/lesson. */
export async function loadExposure(scope?: {
  skills?: readonly Slug[];
  lessonSlug?: string;
  statuses?: readonly ItemStatus[];
}): Promise<AuthoredItem[]> {
  const statuses = scope?.statuses ?? (['APPROVED', 'PUBLISHED'] as const);
  const rows = await db.contentItem.findMany({
    where: {
      measurable: false,
      primitiveKind: { startsWith: 'block:' }, // content block (flashcard = ôn tập, đường riêng)
      status: { in: [...statuses] },
      ...(scope?.skills && scope.skills.length ? { skills: { hasSome: [...scope.skills] } } : {}),
      ...(scope?.lessonSlug ? { lessonSlug: scope.lessonSlug } : {}),
    },
    orderBy: { itemKey: 'asc' }, // itemKey nhúng thứ tự (kc::teach::index)
    select: ITEM_SELECT,
  });
  return rows.map(rowToItem);
}

/** Content ÔN TẬP — flashcard (measurable=false, primitiveKind='flashcard') đã duyệt, lọc theo skills. */
export async function loadFlashcards(scope?: {
  skills?: readonly Slug[];
  itemKeys?: readonly string[];
  statuses?: readonly ItemStatus[];
}): Promise<AuthoredItem[]> {
  const statuses = scope?.statuses ?? (['APPROVED', 'PUBLISHED'] as const);
  const rows = await db.contentItem.findMany({
    where: {
      primitiveKind: 'flashcard',
      status: { in: [...statuses] },
      ...(scope?.itemKeys && scope.itemKeys.length ? { itemKey: { in: [...scope.itemKeys] } } : {}),
      ...(scope?.skills && scope.skills.length ? { skills: { hasSome: [...scope.skills] } } : {}),
    },
    orderBy: { itemKey: 'asc' },
    select: ITEM_SELECT,
  });
  return rows.map(rowToItem);
}

/** Một item để chấm (GraderPort). null nếu không có. */
export async function loadItem(itemKey: string): Promise<AuthoredItem | null> {
  const r = await db.contentItem.findUnique({
    where: { itemKey },
    select: {
      itemKey: true,
      skills: true,
      difficulty: true,
      mode: true,
      measurable: true,
      primitiveKind: true,
      lessonSlug: true,
      payload: true,
    },
  });
  return r ? rowToItem(r) : null;
}

/** Duyệt item (NEEDS_REVIEW → APPROVED) để lọt vào ngân hàng chọn. */
export async function approveItems(itemKeys: readonly string[]): Promise<number> {
  const res = await db.contentItem.updateMany({
    where: { itemKey: { in: [...itemKeys] } },
    data: { status: 'APPROVED' },
  });
  return res.count;
}

/** Item kèm STATUS — cho khu SOÁT per-item ở admin (DRAFT/NEEDS_REVIEW/APPROVED). */
export interface ReviewItem extends AuthoredItem {
  readonly status: ItemStatus;
}

/** Liệt kê item để SOÁT — theo KC (skills chứa) và/hoặc bài, mọi trạng thái đang soạn. */
export async function listItemsForReview(scope: {
  skill?: string;
  lessonSlug?: string;
  statuses?: readonly ItemStatus[];
}): Promise<ReviewItem[]> {
  const statuses = scope.statuses ?? (['DRAFT', 'NEEDS_REVIEW', 'APPROVED'] as const);
  const rows = await db.contentItem.findMany({
    where: {
      status: { in: [...statuses] },
      ...(scope.skill ? { skills: { has: scope.skill } } : {}),
      ...(scope.lessonSlug ? { lessonSlug: scope.lessonSlug } : {}),
    },
    select: {
      itemKey: true,
      skills: true,
      difficulty: true,
      mode: true,
      measurable: true,
      primitiveKind: true,
      lessonSlug: true,
      payload: true,
      status: true,
    },
    orderBy: { itemKey: 'asc' },
  });
  return rows.map((r) => ({ ...rowToItem(r), status: r.status as ItemStatus }));
}

/** Xoá một item (để bỏ bản nháp không ưng). Trả true nếu có xoá. */
export async function deleteItem(itemKey: string): Promise<boolean> {
  const res = await db.contentItem.deleteMany({ where: { itemKey } });
  return res.count > 0;
}

/** Số item hiện có cho (KC, primitiveKind) — để đánh seq cho "sinh mới" không đè "sinh lại". */
export async function countItemsForPrimitive(
  skill: string,
  primitiveKind: string,
): Promise<number> {
  return db.contentItem.count({ where: { skills: { has: skill }, primitiveKind } });
}
