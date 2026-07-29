// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * SEED DEMO — đủ dữ liệu để nhìn thấy báo cáo lỗ hổng chạy thật.
 *
 * Dựng một người học và một khung nhỏ, cố ý xếp sao cho MỖI NHÁNH của báo cáo đều có ít nhất
 * một ví dụ trên màn hình — kể cả những nhánh dễ bị bỏ quên vì dữ liệu thật hiếm khi rơi vào:
 *
 *   1. đạt                        — mọi mắt xích đều tới ngưỡng
 *   2. một phần · đã đo chưa tới  — có bằng chứng, bằng chứng nói chưa được  → việc tiếp: DẠY
 *   3. chưa có · chưa ai đo       — không một quan sát nào                    → việc tiếp: ĐO
 *   4. chỉ bằng chứng             — mục tiêu thuần thái độ, KHÔNG quy thành điểm (ADR 0007)
 *   5. trộn                       — nửa đo được nửa chỉ quan sát được → vẫn KHÔNG quy thành điểm
 *
 * Nhánh 3 và 5 là hai nhánh đáng nhìn nhất. Nhánh 3 vì nó là thứ bản báo cáo cũ không nói được;
 * nhánh 5 vì luật "chạm tới bất kỳ" nghe thì bảo thủ quá đáng cho tới khi thấy nó chặn một con
 * số vô nghĩa ngay trên màn hình.
 *
 * BẢN QUYỀN: mọi phát biểu ở đây là BỊA, tự viết cho demo. Không trích khung chương trình nào —
 * kể cả diễn giải. Khung thật đi qua luồng upload, không đi qua seed (repo này đã từng phải gỡ
 * một seed mang chương trình của bên khác).
 *
 * Nhãn bậc cố ý đặt là "Bậc 1"/"Bậc 2" chứ không phải "Lớp 3": bậc là chuỗi mờ của từng khung,
 * và một seed ghi "Lớp" sẽ ngầm dạy người đọc rằng hệ hiểu khái niệm lớp. Nó không, và không nên.
 *
 * Idempotent — chạy lại bao nhiêu lần cũng ra cùng một trạng thái.
 *
 * Chạy:
 *   cd apps/api
 *   export DATABASE_URL="$(grep -m1 '^DATABASE_URL=' ../../packages/db/.env | cut -d= -f2- | tr -d '\"')"
 *   pnpm exec tsx src/scripts/seed-gap-demo.ts
 */

import { db } from '@bingoo.ai/db'

const FRAMEWORK_SLUG = 'demo-gap'
const LEARNER_ID = 'demo-learner-gap'
const LEARNER_PUBLIC_ID = 'BGDEMOGAP01'

/**
 * Bằng chứng trên KHÁI NIỆM CỦA HAI KHUNG CÓ SẴN (`seed-crosswalk-demo.ts` đã dựng).
 *
 * Câu chuyện: học viên học xong chương trình Toán lớp 1 của MOET, giờ đọc hồ sơ ấy qua "Khung B".
 * Không phải tình huống bịa cho vui — nó là chính lý do kiến trúc chọn một đồ thị khái niệm dùng
 * chung: mastery bám vào khái niệm nên đọc theo khung nào cũng được, không phải dịch hồ sơ.
 *
 * Đọc qua MOET Lớp 1 → phần lớn ĐẠT.
 * Đọc qua Khung B    → những mục tiêu chạm khái niệm MOET không dạy (nhân, chia, bảng nhân, phân
 *                      số, đếm bước, chẵn lẻ) rơi vào CHƯA AI ĐO — việc tiếp theo là ĐO, không
 *                      phải dạy lại. Đó chính là câu mà bản báo cáo cũ không nói được.
 */
const CROSSWALK_EVIDENCE: ReadonlyArray<readonly [string, number, number]> = [
  // Đã học vững dưới khung MOET.
  ['cw-count-100', 0.93, 34],
  ['cw-place-value-100', 0.88, 27],
  ['cw-compare-100', 0.9, 22],
  ['cw-meaning-addsub', 0.86, 19],
  ['cw-addsub-100', 0.91, 41],
  // Đã đo nhiều lần và vẫn thấp — "chưa tới", khác hẳn "chưa biết".
  ['cw-mental-10', 0.34, 23],
  // Mọi khái niệm riêng của Khung B cố ý KHÔNG có mặt ở đây: cw-multiply, cw-divide,
  // cw-times-tables, cw-unit-fraction, cw-skip-count-100, cw-even-odd-100.
]

type Kind = 'KNOWLEDGE' | 'PROCEDURE' | 'SKILL' | 'DISPOSITION'

interface ConceptSpec {
  readonly slug: string
  readonly vi: string
  readonly en: string
  readonly kind: Kind
  /** Bỏ trống = CHƯA AI ĐO. Đó là một trạng thái thật, không phải dữ liệu thiếu. */
  readonly state?: { readonly pKnown: number; readonly attempts: number }
}

const CONCEPTS: readonly ConceptSpec[] = [
  {
    slug: 'demo-gap-add-carry',
    vi: 'Cộng có nhớ trong phạm vi 100',
    en: 'Addition with carrying within 100',
    kind: 'PROCEDURE',
    state: { pKnown: 0.94, attempts: 38 },
  },
  {
    slug: 'demo-gap-sub-borrow',
    vi: 'Trừ có nhớ trong phạm vi 100',
    en: 'Subtraction with borrowing within 100',
    kind: 'PROCEDURE',
    state: { pKnown: 0.89, attempts: 31 },
  },
  {
    slug: 'demo-gap-place-value',
    vi: 'Giá trị theo vị trí: chục và đơn vị',
    en: 'Place value: tens and ones',
    kind: 'KNOWLEDGE',
    state: { pKnown: 0.91, attempts: 26 },
  },
  {
    // Đã đo nhiều lần và vẫn thấp — đây là "chưa tới", không phải "chưa biết có hay không".
    slug: 'demo-gap-multiply',
    vi: 'Nhân trong phạm vi bảng nhân',
    en: 'Multiplication within the times tables',
    kind: 'PROCEDURE',
    state: { pKnown: 0.28, attempts: 17 },
  },
  {
    // KHÔNG có state: chưa một quan sát nào. Nhánh này là lý do cả tính năng tồn tại.
    slug: 'demo-gap-estimate',
    vi: 'Ước lượng kết quả trước khi tính',
    en: 'Estimating before calculating',
    kind: 'KNOWLEDGE',
  },
  {
    slug: 'demo-gap-group-work',
    vi: 'Tham gia làm việc nhóm',
    en: 'Taking part in group work',
    kind: 'DISPOSITION',
    state: { pKnown: 0.6, attempts: 5 },
  },
  {
    slug: 'demo-gap-reading-habit',
    vi: 'Chủ động tìm sách để đọc',
    en: 'Seeking out books to read',
    kind: 'DISPOSITION',
    state: { pKnown: 0.45, attempts: 3 },
  },
]

interface ObjectiveSpec {
  readonly slug: string
  readonly vi: string
  readonly en: string
  readonly code: string
  readonly stage: string
  readonly strand: string
  readonly mapsTo: readonly string[]
  /** Cái người xem NÊN thấy — ghi ra để chạy xong còn đối chiếu được. */
  readonly expect: string
}

const OBJECTIVES: readonly ObjectiveSpec[] = [
  {
    slug: 'demo-gap-obj-arith-core',
    vi: 'Cộng và trừ có nhớ trong phạm vi 100',
    en: 'Add and subtract with carrying within 100',
    code: 'D1.01',
    stage: 'Bậc 1',
    strand: 'Số học',
    mapsTo: ['demo-gap-add-carry', 'demo-gap-sub-borrow'],
    expect: 'đạt · có điểm kèm khoảng tin cậy',
  },
  {
    slug: 'demo-gap-obj-arith-extend',
    vi: 'Vận dụng giá trị vị trí và phép nhân',
    en: 'Apply place value and multiplication',
    code: 'D2.01',
    stage: 'Bậc 2',
    strand: 'Số học',
    mapsTo: ['demo-gap-place-value', 'demo-gap-multiply'],
    expect: 'một phần · đã đo chưa tới → việc tiếp là DẠY (nhân)',
  },
  {
    slug: 'demo-gap-obj-estimate',
    vi: 'Ước lượng trước khi tính và đối chiếu lại',
    en: 'Estimate before calculating, then check',
    code: 'D2.02',
    stage: 'Bậc 2',
    strand: 'Số học',
    mapsTo: ['demo-gap-estimate'],
    expect: 'chưa có · CHƯA AI ĐO → việc tiếp là ĐO, không phải dạy lại',
  },
  {
    slug: 'demo-gap-obj-collaborate',
    vi: 'Cùng bạn hoàn thành một nhiệm vụ chung',
    en: 'Work with peers to finish a shared task',
    code: 'D1.02',
    stage: 'Bậc 1',
    strand: 'Học cùng nhau',
    mapsTo: ['demo-gap-group-work'],
    expect: 'CHỈ BẰNG CHỨNG · không điểm số (ADR 0007 cách A)',
  },
  {
    slug: 'demo-gap-obj-reading',
    vi: 'Đọc hiểu số liệu trong một bài đọc tự chọn',
    en: 'Read and interpret numbers in a self-chosen text',
    code: 'D2.03',
    stage: 'Bậc 2',
    strand: 'Học cùng nhau',
    mapsTo: ['demo-gap-reading-habit', 'demo-gap-place-value'],
    expect: 'TRỘN đo được + chỉ quan sát được → vẫn không điểm số',
  },
]

async function main(): Promise<void> {
  // ── Người học ────────────────────────────────────────────────────────────
  await db.user.upsert({
    where: { id: LEARNER_ID },
    create: {
      id: LEARNER_ID,
      name: 'Học viên minh hoạ',
      email: `${LEARNER_PUBLIC_ID.toLowerCase()}@id.bingoo.ai`,
      publicId: LEARNER_PUBLIC_ID,
      accountType: 'CHILD',
      status: 'ACTIVE',
      locale: 'vi',
      managedByGuardian: true,
    },
    update: { name: 'Học viên minh hoạ', status: 'ACTIVE' },
  })

  // ── Khung ────────────────────────────────────────────────────────────────
  const framework = await db.framework.upsert({
    where: { slug: FRAMEWORK_SLUG },
    create: {
      slug: FRAMEWORK_SLUG,
      name: { vi: 'Khung minh hoạ — đọc lỗ hổng', en: 'Demo framework — reading gaps' },
      locale: 'vi',
      kind: 'CURRICULUM',
    },
    update: {
      name: { vi: 'Khung minh hoạ — đọc lỗ hổng', en: 'Demo framework — reading gaps' },
    },
  })

  // ── Khái niệm nền ────────────────────────────────────────────────────────
  const conceptIdBySlug = new Map<string, string>()
  for (const c of CONCEPTS) {
    const row = await db.competency.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        kind: c.kind,
        title: { vi: c.vi, en: c.en },
        subject: 'demo',
        strand: 'Số học',
      },
      update: { kind: c.kind, title: { vi: c.vi, en: c.en } },
      select: { id: true },
    })
    conceptIdBySlug.set(c.slug, row.id)
  }

  // ── Mục tiêu + cạnh MAPS_TO ──────────────────────────────────────────────
  for (const o of OBJECTIVES) {
    const obj = await db.competency.upsert({
      where: { slug: o.slug },
      create: {
        slug: o.slug,
        kind: 'OBJECTIVE',
        title: { vi: o.vi, en: o.en },
        code: o.code,
        stage: o.stage,
        strand: o.strand,
        subject: 'demo',
        frameworkId: framework.id,
      },
      update: {
        title: { vi: o.vi, en: o.en },
        code: o.code,
        stage: o.stage,
        strand: o.strand,
        frameworkId: framework.id,
      },
      select: { id: true },
    })

    for (const target of o.mapsTo) {
      const toId = conceptIdBySlug.get(target)
      if (!toId) throw new Error(`Mục tiêu ${o.slug} trỏ tới khái niệm không có: ${target}`)
      await db.capabilityRelation.upsert({
        where: { fromId_toId_relType: { fromId: obj.id, toId, relType: 'MAPS_TO' } },
        create: { fromId: obj.id, toId, relType: 'MAPS_TO', mode: 'REQUIRED', weight: 1 },
        update: { mode: 'REQUIRED', weight: 1 },
      })
    }
  }

  // ── Bằng chứng của người học ─────────────────────────────────────────────
  // Khái niệm không khai `state` thì KHÔNG ghi dòng nào — "chưa ai đo" phải là vắng mặt thật,
  // chứ không phải một dòng attempts = 0. Hai thứ đó đọc ra hai câu khác nhau trên màn hình.
  const nowMs = Date.now()
  for (const c of CONCEPTS) {
    if (!c.state) {
      await db.skillState.deleteMany({ where: { userId: LEARNER_ID, skillSlug: c.slug } })
      continue
    }
    const correct = Math.round(c.state.attempts * c.state.pKnown)
    // Lệch ngày gặp gần nhất theo loại, để lịch ôn theo loại năng lực cũng có gì mà thể hiện.
    const daysAgo = c.kind === 'PROCEDURE' ? 21 : c.kind === 'KNOWLEDGE' ? 9 : 40
    const lastSeenAt = new Date(nowMs - daysAgo * 24 * 60 * 60 * 1000)

    await db.skillState.upsert({
      where: { userId_skillSlug: { userId: LEARNER_ID, skillSlug: c.slug } },
      create: {
        userId: LEARNER_ID,
        skillSlug: c.slug,
        pKnown: c.state.pKnown,
        ability: 1000 + (c.state.pKnown - 0.5) * 400,
        attempts: c.state.attempts,
        correct,
        lastSeenAt,
      },
      update: {
        pKnown: c.state.pKnown,
        ability: 1000 + (c.state.pKnown - 0.5) * 400,
        attempts: c.state.attempts,
        correct,
        lastSeenAt,
      },
    })
  }

  // ── Bằng chứng trên khái niệm của HAI KHUNG CÓ SẴN ───────────────────────
  // Chỉ ghi khi khái niệm đó thật sự tồn tại: seed crosswalk có thể chưa chạy, và khi ấy im
  // lặng bỏ qua vẫn đúng hơn là dựng ra một khái niệm mồ côi không khung nào trỏ tới.
  let crosswalkWritten = 0
  for (const [slug, pKnown, attempts] of CROSSWALK_EVIDENCE) {
    const exists = await db.competency.findUnique({ where: { slug }, select: { id: true } })
    if (!exists) continue
    await db.skillState.upsert({
      where: { userId_skillSlug: { userId: LEARNER_ID, skillSlug: slug } },
      create: {
        userId: LEARNER_ID,
        skillSlug: slug,
        pKnown,
        ability: 1000 + (pKnown - 0.5) * 400,
        attempts,
        correct: Math.round(attempts * pKnown),
        lastSeenAt: new Date(nowMs - 14 * 24 * 60 * 60 * 1000),
      },
      update: {
        pKnown,
        ability: 1000 + (pKnown - 0.5) * 400,
        attempts,
        correct: Math.round(attempts * pKnown),
        lastSeenAt: new Date(nowMs - 14 * 24 * 60 * 60 * 1000),
      },
    })
    crosswalkWritten++
  }

  console.log(`Khung  : ${FRAMEWORK_SLUG} — ${OBJECTIVES.length} mục tiêu, ${CONCEPTS.length} khái niệm`)
  console.log(
    `Khung có sẵn: đã ghi bằng chứng trên ${crosswalkWritten}/${CROSSWALK_EVIDENCE.length} khái niệm nền`,
  )
  console.log(`Học viên: ${LEARNER_ID} (${LEARNER_PUBLIC_ID})`)
  console.log('')
  console.log('Nên thấy gì trên màn hình:')
  for (const o of OBJECTIVES) {
    console.log(`  [${o.stage}] ${o.vi}`)
    console.log(`      → ${o.expect}`)
  }
  console.log('')
  console.log('Trên hai khung có sẵn (nếu seed-crosswalk-demo đã chạy):')
  console.log('  moet-primary-math-g1      → phần lớn ĐẠT; "tính nhẩm trong 10" là ĐÃ ĐO CHƯA TỚI')
  console.log('  demo-primary-math-stage-b → phần dùng chung ĐẠT; nhân/chia/bảng nhân/phân số/')
  console.log('                              đếm bước/chẵn lẻ đều CHƯA AI ĐO → việc tiếp là ĐO')
  console.log('  (hai khung này không khai bậc, nên ô lọc bậc tự ẩn — đúng như thiết kế)')
  console.log('')
  console.log('Mở: http://localhost:3001/vi/users  → tìm "minh hoạ" → Xem → chọn khung.')
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
