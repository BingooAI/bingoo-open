/** Kiểm AuthoredItem — bảo vệ bất biến neo (no-orphan, đo được cần grader). */

import type { SkillGraph } from '@bingoo/knowledge-engine';
import type { AuthoredItem } from './model';
import { isMeasurable } from './compile';
import { isKnownPrimitive, primitiveMeta } from './registry';

export interface ItemIssue {
  readonly code:
    | 'ITEM_NO_SKILL'
    | 'SKILL_NOT_IN_GRAPH'
    | 'UNKNOWN_PRIMITIVE'
    | 'MEASURABLE_NO_GRADER'
    | 'BAD_DIFFICULTY'
    | 'DUPLICATE_ITEM_KEY';
  readonly severity: 'error' | 'warning';
  readonly itemKey: string;
  readonly message: string;
}

/** Một item: neo có ≥1 skill (có trong graph nếu cấp), đo được thì phải có grader. */
export function validateItem(item: AuthoredItem, graph?: SkillGraph): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const at = (
    code: ItemIssue['code'],
    message: string,
    severity: ItemIssue['severity'] = 'error',
  ): void => {
    issues.push({ code, severity, itemKey: item.itemKey, message });
  };

  if (item.skills.length === 0)
    at('ITEM_NO_SKILL', 'Item không gắn kỹ năng nào (nội dung vô gia cư).');
  if (!isKnownPrimitive(item.primitiveKind))
    at('UNKNOWN_PRIMITIVE', `primitiveKind "${item.primitiveKind}" chưa đăng ký.`, 'warning');
  if (!Number.isFinite(item.difficulty)) at('BAD_DIFFICULTY', 'difficulty không hợp lệ.');

  if (isMeasurable(item) && primitiveMeta(item.primitiveKind)?.graderKind === undefined) {
    at('MEASURABLE_NO_GRADER', 'Item khai đo được nhưng primitive không có cách chấm.');
  }

  if (graph) {
    for (const s of item.skills) {
      if (!graph.has(s)) at('SKILL_NOT_IN_GRAPH', `Kỹ năng "${s}" không có trong đồ thị năng lực.`);
    }
  }
  return issues;
}

/** Cả bank: itemKey trùng → lỗi (idempotency/hiệu chuẩn dựa itemKey). */
export function validateBank(items: readonly AuthoredItem[], graph?: SkillGraph): ItemIssue[] {
  const issues: ItemIssue[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.itemKey)) {
      issues.push({
        code: 'DUPLICATE_ITEM_KEY',
        severity: 'error',
        itemKey: item.itemKey,
        message: `itemKey trùng: ${item.itemKey}`,
      });
    }
    seen.add(item.itemKey);
    issues.push(...validateItem(item, graph));
  }
  return issues;
}
