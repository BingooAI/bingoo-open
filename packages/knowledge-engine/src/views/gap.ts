// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * gapReport — một khung chương trình đọc qua bằng chứng của một người học.
 *
 * ## Hai câu khác nhau mà một cái công tắc không phân biệt được
 *
 * Bản đọc cũ trả về đạt / chưa đạt. Nhưng "chưa đạt" gộp hai tình huống mà giáo viên phải xử
 * lý ngược nhau:
 *
 * - **`not-yet`** — đã có bằng chứng, và bằng chứng nói là chưa tới. Việc tiếp theo: dạy.
 * - **`no-evidence`** — chưa từng đo. Việc tiếp theo: đo, chứ không phải dạy lại.
 *
 * Gộp hai cái làm một là đẩy giáo viên đi dạy lại thứ đứa trẻ có thể đã làm được, và bỏ qua
 * thứ chưa ai nhìn tới. Nên `reason` là trường bắt buộc của báo cáo, không phải phần tô điểm.
 *
 * ## Vì sao có mục tiêu không được mang điểm số
 *
 * `methodFor` đã chia: kiến thức và quy trình đo bằng đúng/sai; thái độ, thói quen và hành vi
 * đo bằng TẦN SUẤT quan sát được. ADR 0005 cho phép đo nhóm thứ hai, nhưng chốt rằng in nó ra
 * thành một phần trăm trần trụi là ngoài vòng — và hoãn việc cưỡng chế lại cho "tầng báo cáo
 * khi tầng đó tồn tại". Đây là tầng đó.
 *
 * Nên `reportMode` do dữ liệu quyết định, không do người gọi chọn:
 * - `evidence-only` nếu mục tiêu chạm tới bất kỳ khái niệm nào đo bằng tần suất → chỉ được
 *   hiện SỐ LẦN QUAN SÁT, không có điểm.
 * - `score` cho phần còn lại → điểm KÈM khoảng tin cậy, để chỗ dữ liệu mỏng tự lộ ra là mỏng.
 *
 * Quy tắc "chạm tới bất kỳ" là cố ý bảo thủ: một mục tiêu gồm cả phần đo được lẫn phần chỉ
 * quan sát được thì con số tổng hợp không có nghĩa gì, mà lại trông như có.
 *
 * ## Trung lập với khung chương trình
 *
 * Hàm này không biết "lớp 3", không biết "GDPT", không biết môn nào. Nó nhận một danh sách
 * mục tiêu và đọc chúng qua đồ thị khái niệm dùng chung. Việc CHỌN mục tiêu nào để đọc — theo
 * bậc, theo mạch, theo khung — là một truy vấn của host, không phải một nhánh if ở đây. Đó là
 * lý do cùng một hàm chạy được cho một khung chia theo lớp lẫn một khung chia theo bậc A1–C2.
 */

import type { CompetencyKind } from '../domain'
import { isFrequencyMeasured } from '../domain'
import type { Slug } from '../contracts'
import type { BetaParams, EnginePolicy } from '../policy'
import { REPORTING_UNSEEN_PRIOR } from '../policy'
import type { SkillGraph } from '../graph/build'
import { effectiveMastery, nodeMastery } from '../graph/composite'
import type { SkillMastery } from '../mastery/observe'
import { betaPosterior } from '../mastery/beta'

export type GapStatus = 'achieved' | 'partial' | 'none'

/** Vì sao chưa đạt. `null` khi đã đạt. */
export type GapReason = 'not-yet' | 'no-evidence'

/** Mục tiêu này được phép hiện ra thế nào. Do dữ liệu quyết định, không do người gọi chọn. */
export type ReportMode = 'score' | 'evidence-only'

export interface Interval {
  readonly lo: number
  readonly hi: number
}

/** Một khái niệm mà mục tiêu đòi hỏi, đọc qua bằng chứng của người học. */
export interface ConceptGap {
  readonly slug: Slug
  /** Tên người đọc được. Giao diện KHÔNG được hiện slug — đó là mã máy. */
  readonly title: Readonly<Record<string, string>>
  readonly kind: CompetencyKind
  /** Thiếu một mắt xích REQUIRED là cả mục tiêu chưa đạt — xem `nodeMastery`. */
  readonly required: boolean
  readonly mastery: number
  /** Số lần đã quan sát. 0 nghĩa là chưa ai nhìn tới, KHÁC với nhìn rồi mà chưa được. */
  readonly observations: number
  readonly met: boolean
}

/**
 * Luật nào đã sinh ra con số của mục tiêu.
 *
 * - `weakest-required` — có mắt xích BẮT BUỘC: lấy cái yếu nhất. Thiếu một mắt xích là chưa đạt,
 *   nên trung bình sẽ nói dối (xem `nodeMastery`).
 * - `weighted-average` — không mắt xích nào bắt buộc: trung bình có trọng số.
 * - `direct` — mục tiêu được chấm thẳng, không qua khái niệm nào.
 * - `no-evidence` — chưa một quan sát nào. Không có con số nào để sinh ra.
 */
export type GapRule = 'weakest-required' | 'weighted-average' | 'direct' | 'no-evidence'

/**
 * Vì sao con số là con số đó — phần một người duyệt thật sự đọc.
 *
 * Đây KHÔNG phải suy luận mới. Nó chỉ phơi ra các mảnh mà `nodeMastery` vốn đã dùng, để câu
 * trả lời "vì sao 93%" không phải đi đọc mã nguồn mới có. Mọi lý do là MÃ, không phải câu chữ —
 * giao diện dựng câu {vi,en} từ mã (R4), giống `claim-explain` bên tầng biên soạn.
 */
export interface GapExplanation {
  readonly rule: GapRule
  /**
   * Khái niệm quyết định con số. Với `weakest-required` đây là mắt xích yếu nhất; khoảng tin
   * cậy cũng lấy từ chính nó, nên hai con số nói về cùng một thứ.
   */
  readonly binding: Slug | null
  /** Ngưỡng "đạt" đang áp dụng — không có nó thì mọi phán quyết đạt/chưa đạt là vô căn cứ. */
  readonly cut: number
  /** Tổng số quan sát đứng sau con số này. Mỏng thì khoảng rộng, và đây là lý do. */
  readonly observations: number
  readonly requiredCount: number
  readonly conceptCount: number
}

export interface ObjectiveGap {
  readonly slug: Slug
  readonly title: Readonly<Record<string, string>>
  /** Nhãn bậc riêng của từng khung ("Lớp 3", "A2", "buổi-7"). Chuỗi mờ — engine không diễn giải. */
  readonly stage: string | null
  readonly strand: string | null
  readonly status: GapStatus
  readonly reason: GapReason | null
  readonly reportMode: ReportMode
  /**
   * `null` trong HAI trường hợp, và cả hai đều là "không có gì để in", không phải "bằng không":
   *
   * 1. `reportMode === 'evidence-only'` — nhóm tần suất, một con số là nói quá (ADR 0007).
   * 2. Chưa một quan sát nào. "0%" ở đây đọc ra là *em được không điểm*, trong khi sự thật là
   *    chưa ai chấm. Đúng cái hiểu sai mà `reason: 'no-evidence'` sinh ra để chặn — in kèm một
   *    số 0 thì lời cảnh báo bị chính con số bên cạnh nó vô hiệu hoá.
   */
  readonly mastery: number | null
  readonly interval: Interval | null
  /** Vì sao ra con số đó. Có kể cả khi `mastery` là null — lúc ấy `rule` nói rõ vì sao không có. */
  readonly explanation: GapExplanation
  /** Phần khái niệm đã có ít nhất một quan sát — "đã nhìn tới bao nhiêu phần". */
  readonly coverage: number
  readonly met: readonly Slug[]
  /** Đã đo, chưa tới. Việc tiếp theo: dạy. */
  readonly notYet: readonly Slug[]
  /** Chưa từng đo. Việc tiếp theo: đo. */
  readonly unevidenced: readonly Slug[]
  readonly concepts: readonly ConceptGap[]
}

export interface GapSummary {
  readonly total: number
  readonly achieved: number
  readonly partial: number
  readonly none: number
  /** Mục tiêu chưa đạt CHỈ vì chưa ai đo — con số này nói về việc dạy hay việc đo. */
  readonly awaitingEvidence: number
}

export interface GapReport {
  readonly objectives: readonly ObjectiveGap[]
  readonly summary: GapSummary
}

export interface GapObjective {
  readonly slug: Slug
}

export interface GapReportInput {
  readonly graph: SkillGraph
  readonly states: ReadonlyMap<Slug, SkillMastery>
  readonly objectives: readonly GapObjective[]
}

const EMPTY_TITLE: Readonly<Record<string, string>> = {}

/**
 * Khoảng tin cậy của ĐÚNG con số mà mục tiêu đang báo.
 *
 * Cạm bẫy ở đây đã sập một lần: gộp mọi quan sát của mọi khái niệm lại rồi tính một khoảng
 * chung. Nghe hợp lý, nhưng mastery của mục tiêu KHÔNG phải trung bình gộp — với cạnh REQUIRED
 * nó là mắt xích yếu nhất (`nodeMastery`). Nên khoảng gộp mô tả một đại lượng khác hẳn con số
 * in bên cạnh nó, và có thể không chứa nổi chính con số ấy: điểm 28% kèm khoảng 52–79% là thứ
 * đã thật sự hiện ra trên dữ liệu demo.
 *
 * Nên khoảng lấy từ KHÁI NIỆM RÀNG BUỘC — cái quyết định con số của mục tiêu, tức cái có mastery
 * gần con số đó nhất. Độ bất định của mục tiêu chính là độ bất định của mắt xích ấy.
 *
 * Không có khái niệm nào thì Beta prior tự trả về khoảng rộng nhất, và rộng nhất là đúng: chưa
 * ai đo thì không biết gì thật.
 */
function bindingConcept(concepts: readonly ConceptGap[], objectiveMastery: number): ConceptGap | null {
  return concepts.reduce<ConceptGap | null>((best, c) => {
    if (best === null) return c
    return Math.abs(c.mastery - objectiveMastery) < Math.abs(best.mastery - objectiveMastery) ? c : best
  }, null)
}

function intervalFrom(binding: ConceptGap | null, beta: BetaParams): Interval {
  const observations = binding?.observations ?? 0
  const successes = Math.round(observations * (binding?.mastery ?? 0))
  const post = betaPosterior(successes, observations - successes, beta)
  return { lo: post.lo, hi: post.hi }
}

/**
 * Đọc một danh sách mục tiêu qua bằng chứng của người học.
 *
 * Dùng nhánh BÁO CÁO: `unseenPrior = 0`. Khái niệm chưa từng gặp được tính là 0, không phải
 * 0.25 — prior của nhánh sắp trình tự tồn tại để bộ chọn còn có gì mà so, còn ở đây nó sẽ
 * biến "chưa ai đo" thành một phần tư năng lực từ hư không.
 */
export function gapReport(input: GapReportInput, policy: EnginePolicy): GapReport {
  const { graph, states, objectives } = input
  const cut = policy.certify.cut
  const opts = { unseenPrior: REPORTING_UNSEEN_PRIOR, memo: new Map<Slug, number>() }

  const out: ObjectiveGap[] = objectives.map((obj) => {
    const node = graph.node(obj.slug)
    const edges = graph.mapsTo(obj.slug)

    const concepts: ConceptGap[] = edges.map((e) => {
      const target = graph.node(e.to)
      const state = states.get(e.to)
      const mastery = effectiveMastery(graph, states, e.to, opts)
      return {
        slug: e.to,
        title: target?.title ?? EMPTY_TITLE,
        kind: target?.kind ?? 'KNOWLEDGE',
        required: e.mode === 'REQUIRED',
        mastery,
        observations: state?.attempts ?? 0,
        met: mastery >= cut,
      }
    })

    const rolled = nodeMastery(graph, states, obj.slug, cut, opts)
    const met = concepts.filter((c) => c.met).map((c) => c.slug)
    const unevidenced = concepts.filter((c) => !c.met && c.observations === 0).map((c) => c.slug)
    const notYet = concepts.filter((c) => !c.met && c.observations > 0).map((c) => c.slug)
    const seen = concepts.filter((c) => c.observations > 0).length
    const coverage = concepts.length > 0 ? seen / concepts.length : 0

    const status: GapStatus = rolled.achieved ? 'achieved' : met.length > 0 ? 'partial' : 'none'

    // Chưa đạt mà mọi mắt xích còn thiếu đều chưa ai đo → đây là việc ĐO, không phải việc DẠY.
    const reason: GapReason | null = rolled.achieved
      ? null
      : notYet.length === 0 && unevidenced.length > 0
        ? 'no-evidence'
        : 'not-yet'

    const frequencyTouched = concepts.some((c) => isFrequencyMeasured(c.kind))
    const objectiveIsFrequency = node !== undefined && isFrequencyMeasured(node.kind)
    const reportMode: ReportMode = frequencyTouched || objectiveIsFrequency ? 'evidence-only' : 'score'

    const observations = concepts.reduce((sum, c) => sum + c.observations, 0)
    const requiredCount = concepts.filter((c) => c.required).length
    const binding = bindingConcept(concepts, rolled.pKnown)

    // Chưa một quan sát nào thì KHÔNG có con số nào để in. "0%" ở đây đọc ra là *em được không
    // điểm*; sự thật là chưa ai chấm. Và nó vô hiệu hoá luôn câu cảnh báo ngay bên cạnh, vì
    // người đọc tin con số hơn tin câu chữ.
    const measured = observations > 0
    const showScore = reportMode === 'score' && measured

    const rule: GapRule = !measured
      ? 'no-evidence'
      : concepts.length === 0
        ? 'direct'
        : requiredCount > 0
          ? 'weakest-required'
          : 'weighted-average'

    return {
      slug: obj.slug,
      title: node?.title ?? EMPTY_TITLE,
      stage: node?.stage ?? null,
      strand: node?.strand ?? null,
      status,
      reason,
      reportMode,
      mastery: showScore ? rolled.pKnown : null,
      interval: showScore ? intervalFrom(binding, policy.beta) : null,
      explanation: {
        rule,
        binding: measured ? (binding?.slug ?? null) : null,
        cut,
        observations,
        requiredCount,
        conceptCount: concepts.length,
      },
      coverage,
      met,
      notYet,
      unevidenced,
      concepts,
    }
  })

  return {
    objectives: out,
    summary: {
      total: out.length,
      achieved: out.filter((o) => o.status === 'achieved').length,
      partial: out.filter((o) => o.status === 'partial').length,
      none: out.filter((o) => o.status === 'none').length,
      awaitingEvidence: out.filter((o) => o.reason === 'no-evidence').length,
    },
  }
}
