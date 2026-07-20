/**
 * Đấu ngân hàng item vào engine: CandidatePort (kéo ứng viên đo được) + GraderPort (chấm 1 submission).
 * Đây là adapter engine-facing; content là hộp đen — engine chỉ thấy Candidate + Verdict.
 */

import { gradeItem } from '@bingoo/authored-item';
import type {
  CandidatePort,
  GraderPort,
  Slug,
  Submission,
  Verdict,
} from '@bingoo/knowledge-engine';
import { loadCandidates, loadItem } from '../repos/content-item.repo';
import { graderFor } from './graders';
import { AppError } from '../lib/errors';

export interface CandidateScope {
  readonly skills?: readonly Slug[];
}

/** CandidatePort: ứng viên đo được (đã duyệt) lọc theo skills của scope. */
export function buildCandidatePort(): CandidatePort<CandidateScope> {
  return { candidates: (scope) => loadCandidates(scope) };
}

/** GraderPort: tra item theo itemKey → chấm bằng grader quiz thật của core. */
export function buildGraderPort(): GraderPort {
  return {
    async grade(submission: Submission): Promise<Verdict> {
      if (!submission.itemKey) {
        throw AppError.validation([
          { path: 'itemKey', message: 'thiếu itemKey để chấm', code: 'missing_item_key' },
        ]);
      }
      const item = await loadItem(submission.itemKey);
      if (!item) throw AppError.notFound(`Item "${submission.itemKey}" không có trong ngân hàng.`);
      const grader = graderFor(item.primitiveKind);
      if (!grader) {
        throw AppError.validation([
          {
            path: 'itemKey',
            message: `Primitive "${item.primitiveKind}" không tự chấm được (cần rater).`,
            code: 'needs_external_verdict',
          },
        ]);
      }
      return gradeItem(item, submission.payload, grader);
    },
  };
}
