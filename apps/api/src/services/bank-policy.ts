/**
 * CHÍNH SÁCH ĐỘ DÀY NGÂN HÀNG (rich bank) — mỗi KC cần bao nhiêu bản theo các TRỤC, để vòng-trong của
 * Decision Engine luôn có cái để CHÈN khi học viên sai/hổng mà KHÔNG lặp item. "Rich" CÓ CHỦ ĐÍCH:
 *
 *   biểu diễn (concrete/pictorial/abstract) × độ khó (easy/core/stretch) × nhắm-misconception (mỗi cái 1
 *   item chẩn đoán) × SỐ LƯỢNG mỗi ô theo mức giàu.
 *
 * KHÔNG vô tận (tốn chi phí LLM) — mức `richness` chốt số bản mỗi ô. Đây là NGUỒN cho việc sinh có mục
 * tiêu: policy ra ĐÍCH, coverage đối chiếu bank hiện có → GAP để sinh bù đúng chỗ thiếu.
 *
 * Thuần, không I/O — route/generator dùng; test offline.
 */

export type Band = 'easy' | 'core' | 'stretch'
export type Rep = 'concrete' | 'pictorial' | 'abstract'
export type Richness = 'lean' | 'standard' | 'rich'

const ALL_REPS: readonly Rep[] = ['concrete', 'pictorial', 'abstract']
const ALL_BANDS: readonly Band[] = ['easy', 'core', 'stretch']
/** Số bản MỖI ô (rep×band) theo mức giàu — có chủ đích, không vô tận. */
const PER_CELL: Record<Richness, number> = { lean: 1, standard: 2, rich: 3 }

/** Một ô đích: hoặc ô LƯỚI (rep×band), hoặc ô CHẨN ĐOÁN (nhắm 1 misconception). */
export interface BankSlot {
  readonly representation: Rep
  readonly band: Band
  /** Nếu có → ô chẩn đoán nhắm misconception này (không thuộc lưới rep×band). */
  readonly misconceptionId?: string
  readonly count: number
}

export interface DensityInput {
  /** Biểu diễn KP dạy (từ plan); mặc định cả 3 giai đoạn CPA. */
  readonly representations?: readonly Rep[]
  /** Dải độ khó cần phủ; mặc định cả 3. */
  readonly bands?: readonly Band[]
  /** Misconceptions của KC — mỗi cái 1 ô chẩn đoán. */
  readonly misconceptions?: readonly { readonly id: string }[]
  readonly richness?: Richness
}

/**
 * Ma trận ĐÍCH độ dày cho 1 KC: lưới rep×band (mỗi ô `PER_CELL[richness]` bản) + mỗi misconception 1 ô
 * chẩn đoán (pictorial/core). Đây là mức "đủ dày để chèn không trùng", chốt bởi `richness`.
 */
export function bankDensityPolicy(input: DensityInput): BankSlot[] {
  const reps = input.representations?.length ? input.representations : ALL_REPS
  const bands = input.bands?.length ? input.bands : ALL_BANDS
  const per = PER_CELL[input.richness ?? 'standard']
  const slots: BankSlot[] = []
  for (const representation of reps)
    for (const band of bands) slots.push({ representation, band, count: per })
  for (const m of input.misconceptions ?? [])
    slots.push({ representation: 'pictorial', band: 'core', misconceptionId: m.id, count: 1 })
  return slots
}

/** Tổng số item đích của một ma trận. */
export function bankTargetTotal(slots: readonly BankSlot[]): number {
  return slots.reduce((s, x) => s + x.count, 0)
}

/** Suy BAND từ Elo item (đảo BAND_ELO: 1300/1500/1700, biên giữa). */
export function bandOfElo(elo: number): Band {
  if (elo <= 1400) return 'easy'
  if (elo >= 1600) return 'stretch'
  return 'core'
}

/** Facets đóng dấu trên item (payload.facets) để coverage phân loại. */
export interface BankItemFacets {
  readonly representation?: Rep
  readonly band?: Band
  readonly misconceptionId?: string
}

export interface CoverageRow {
  readonly slot: BankSlot
  readonly have: number
  /** max(0, count - have) — số cần sinh thêm cho ô này. */
  readonly need: number
}

/**
 * Đối chiếu bank hiện có với ĐÍCH → gap mỗi ô. Item xếp vào ô theo facets đã đóng dấu: ô chẩn đoán khớp
 * `misconceptionId`; ô lưới khớp (representation, band). Item chưa đóng dấu facets → không tính vào ô nào.
 */
export function bankCoverage(
  existing: readonly BankItemFacets[],
  target: readonly BankSlot[],
): CoverageRow[] {
  return target.map((slot) => {
    const have = existing.filter((it) =>
      slot.misconceptionId
        ? it.misconceptionId === slot.misconceptionId
        : it.representation === slot.representation && it.band === slot.band,
    ).length
    return { slot, have, need: Math.max(0, slot.count - have) }
  })
}

/** Tổng gap (số item còn thiếu để đạt đích) — để UI hiện "còn thiếu N". */
export function coverageGapTotal(rows: readonly CoverageRow[]): number {
  return rows.reduce((s, r) => s + r.need, 0)
}
