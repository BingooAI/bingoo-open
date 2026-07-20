/** Biên dịch AuthoredItem → Candidate (đầu vào engine). */

import type { Candidate } from '@bingoo/knowledge-engine';
import type { AuthoredItem } from './model';
import { primitiveMeta } from './registry';

/** Đo được không: item khai tường minh, else lấy từ registry theo primitiveKind. */
export function isMeasurable(item: AuthoredItem): boolean {
  if (item.measurable !== undefined) return item.measurable;
  return primitiveMeta(item.primitiveKind)?.measurable ?? false;
}

/** Item đo được → Candidate; phơi bày → null (vào content bank, không phải bank chọn). */
export function compileItem(item: AuthoredItem): Candidate | null {
  if (!isMeasurable(item)) return null;
  return {
    key: item.itemKey,
    skills: item.skills,
    difficulty: item.difficulty,
    kind: item.primitiveKind,
    ...(item.lessonSlug !== undefined ? { lessonSlug: item.lessonSlug } : {}),
  };
}

export interface CompiledBank {
  /** Ứng viên đo được — nạp vào CandidatePort. */
  readonly bank: readonly Candidate[];
  /** itemKey của nội dung phơi bày (content bank, không chọn). */
  readonly exposure: readonly string[];
}

export function compileBank(items: readonly AuthoredItem[]): CompiledBank {
  const bank: Candidate[] = [];
  const exposure: string[] = [];
  for (const item of items) {
    const cand = compileItem(item);
    if (cand) bank.push(cand);
    else exposure.push(item.itemKey);
  }
  return { bank, exposure };
}
