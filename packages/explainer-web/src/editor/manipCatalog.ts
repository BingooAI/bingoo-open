/**
 * manipCatalog.ts — editor-facing catalog of the engine's interactive
 * manipulatives (41 kits). Labels/subjects are metadata; verbs & defaultParams
 * are read straight from the registry, so adding a kit never touches this file's
 * logic. Used by the Library (insert) and the Inspector (configure + schedule).
 */
import { MANIPULATIVES } from '@bingoo/manipulatives'

export type Subject = 'math' | 'english' | 'science'

const META: Record<string, { label: string; subject: Subject; note?: string }> = {
  numberline: { label: 'Trục số', subject: 'math' },
  base10: { label: 'Khối trăm–chục–đơn vị', subject: 'math' },
  fraction: { label: 'Phân số', subject: 'math' },
  arrayarea: { label: 'Mảng · diện tích', subject: 'math' },
  barmodel: { label: 'Sơ đồ thanh', subject: 'math' },
  graph: { label: 'Đồ thị hàm', subject: 'math' },
  expression: { label: 'Biểu thức', subject: 'math' },
  clock: { label: 'Đồng hồ', subject: 'math' },
  geoshape: { label: 'Hình học biến đổi', subject: 'math' },
  tenframe: { label: 'Khung mười', subject: 'math' },
  partwhole: { label: 'Phần – tổng', subject: 'math' },
  placevalue: { label: 'Bảng giá trị vị trí', subject: 'math' },
  hundredsquare: { label: 'Bảng 100', subject: 'math' },
  fractionwall: { label: 'Tường phân số', subject: 'math' },
  money: { label: 'Tiền · đổi tiền', subject: 'math' },
  measurescale: { label: 'Cân thăng bằng', subject: 'math' },
  datachart: { label: 'Biểu đồ dữ liệu', subject: 'math' },
  venncarroll: { label: 'Venn / Carroll', subject: 'math' },
  spinner: { label: 'Vòng quay xác suất', subject: 'math' },
  net3d: { label: 'Hình khai triển 3D', subject: 'math' },
  coordinategrid: { label: 'Lưới toạ độ', subject: 'math' },
  phonics: { label: 'Ghép âm (phonics)', subject: 'english' },
  wordbuilder: { label: 'Ghép chữ', subject: 'english' },
  syllable: { label: 'Tách âm tiết', subject: 'english' },
  sentence: { label: 'Dựng câu', subject: 'english' },
  wordclass: { label: 'Từ loại', subject: 'english' },
  punctuation: { label: 'Dấu câu', subject: 'english' },
  tense: { label: 'Thì động từ', subject: 'english' },
  morpheme: { label: 'Tiền tố – hậu tố', subject: 'english' },
  story: { label: 'Chuỗi câu chuyện', subject: 'english' },
  alphabet: { label: 'Bảng chữ cái', subject: 'english' },
  states: { label: 'Trạng thái vật chất', subject: 'science' },
  circuit: { label: 'Mạch điện', subject: 'science' },
  forces: { label: 'Lực (mũi tên)', subject: 'science' },
  lifecycle: { label: 'Vòng đời', subject: 'science' },
  foodchain: { label: 'Chuỗi thức ăn', subject: 'science' },
  organism: { label: 'Gán nhãn sinh vật', subject: 'science' },
  orbit: { label: 'Quỹ đạo · ngày đêm', subject: 'science' },
  thermometer: { label: 'Nhiệt kế', subject: 'science' },
  sort: { label: 'Phân loại (chìm/nổi)', subject: 'science' },
  shadow: { label: 'Bóng · ánh sáng', subject: 'science' },
  pattern: {
    label: 'Quy luật lặp',
    subject: 'math',
    note: "Repeating patterns (AB, AAB, ABC...) for ages 4-6: recognise the unit, extend the train, or fill a hidden '?' slot. Key params: unit (colour words red/blue/green/yellow or shape words circle/square/triangle/star), items, hidden; the correct item at index i is always unit[i % unit.length].",
  },
  subitize: {
    label: 'Nhìn nhanh số lượng',
    subject: 'math',
    note: "Subitizing 1-10 for ages 4-6: a dot card in dice/pairs/random/tenframe arrangements; `rearrange` glides the SAME count between layouts, `reveal` flips the card and shows the numeral. Key params: count (1-10), arrangement, revealed (false = face-down '?' card).",
  },
  comparegroups: {
    label: 'So sánh nhiều – ít',
    subject: 'math',
    note: 'More/fewer/equal via one-to-one correspondence for ages 4-6: two counter groups, `pairUp` draws 1-1 pairing lines (leftovers get a warn ring), `showSymbol` derives the true > < = from the counts. Key params: left, right (0-10), leftLabel/rightLabel, paired, symbol.',
  },
  ordinal: {
    label: 'Số thứ tự (1st–10th)',
    subject: 'math',
    note: 'Ordinal numbers 1st..10th as a queue of figures walking toward a flag; counting direction is FROM the flag, and flip() reverses it to show that ordinals depend on direction. Key params: n (queue size, 1-10), highlight (1-based position), facing (\\"left\\"|\\"right\\"), ordinalNames (per-lesson ordinal words, EN defaults).',
  },
  sizeorder: {
    label: 'Sắp xếp theo kích thước',
    subject: 'math',
    note: 'Ordering by size: mode \\"height\\" (bars on a ground line), \\"length\\" (pencils in rows) or \\"size\\" (circles); items glide past each other on swap/sort and the correct order is derived from values. Key params: values (relative magnitudes), order (current arrangement), target (\\"asc\\"|\\"desc\\"), labels & dirLabels (learner-visible words, EN defaults).',
  },
  addstory: {
    label: 'Bài toán có lời văn (+/−)',
    subject: 'math',
    note: 'Addition/subtraction as a story picture: a icons settle on a branch and b icons fly in (+) or away (−) during act(); the number sentence builds progressively and the result is always computed, never authored. Key params: a, b (0-10), op (\\"+\\"|\\"-\\"), icon (\\"bird\\"|\\"fish\\"|\\"apple\\"|\\"dot\\"), assets (media image per icon).',
  },
  integerchips: {
    label: 'Chip số nguyên',
    subject: 'math',
    note: 'Integer +/− counters for grade-6 signed-number addition: plus chips top, minus chips bottom, cancelPairs animates zero pairs one at a time while conserving the value pos−neg. Key params pos/neg/showValue; grade with target {value}.',
  },
  algebratile: {
    label: 'Gạch đại số',
    subject: 'math',
    note: "Algebra-tile mat for modeling and solving linear equations (e.g. 2x+3=7): x-tiles and unit tiles on two sides of an = mat, addBoth/removeBoth keep the balance, splitEqually regroups units into rows per x-tile to show division. Key params left/right {x,units}; grade with target {x} after the learner setAnswer's the solution.",
  },
  equationbalance: {
    label: 'Cân phương trình',
    subject: 'math',
    note: 'Level beam-balance model of ax+b=c: bags labeled x plus b weights on the left pan, c weights on the right; takeFromBoth lifts equal weights off both pans, divideBoth clusters the right side into a groups, and the symbolic equation updates ax+b=c → ax=c−b → x=(c−b)/a. Key params a/b/c; grade with target {x} via setAnswer.',
  },
  functionmachine: {
    label: 'Máy hàm số',
    subject: 'math',
    note: "Linear function y = kx + b as an input→rule→output machine with an accumulating I/O table; keep ruleVisible:false and feed x values so learners induce k and b from the pairs (y is always recomputed, never authored). Grade with target {k,b} (learner must guessRule the machine's rule) or {output, forX} (learner must answer{y} the correct output k·forX+b).",
  },
  ratiotable: {
    label: 'Bảng tỉ số',
    subject: 'math',
    note: 'Ratio/proportion on a double-row table: rows show baseA×m and baseB×m per multiplier column with ×m arrow arcs from column 1, so every cell is computed from the base ratio. Use addColumn{m} to scale up, showUnitRate for the baseB/baseA badge, setBase{a,b} to change the ratio; grade fillCell answers with target {m, row, value}.',
  },
  factortree: {
    label: 'Cây thừa số nguyên tố',
    subject: 'math',
    note: 'Prime factorization tree: split{a,b} (or splitBy{d}) breaks the leftmost composite leaf, only accepted when a·b equals that leaf, so the leaf product always equals n; circlePrimes rings prime leaves and showProduct writes n = p1 × p2 × ... from the sorted leaves. Grade with {factored:true} or {primes:[2,2,3,3]}.',
  },
  unitcircle: {
    label: 'Đường tròn lượng giác',
    subject: 'math',
    note: 'High-school trig unit circle: setAngle glides the radius while sin (vertical drop), cos (horizontal run) and tan (segment on the tangent line x=1) update live. Key params: angle (deg), showSin/showCos/showTan, radians (labels as multiples of pi), sweep (angle arc from 0deg).',
  },
  trianglelab: {
    label: 'Phòng thí nghiệm tam giác',
    subject: 'math',
    note: "Triangle reasoning in 3 modes: 'angles' (angle-sum proof: wedges tear off and line up on 180deg), 'pythagoras' (true-scale squares on a right triangle, areas flow into c^2), 'ratio' (sin/cos/tan as side ratios with theta from the legs). Key params: mode, angles [a,b], legs [adj,opp], ratioFn, highlight, sideNames (learner-visible words); grade with the answer verb against thirdAngle/hyp/ratio targets.",
  },
  transformgrid: {
    label: 'Phép biến hình trên lưới',
    subject: 'math',
    note: 'Geometric transformations of a polygon on a -range..range grid: translate {dx,dy}, reflect {axis:x|y}, rotate {deg:90|180|270} about the origin, dilate {k} from the origin — applied as a chain with ghost intermediates and per-verb annotations (arrow, mirror line, arc, rays). Key params: shape (vertex list in grid units, default L-tromino), transforms, showGhosts, gridRange; grade with target {vertexAt:[x,y]} or {finalHas:[[x,y],...]}.',
  },
  probtree: {
    label: 'Cây xác suất',
    subject: 'math',
    note: "Two-stage probability tree for the multiplication rule: stage1/stage2 are {label,p}[] lists (probabilities are renormalized to sum 1), revealed 0..2 gates the tiers, showProducts prints each leaf's p1×p2 and the Σ=1 check. Grade with target {path:[i,j]} (answer must equal that leaf's product) or {prob} for an explicit value; tolerance 0.001.",
  },
  statplot: {
    label: 'Biểu đồ chấm & thống kê',
    subject: 'math',
    note: "Dot plot with computed mean/median/mode/range markers that glide when the data change — use it to show an outlier dragging the mean but not the median (addData a big value, then showMean/showMedian). Grade with target {stat:'mean'|'median'|'mode'|'range', tol?}: the learner's answer(v) is checked against the TRUE statistic of the current data (default tolerance 0.01).",
  },
  calculusgraph: {
    label: 'Tiếp tuyến & diện tích (giải tích)',
    subject: 'math',
    note: "Calculus intuition on one curve (fn: quadratic x²/8, cubic x³/32, sin 3·sin(x/1.5), x∈[-6,6]): mode 'tangent' glides a point along the curve with the exact-slope tangent + rise/run triangle at x0; mode 'area' draws midpoint-Riemann bars over [a,b] and refine doubles them (cap 64) so Σ visibly converges to the exact ∫ (showValue). Grade with target {of:'slope'} (answer ≈ f'(x0)) or {of:'area'} (answer ≈ F(b)−F(a)); tol default 0.05.",
  },
  vocabcard: {
    label: 'Thẻ từ vựng tranh–chữ',
    subject: 'english',
    note: "Picture-word flashcards for first vocabulary (ages 3-7). Author cards[] with word + built-in icon (cat/dog/sun/ball/fish/tree) or image URL; mode 'flash' flips one big card between picture and word, mode 'match' pairs pictures with rotated word cards (gradable via {allMatched:true}).",
  },
  rhymetime: {
    label: 'Vần điệu (word family)',
    subject: 'english',
    note: "Word-family / rhyming builder (ages 4-7): onsets glide onto a shared rime (-at -> cat, hat, bat). Author rime + onsets[]; showOdd/spotOdd present an odd-one-out that is verified in code (word must not end with the rime). Grade with {rhymes:true} or {odd:true} against the learner's choose(word).",
  },
  minimalpair: {
    label: 'Cặp âm tối thiểu',
    subject: 'english',
    note: "Minimal-pair pronunciation contrast (ages 6-11), e.g. ship/sheep. Author a/b with word + ipa (+ mouth: wide|round|flat|open as the pronunciation cue); the contrasting letters are computed from the two words and rendered big + accent. Grade with {side:'a'|'b'} against choose(side).",
  },
  wordmatch: {
    label: 'Nối cặp từ',
    subject: 'english',
    note: 'Generic word pair matching (ages 4-9): opposites, synonyms, collocations. Author pairs[] of [left, right] words and optional column titles; the right column is deterministically rotated by 1 so matches cross rows, and connect(i) always links the true partner. Grade with {all:true} or {count:n}.',
  },
  cloze: {
    label: 'Điền từ vào đoạn văn',
    subject: 'english',
    note: 'Gap-fill passage with a word bank for IELTS/TOEFL/TOEIC reading and grammar at any level. Mark gaps inside `text` as {1}, {2}, …; `bank` lists the choices and `answers` gives the correct bank index per gap (grading compares filled vs answers).',
  },
  wordform: {
    label: 'Họ từ (word form)',
    subject: 'english',
    note: 'Word-family transformations (decide → decision → decisive → decisively) for TOEIC/TOEFL word-form questions. `family` lists {pos, word} satellites around `root` (suffix after the shared prefix is auto-highlighted); `sentence` = {template with ___, correctPos} grades the placed form.',
  },
  collocation: {
    label: 'Cụm từ cố định (collocation)',
    subject: 'english',
    note: 'Collocation sorting (make/do/have/take + noun) for TOEIC core vocabulary. `verbs` are the column headers; each noun in `nouns` carries `goes` (correct verb index) and optional `art` (article) so the built phrase reads naturally, e.g. make a decision.',
  },
  paraphrase: {
    label: 'Ghép câu đồng nghĩa (paraphrase)',
    subject: 'english',
    note: 'Paraphrase alignment for IELTS: sentence `a` (question) vs sentence `b` (passage) with `links` = chunk alignments as [aTokenIdxs, bTokenIdxs] pairs. Reveal links one by one, or have the learner pick a word in each sentence — the pair is graded against `links` in code.',
  },
  essaymap: {
    label: 'Dàn ý bài luận',
    subject: 'english',
    note: 'Essay structure builder for IELTS Writing Task 2 / academic writing: blocks (hook, thesis, topic, evidence, conclusion) reveal top-down with linking connectives, or are scrambled (badges hidden) for reorder practice graded against the canonical role sequence. Key params: blocks (role+short text), order (scrambled arrangement), connective (linking phrases), mode (\\"build\\"|\\"reorder\\").',
  },
  dialogue: {
    label: 'Hội thoại giao tiếp',
    subject: 'english',
    note: 'Two-speaker conversation builder (TOEIC exchanges, business email chains, speaking role-play): chat bubbles appear turn by turn, functional labels (greeting/request/refusal) can be highlighted, and a scrambled exchange is re-sequenced (correct = authored order). Key params: speakers, turns (who 0|1, text, optional fn label), order (scramble), mode (\\"play\\"|\\"reorder\\"), highlightFn.',
  },
  stresspattern: {
    label: 'Trọng âm từ',
    subject: 'english',
    note: 'Word stress & syllables for academic pronunciation (e.g. 2-syllable-noun rules, PHOtograph vs phoTOgraphy): learner marks the stressed syllable (graded against `stressed`), beat bars tap the true rhythm, and an optional compare pair draws the stress-shift arc. Key params: word, syllables[], stressed (true index), compare {word, syllables, stressed}, showBeats/showCompare.',
  },
  registerscale: {
    label: 'Thang trang trọng',
    subject: 'english',
    note: "Formality register scale for business English (informal / neutral / formal): equivalent sentences are placed onto a 3-zone scale, each placement graded against the variant's true level, with formality-marker phrases underlined on focus. Key params: variants ({text, level 0-2}), markers (per-variant phrases), labels (zone names), placed (learner state).",
  },
}

export const SUBJECTS: { id: Subject; label: string }[] = [
  { id: 'math', label: 'Toán' },
  { id: 'english', label: 'Tiếng Anh' },
  { id: 'science', label: 'Khoa học' },
]

export type ManipInfo = {
  kind: string
  label: string
  subject: Subject
  /** 1-2 EN sentences for the AI manifest: when to use this kit + key params. */
  note?: string
  verbs: string[]
  defaultParams: unknown
}

let cache: ManipInfo[] | null = null
export function manipCatalog(): ManipInfo[] {
  if (cache) return cache
  cache = MANIPULATIVES.map((m) => ({
    kind: m.kind,
    label: META[m.kind]?.label ?? m.kind,
    subject: META[m.kind]?.subject ?? 'math',
    note: META[m.kind]?.note,
    verbs: Object.keys(m.verbs),
    defaultParams: m.defaultParams,
  }))
  return cache
}

export function manipInfo(kind: string): ManipInfo | undefined {
  return manipCatalog().find((m) => m.kind === kind)
}
