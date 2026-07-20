/** Xương sống bằng chứng — BỔ SUNG §3. Cửa ghi có bảo vệ; không lộ fold trần. */

export { validateEvidenceWrite, type EvidenceViolation, type WriteCheck } from './write-matrix';
export { raterWeight, raterWeightParams, type RaterWeightParams } from './rater';
export { toObservations, type EvidenceContext } from './grading';
export { shouldSnapshot, type FoldParams } from './fold';
export { recordEvidence, dedupeAttempt, type RecordResult } from './record';
// Lưu ý: foldEvidence CỐ Ý không export — mọi ghi LEARNER phải qua recordEvidence (§3.3).
