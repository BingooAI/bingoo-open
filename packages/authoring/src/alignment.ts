/**
 * ĐỐI CHIẾU KHUNG — khung thứ 2 trở đi KHÔNG "trích" mà "ánh xạ" vào vốn KC canonical đã có.
 *
 * Vì sao: trích Cambridge ra một tập KC, trích MOET ra tập KC khác, rồi cố gộp hai tập — đó là bài
 * toán SAI (không ngưỡng nào đúng: chặt thì đẻ KC trùng → tách đôi bằng chứng; lỏng thì gộp nhầm →
 * mastery lan sai, hỏng vĩnh viễn không báo lỗi). Bài toán ĐÚNG là bất đối xứng:
 *   khung #1 dựng vốn từ KC  →  khung #2 chỉ ÁNH XẠ objective của nó vào vốn đó.
 *
 * Và phần lớn phán quyết SUY RA ĐƯỢC BẰNG CẤU TRÚC — không cần LLM, không cần ngưỡng:
 *   • khác `object`                        → NEW      (khác hẳn đối tượng tri thức)
 *   • cùng object, mọi facet trùng khít    → SAME     (ứng viên gộp — NGƯỜI chốt)
 *   • cùng object, `scope` bao nhau        → SUBSET/SUPERSET  (count-to-20 ⊂ count-to-100)
 *   • cùng object, facet khác lệch         → OVERLAP  (liên quan nhưng khác → ALIGNS)
 *   • thiếu facet để kết luận              → UNKNOWN  → mới cần LLM phân xử
 *
 * LLM chỉ dùng cho phần dư mơ hồ, và phải trả về BẰNG CHỨNG kiểm chứng được (một câu hỏi mà học sinh
 * làm đúng cái này nhưng sai cái kia), chứ không phải một điểm số cảm tính.
 */

import { compareIdentity, type DomainProfile, type Facets } from '@bingoo.ai/facets'
import type { CompetencyKind, Slug } from '@bingoo.ai/knowledge-engine'

export type AlignVerdict =
  | 'SAME' // cùng một kiến thức → tái dùng slug cũ
  | 'SUBSET' // cái mới HẸP HƠN cái đã có (count-to-20 ⊂ count-to-100) → KC riêng + COMPOSES
  | 'SUPERSET' // cái mới RỘNG HƠN → KC riêng + COMPOSES (chiều ngược)
  | 'OVERLAP' // chồng lấn, không bao nhau → KC riêng + ALIGNS
  | 'NEW' // không liên quan → mint KC mới
  | 'UNKNOWN' // cấu trúc không kết luận được → cần LLM / người

export interface ExistingKc {
  readonly slug: Slug
  readonly title: string
  readonly subject?: string
  readonly facets?: Facets
}

export interface NewConcept {
  readonly tempId: string
  readonly title: string
  readonly kind: CompetencyKind
  readonly subject?: string
  readonly facets?: Facets
}

export interface AlignDecision {
  readonly verdict: AlignVerdict
  /** Trục làm nên phán quyết — bằng chứng kiểm chứng được, không phải điểm số. */
  readonly axes: readonly string[]
  readonly reason: string
  readonly decidedBy: 'structure' | 'llm' | 'human'
}

export interface AlignProposal {
  readonly tempId: string
  readonly title: string
  /**
   * Slug do SERVER mint (chống trùng với đồ thị hiện có) + kind + facets — PHẢI đi kèm đề xuất.
   * Nếu không, client tự chế slug và ghi KC MỚI KHÔNG CÓ FACETS → vi phạm I8 và lần đối chiếu sau
   * không so cấu trúc được với chúng, tức là phá hỏng đúng cái thiết kế facets này.
   */
  readonly slug: Slug
  readonly kind: CompetencyKind
  readonly subject?: string
  readonly facets?: Facets
  /** KC đã có được chọn để đối chiếu (undefined khi NEW). */
  readonly target?: Slug
  readonly targetTitle?: string
  readonly decision: AlignDecision
  /**
   * BẮT BUỘC người duyệt. Máy TỰ QUYẾT được khi và chỉ khi phán quyết là DIFFERENT/NEW/SUBSET/SUPERSET
   * suy ra từ cấu trúc — vì những cái đó không gộp gì cả (an toàn). Mọi thứ dẫn tới GỘP (SAME) hoặc
   * mơ hồ (UNKNOWN/OVERLAP) đều phải qua người: gộp sai là hỏng vĩnh viễn, không có tín hiệu báo lỗi.
   */
  readonly needsHuman: boolean
}

// ── So `scope` theo BAO HÀM (đây là chỗ suy ra SUBSET/SUPERSET mà không cần LLM) ──────────────

type Scope = Readonly<Record<string, string | number>>

/**
 * scope bao nhau không? Cùng bộ khoá, mọi giá trị số của A ≤ B (và có ít nhất một <) → A ⊂ B.
 * Đây chính là thứ làm cho "count within 20" (Cambridge) và "count within 100" (MOET) được nhận ra là
 * HAI KC khác nhau CÓ QUAN HỆ TIÊN QUYẾT — thay vì bị gộp nhầm hoặc bị coi là không liên quan.
 */
export function compareScope(a?: Scope, b?: Scope): 'equal' | 'subset' | 'superset' | 'incomparable' {
  if (!a || !b) return 'incomparable'
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  if (ka.length === 0 || ka.join(',') !== kb.join(',')) return 'incomparable'

  let anyWider = false
  let anyNarrower = false
  for (const k of ka) {
    const va = a[k]
    const vb = b[k]
    if (typeof va !== 'number' || typeof vb !== 'number') {
      if (va !== vb) return 'incomparable' // khoá phi-số khác nhau → không bao nhau
      continue
    }
    if (va === vb) continue
    // Với CẬN DƯỚI, số LỚN HƠN nghĩa là HẸP HƠN: [5,100] KHÔNG chứa [0,20] dù 100 > 20.
    // Không có chỗ này thì hai phạm vi lệch nhau bị tuyên là bao nhau → sinh cạnh tiên quyết SAI
    // theo chiều ngược, và không có gì báo lỗi.
    const wider = isLowerBound(k) ? va < vb : va > vb
    if (wider) anyWider = true
    else anyNarrower = true
  }
  if (anyWider && anyNarrower) return 'incomparable'
  if (anyNarrower) return 'subset'
  if (anyWider) return 'superset'
  return 'equal'
}

/** Khoá là CẬN DƯỚI (min/from/floor…) → lớn hơn = hẹp hơn. Mặc định coi là cận trên. */
function isLowerBound(key: string): boolean {
  return /^(min|from|lower|floor|start|least)/i.test(key)
}

/**
 * Trục ĐỊNH DANH ngoài scope/object có xung đột không.
 *
 * KHÔNG xét trục MÔ TẢ (channel/bloom/representation) ở đây: chúng là phán đoán của LLM và NHIỄU
 * giữa hai lần trích. Trước đây xét cả chúng → nhiễu giết luôn suy luận bao hàm: MOET "within 100"
 * ⊃ Cambridge "within 20" bị hạ xuống OVERLAP chỉ vì LLM ghi channel khác nhau. Đo thật: 9/10 ra
 * OVERLAP vô dụng, không tái dùng nổi KC nào.
 */
function identityConflictApartFromScope(a: Facets, b: Facets, identityAxes: readonly string[]): boolean {
  return identityAxes.some((ax) => {
    if (ax === 'scope' || ax === 'object') return false
    const va = a[ax as keyof Facets]
    const vb = b[ax as keyof Facets]
    return va !== undefined && vb !== undefined && va !== vb
  })
}

/**
 * Phán quyết BẰNG CẤU TRÚC — không LLM, không ngưỡng, tất định.
 * Trả UNKNOWN khi dữ liệu không đủ kết luận (đó là lúc mới cần LLM/người).
 */
export function structuralVerdict(
  next: Facets | undefined,
  existing: Facets | undefined,
  profile?: DomainProfile,
): AlignDecision {
  if (!next || !existing || Object.keys(next).length === 0 || Object.keys(existing).length === 0) {
    return {
      verdict: 'UNKNOWN',
      axes: [],
      reason: 'Thiếu facet ở một trong hai phía — không có căn cứ cấu trúc.',
      decidedBy: 'structure',
    }
  }

  // (1) Khác ĐỐI TƯỢNG TRI THỨC → khác hẳn. "parity" ≠ "addition", dù mọi trục khác giống nhau.
  if (next.object !== undefined && existing.object !== undefined && next.object !== existing.object) {
    return {
      verdict: 'NEW',
      axes: ['object'],
      reason: `Khác đối tượng tri thức ("${next.object}" vs "${existing.object}") → không liên quan.`,
      decidedBy: 'structure',
    }
  }

  // (2) Cùng object: xét bao hàm của `scope` — đây là chỗ ra SUBSET/SUPERSET một cách CƠ HỌC.
  const identityAxes = profile?.identityAxes ?? ['object', 'scope']
  const scopeRel = compareScope(next.scope, existing.scope)
  if (scopeRel === 'subset' || scopeRel === 'superset') {
    if (!identityConflictApartFromScope(next, existing, identityAxes)) {
      return {
        verdict: scopeRel === 'subset' ? 'SUBSET' : 'SUPERSET',
        axes: ['object', 'scope'],
        reason:
          `Cùng đối tượng ("${next.object ?? '?'}") nhưng phạm vi BAO NHAU ` +
          `(${JSON.stringify(next.scope)} vs ${JSON.stringify(existing.scope)}) → HAI KC khác nhau ` +
          'có quan hệ TIÊN QUYẾT, KHÔNG được gộp.',
        decidedBy: 'structure',
      }
    }
    return {
      verdict: 'OVERLAP',
      axes: ['object', 'scope'],
      reason: 'Cùng đối tượng, phạm vi bao nhau nhưng còn lệch trục ĐỊNH DANH khác → chồng lấn (ALIGNS).',
      decidedBy: 'structure',
    }
  }

  // (3) Cùng object, scope không bao nhau: dùng luật định danh chung.
  const id = compareIdentity(next, existing, profile)
  if (id.verdict === 'SAME') {
    return {
      verdict: 'SAME',
      axes: id.axes,
      reason: id.reason,
      decidedBy: 'structure',
    }
  }
  if (id.verdict === 'DIFFERENT') {
    // Cùng đối tượng nhưng lệch ở kênh/mức nhận thức/biểu diễn → liên quan mà khác (không gộp).
    return {
      verdict: 'OVERLAP',
      axes: id.axes,
      reason: `Cùng đối tượng nhưng khác ở ${id.axes.join(', ')} → liên quan nhưng KHÁC KC (ALIGNS).`,
      decidedBy: 'structure',
    }
  }
  return { verdict: 'UNKNOWN', axes: id.axes, reason: id.reason, decidedBy: 'structure' }
}

/** Chỉ phán quyết dẫn tới GỘP hoặc còn mơ hồ mới cần người. Không gộp = an toàn = máy tự đi tiếp. */
export function requiresHuman(v: AlignVerdict): boolean {
  return v === 'SAME' || v === 'UNKNOWN' || v === 'OVERLAP'
}

/** Ghép một khái niệm mới với MỘT ứng viên → đề xuất đối chiếu. */
export function proposeAlignment(
  next: NewConcept,
  existing: ExistingKc | undefined,
  slug: Slug,
  profile?: DomainProfile,
): AlignProposal {
  const base = {
    tempId: next.tempId,
    title: next.title,
    slug,
    kind: next.kind,
    ...(next.subject !== undefined ? { subject: next.subject } : {}),
    ...(next.facets !== undefined ? { facets: next.facets } : {}),
  }
  if (!existing) {
    return {
      ...base,
      decision: {
        verdict: 'NEW',
        axes: [],
        reason: 'Không có KC nào tương tự trong đồ thị → mint mới.',
        decidedBy: 'structure',
      },
      needsHuman: false,
    }
  }
  const decision = structuralVerdict(next.facets, existing.facets, profile)
  return {
    ...base,
    target: existing.slug,
    targetTitle: existing.title,
    decision,
    needsHuman: requiresHuman(decision.verdict),
  }
}
