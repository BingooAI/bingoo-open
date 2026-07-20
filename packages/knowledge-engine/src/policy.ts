// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * EnginePolicy — BỔ SUNG §4.
 *
 * Toàn bộ hằng số SPEC §13 thành chính sách override được theo ngữ cảnh (môn / lứa tuổi /
 * chuẩn / tổ chức). Quy tắc thiết kế: MỌI hàm engine nhận `policy` (hoặc mảnh của nó) làm
 * tham số — không hàm nào import hằng số trực tiếp. Golden vectors (SPEC Phụ lục C) phải
 * pass với `DEFAULT_POLICY` nguyên bản: đó là mỏ neo chống lệch.
 */

import type { CompetencyKind, EvidenceActor, EvidenceSource, AssessmentMode } from './domain'
import { EVIDENCE_ACTORS } from './domain'

/**
 * Hai unseen prior là NGỮ NGHĨA CỐ ĐỊNH theo nhánh gọi (SPEC quyết định #5), KHÔNG cho
 * override tự do qua policy — nên đặt làm hằng số cấp module, ngoài EnginePolicy.
 * Nhầm hai giá trị này là sai lệch toàn hệ thống.
 */
export const SEQUENCING_UNSEEN_PRIOR = 0.25
export const REPORTING_UNSEEN_PRIOR = 0

// ── Các mảnh policy ───────────────────────────────────────────────────────────

/** SPEC §3.2 — tham số BKT. */
export interface BktParams {
  readonly pInit: number
  readonly pLearn: number
  readonly pSlip: number
  readonly pGuess: number
  readonly pForgetPerDay: number
}

/** SPEC §3.3 — tham số Elo (đối tượng dịch ngược, K nhỏ hơn ×¼). */
export interface EloParams {
  readonly base: number
  readonly scale: number
  readonly kLearner: number
  readonly kItem: number
}

/** SPEC §3.1 — ngưỡng "đã nắm". */
export interface MasteryParams {
  readonly threshold: number
}

/** SPEC §4.1 + §4.2 — tín hiệu Dreyfus + ngưỡng xếp bậc. */
export interface DreyfusParams {
  readonly acquired: number
  readonly competentAbility: number
  readonly proficientAbility: number
  readonly expertAbility: number
  readonly proficientTransfer: number
  readonly expertFluency: number
  readonly expertIndependence: number
  readonly window: number
  readonly expectedMs: number
  readonly maxHints: number
  readonly shrinkK: number
  readonly neutral: number
}

/** SPEC §5.1 — quy đổi độ tin cậy → trọng số. */
export interface ConfidenceParams {
  readonly latencyRatioPenaltyAt: number
  readonly latencyPenaltyFactor: number
  readonly hintPenaltyPer: number
  readonly hintPenaltyFloor: number
}

/** SPEC §5 — Beta-Binomial cho DISPOSITION. */
export interface BetaParams {
  readonly priorA: number
  readonly priorB: number
  readonly z: number
}

/** SPEC §8 — sắp trình tự thích ứng. */
export interface SequencingParams {
  readonly sessionSize: number
  readonly perSkillDivisor: number
  readonly perKindDivisor: number
  readonly perKindFloor: number
  readonly exploreCap: number
  readonly scoreBucket: number
  readonly startedBonus: number
  readonly remediateBoost: number
  readonly matchWindow: number
  readonly matchFloor: number
}

/** SPEC §8.1/§8.5 — đường cong quên & ưu tiên ôn. */
export interface ReviewParams {
  readonly halfLifeBase: number
  readonly halfLifeSlope: number
  readonly dueThreshold: number
  readonly weakPriorityBase: number
  readonly masteredPriorityBase: number
}

/** BỔ SUNG §3.1 — một dòng ma trận quyền ghi cho một actor. */
export interface EvidenceWriteRule {
  readonly sources: readonly EvidenceSource[]
  readonly modes: readonly AssessmentMode[]
  /** undefined = mọi kind. */
  readonly kinds?: readonly CompetencyKind[]
  readonly maxConfidence?: number
  /** true = mode MEASURE chỉ hợp lệ khi ev.proctored=true. */
  readonly measureRequiresProctored?: boolean
}

export type EvidenceWriteMatrix = Readonly<Record<EvidenceActor, EvidenceWriteRule>>

/** BỔ SUNG §3.1–3.2 — ma trận quyền ghi + trọng số cơ sở người chấm + lấy mẫu snapshot. */
export interface EvidenceParams {
  readonly writeMatrix: EvidenceWriteMatrix
  readonly raterBase: Readonly<Record<EvidenceActor, number>>
  readonly snapshotSampleEvery: number
}

/** SPEC §12 — đo lường chứng chỉ (BỔ SUNG: bắt buộc). */
export interface CertifyParams {
  readonly cut: number
  readonly passRatio: number
  readonly difThreshold: number
  readonly difMinN: number
  readonly eloPerLogit: number
}

export interface EnginePolicy {
  readonly bkt: BktParams
  readonly elo: EloParams
  readonly mastery: MasteryParams
  readonly dreyfus: DreyfusParams
  readonly confidence: ConfidenceParams
  readonly beta: BetaParams
  readonly sequencing: SequencingParams
  readonly review: ReviewParams
  readonly evidence: EvidenceParams
  readonly certify: CertifyParams
}

// ── DEFAULT_POLICY — đúng từng giá trị SPEC §13 ───────────────────────────────

const DEFAULT_WRITE_MATRIX: EvidenceWriteMatrix = {
  LEARNER_SELF: {
    sources: ['QUIZ', 'PROJECT'],
    modes: ['LEARN', 'MEASURE'],
    measureRequiresProctored: true,
  },
  SYSTEM: {
    sources: ['QUIZ', 'PROJECT'],
    modes: ['LEARN', 'MEASURE'],
    measureRequiresProctored: true,
  },
  TEACHER: {
    sources: ['RUBRIC', 'OBSERVATION', 'QUIZ'],
    modes: ['LEARN', 'MEASURE'],
  },
  SUPPORTER: {
    sources: ['OBSERVATION', 'TIME'],
    modes: ['LEARN'],
    kinds: ['DISPOSITION', 'BEHAVIOR', 'ATTITUDE'],
    maxConfidence: 0.6,
  },
  PEER: {
    sources: ['PEER'],
    modes: ['LEARN'],
    maxConfidence: 0.5,
  },
  ASSESSOR: {
    sources: ['QUIZ', 'RUBRIC', 'PROJECT'],
    modes: ['MEASURE'],
  },
}

export const DEFAULT_POLICY: EnginePolicy = {
  bkt: {
    pInit: 0.25,
    pLearn: 0.18,
    pSlip: 0.1,
    pGuess: 0.2,
    pForgetPerDay: 0.03,
  },
  elo: {
    base: 1000,
    scale: 400,
    kLearner: 32,
    kItem: 8,
  },
  mastery: {
    threshold: 0.8,
  },
  dreyfus: {
    acquired: 0.8,
    competentAbility: 1000,
    proficientAbility: 1150,
    expertAbility: 1300,
    proficientTransfer: 0.6,
    expertFluency: 0.7,
    expertIndependence: 0.7,
    window: 30,
    expectedMs: 15_000,
    maxHints: 3,
    shrinkK: 3,
    neutral: 0.5,
  },
  confidence: {
    latencyRatioPenaltyAt: 2,
    latencyPenaltyFactor: 0.85,
    hintPenaltyPer: 0.15,
    hintPenaltyFloor: 0.5,
  },
  beta: {
    priorA: 1,
    priorB: 1,
    z: 1.96,
  },
  sequencing: {
    sessionSize: 10,
    perSkillDivisor: 3,
    perKindDivisor: 2,
    perKindFloor: 2,
    exploreCap: 0.5,
    scoreBucket: 4,
    startedBonus: 1.25,
    remediateBoost: 3,
    matchWindow: 400,
    matchFloor: 0.5,
  },
  review: {
    halfLifeBase: 1,
    halfLifeSlope: 30,
    dueThreshold: 0.4,
    weakPriorityBase: 1,
    masteredPriorityBase: 0.3,
  },
  evidence: {
    writeMatrix: DEFAULT_WRITE_MATRIX,
    raterBase: {
      LEARNER_SELF: 1,
      TEACHER: 1,
      ASSESSOR: 1,
      SUPPORTER: 0.6,
      PEER: 0.5,
      SYSTEM: 1,
    },
    snapshotSampleEvery: 4,
  },
  certify: {
    cut: 0.8,
    passRatio: 0.8,
    difThreshold: 0.2,
    difMinN: 5,
    eloPerLogit: 173.7,
  },
}

// ── resolvePolicy — deep-merge theo lớp + validate range ──────────────────────

/** Patch từng phần: object lồng merge sâu; mảng thay nguyên (write matrix ghi đè cả dòng). */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[] ? T[K] : T[K] extends object ? DeepPartial<T[K]> : T[K]
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return (patch as unknown as T) ?? base
  }
  const out: Record<string, unknown> = { ...base }
  for (const key of Object.keys(patch)) {
    const pv = (patch as Record<string, unknown>)[key]
    if (pv === undefined) continue
    const bv = out[key]
    out[key] = isPlainObject(bv) && isPlainObject(pv) ? deepMerge(bv, pv as DeepPartial<typeof bv>) : pv
  }
  return out as T
}

function assertProb(path: string, v: number): void {
  if (!Number.isFinite(v) || v < 0 || v > 1) {
    throw new RangeError(`EnginePolicy.${path} phải ∈ [0,1], nhận ${String(v)}`)
  }
}

function assertPositive(path: string, v: number): void {
  if (!Number.isFinite(v) || v <= 0) {
    throw new RangeError(`EnginePolicy.${path} phải > 0, nhận ${String(v)}`)
  }
}

function assertNonNegInt(path: string, v: number): void {
  if (!Number.isInteger(v) || v < 0) {
    throw new RangeError(`EnginePolicy.${path} phải là số nguyên ≥ 0, nhận ${String(v)}`)
  }
}

/** Kiểm range để một policy hợp nhất không bao giờ đưa giá trị vô nghĩa vào lõi. */
export function validatePolicy(p: EnginePolicy): void {
  assertProb('bkt.pInit', p.bkt.pInit)
  assertProb('bkt.pLearn', p.bkt.pLearn)
  assertProb('bkt.pSlip', p.bkt.pSlip)
  assertProb('bkt.pGuess', p.bkt.pGuess)
  assertProb('bkt.pForgetPerDay', p.bkt.pForgetPerDay)

  assertPositive('elo.scale', p.elo.scale)
  assertPositive('elo.kLearner', p.elo.kLearner)
  assertPositive('elo.kItem', p.elo.kItem)

  assertProb('mastery.threshold', p.mastery.threshold)
  assertProb('dreyfus.acquired', p.dreyfus.acquired)
  assertProb('dreyfus.proficientTransfer', p.dreyfus.proficientTransfer)
  assertProb('dreyfus.expertFluency', p.dreyfus.expertFluency)
  assertProb('dreyfus.expertIndependence', p.dreyfus.expertIndependence)
  assertPositive('dreyfus.window', p.dreyfus.window)
  assertPositive('dreyfus.expectedMs', p.dreyfus.expectedMs)
  assertPositive('dreyfus.maxHints', p.dreyfus.maxHints)
  assertPositive('dreyfus.shrinkK', p.dreyfus.shrinkK)
  assertProb('dreyfus.neutral', p.dreyfus.neutral)

  assertProb('confidence.latencyPenaltyFactor', p.confidence.latencyPenaltyFactor)
  assertProb('confidence.hintPenaltyPer', p.confidence.hintPenaltyPer)
  assertProb('confidence.hintPenaltyFloor', p.confidence.hintPenaltyFloor)

  assertPositive('beta.priorA', p.beta.priorA)
  assertPositive('beta.priorB', p.beta.priorB)
  assertPositive('beta.z', p.beta.z)

  assertPositive('sequencing.sessionSize', p.sequencing.sessionSize)
  assertPositive('sequencing.perSkillDivisor', p.sequencing.perSkillDivisor)
  assertPositive('sequencing.perKindDivisor', p.sequencing.perKindDivisor)
  assertProb('sequencing.exploreCap', p.sequencing.exploreCap)
  assertPositive('sequencing.matchWindow', p.sequencing.matchWindow)
  assertProb('sequencing.matchFloor', p.sequencing.matchFloor)

  assertProb('review.dueThreshold', p.review.dueThreshold)
  assertPositive('review.halfLifeBase', p.review.halfLifeBase)

  assertNonNegInt('evidence.snapshotSampleEvery', p.evidence.snapshotSampleEvery)
  for (const actor of EVIDENCE_ACTORS) {
    assertProb(`evidence.raterBase.${actor}`, p.evidence.raterBase[actor])
    const rule = p.evidence.writeMatrix[actor]
    if (rule.maxConfidence !== undefined) {
      assertProb(`evidence.writeMatrix.${actor}.maxConfidence`, rule.maxConfidence)
    }
  }

  assertProb('certify.cut', p.certify.cut)
  assertProb('certify.passRatio', p.certify.passRatio)
  assertProb('certify.difThreshold', p.certify.difThreshold)
  assertPositive('certify.difMinN', p.certify.difMinN)
  assertPositive('certify.eloPerLogit', p.certify.eloPerLogit)
}

/**
 * Hợp nhất chính sách: deep-merge trái→phải trên DEFAULT (DEFAULT → domain → ageBand →
 * framework → org → session), rồi validate range. Hàm THUẦN — host quyết định lấy lớp
 * nào từ đâu; engine chỉ merge + kiểm.
 */
export function resolvePolicy(...layers: readonly DeepPartial<EnginePolicy>[]): EnginePolicy {
  let policy: EnginePolicy = DEFAULT_POLICY
  for (const layer of layers) {
    policy = deepMerge(policy, layer)
  }
  validatePolicy(policy)
  return policy
}
