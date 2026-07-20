/**
 * interactions.ts — direct-manipulation descriptors for the sandbox (pure, no
 * React). Maps a kit `kind` → { hint, actions, onTap, onDrag }. Every kit still
 * gets verb buttons for free (the host derives them from `verbs`); the entries
 * here add nicer labels and true tap/drag affordances for the flagship kits.
 * All handlers are pure functions of (params, local-box point, ctx).
 */
import type { AnswerDoc, Interactions, KitAny } from './types';
import { clamp01 } from './easing';
import { RANK } from './essaymap';
import type { ParaLink } from './paraphrase';

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** a hit box in the element's local coords (tap targets derived from a render). */
type HitBox = { x: number; y: number; w: number; h: number };

const REG: Record<string, Interactions<KitAny>> = {
  /* ---- maths (general) ---- */
  numberline: {
    hint: 'Kéo điểm cam dọc trục — hoặc bấm nút.',
    actions: [
      { verb: 'placePoint', label: 'Đặt điểm 3', args: { x: 3 } },
      { verb: 'jump', label: 'Nhảy 0→8', args: { a: 0, b: 8 } },
      { verb: 'mark', label: 'Mốc 5', args: { x: 5 } },
      { verb: 'highlightRange', label: 'Tô 2→7', args: { a: 2, b: 7 } },
    ],
    onDrag(p, pt, ctx) {
      const pad = ctx.box.w * 0.08;
      let v = p.min + ((pt.x - pad) / (ctx.box.w - 2 * pad)) * (p.max - p.min);
      v = Math.max(p.min, Math.min(p.max, Math.round(v / p.step) * p.step));
      return { ...p, point: v, points: p.points.includes(v) ? p.points : [...p.points, v] };
    },
    // No dedicated check → generic field match: target keys must equal the same params fields.
  },
  base10: {
    hint: 'Chạm để thêm 1 đơn vị; bấm “Nhớ” khi đủ 10.',
    actions: [
      { verb: 'add', label: '+1', args: { n: 1 } },
      { verb: 'add', label: '+5', args: { n: 5 } },
      { verb: 'regroup', label: 'Nhớ (đổi 10)' },
      { verb: 'remove', label: '−1', args: { n: 1 } },
    ],
    onTap: () => ({ verb: 'add', args: { n: 1 } }),
    check: (p, t) => p.hundreds * 100 + p.tens * 10 + p.ones === num(t.value),
  },
  fraction: {
    hint: 'Chạm để tô thêm một phần.',
    actions: [
      { verb: 'split', label: 'Chia 4', args: { n: 4 } },
      { verb: 'split', label: 'Chia 6', args: { n: 6 } },
      { verb: 'equivalent', label: '×2', args: { n: 2 } },
    ],
    onTap: (p) => ({ verb: 'shade', args: { k: (p.shaded.length % p.denominator) + 1 } }),
    check: (p, t) => p.denominator === num(t.denominator) && p.shaded.length === num(t.shaded),
  },
  clock: {
    hint: 'Kéo quanh mặt đồng hồ để chỉnh phút.',
    actions: [
      { verb: 'setTime', label: '3:00', args: { h: 3, m: 0 } },
      { verb: 'advance', label: '+15’', args: { min: 15 } },
      { verb: 'showAngle', label: 'Hiện góc' },
    ],
    onDrag(p, pt, ctx) {
      const cx = ctx.box.w / 2,
        cy = ctx.box.h * 0.45; // matches clock render centre
      const a = Math.atan2(pt.y - cy, pt.x - cx) + Math.PI / 2;
      // keep minute continuous → the hand glides (no 6° stepping); grading rounds
      const minute = ((((a / (Math.PI * 2)) * 60) % 60) + 60) % 60;
      return { ...p, minute };
    },
    check: (p, t) => {
      // `t` is the author's target, typed `unknown` — read it defensively rather
      // than assuming the numbers are there.
      const tgt = (t ?? {}) as { minute?: number; hour?: number };
      if (typeof tgt.minute !== 'number') return false;
      const min = (n: number) => ((Math.round(n) % 60) + 60) % 60;
      const hr = (n: number) => ((Math.floor(n) % 12) + 12) % 12;
      return min(p.minute) === min(tgt.minute) && (tgt.hour == null || hr(p.hour) === hr(tgt.hour));
    },
  },
  spinner: {
    hint: 'Chạm vào một ô để quay kim tới đó.',
    actions: [
      { verb: 'spin', label: 'Quay ô 1', args: { to: 0 } },
      { verb: 'spin', label: 'Quay ô 2', args: { to: 1 } },
    ],
    onTap(p, pt, ctx) {
      const cx = ctx.box.w / 2,
        cy = ctx.box.h * 0.52;
      let a = Math.atan2(pt.y - cy, pt.x - cx);
      const total = p.sectors.reduce((s: number, x: { weight: number }) => s + x.weight, 0) || 1;
      let acc = -Math.PI / 2;
      // normalise a into [acc, acc+2π)
      while (a < acc) a += Math.PI * 2;
      for (let i = 0; i < p.sectors.length; i++) {
        const span = (p.sectors[i].weight / total) * Math.PI * 2;
        if (a >= acc && a < acc + span) return { verb: 'spin', args: { to: i } };
        acc += span;
      }
      return { verb: 'spin', args: { to: 0 } };
    },
  },
  tenframe: {
    hint: 'Chạm để thêm chấm; nút để bớt.',
    actions: [
      { verb: 'add', label: '+1', args: { n: 1 } },
      { verb: 'remove', label: '−1', args: { n: 1 } },
      { verb: 'fill', label: 'Đầy khung', args: {} },
    ],
    onTap: (p) =>
      p.count < p.capacity ? { verb: 'add', args: { n: 1 } } : { params: { ...p, count: 0 } },
    check: (p, t) => p.count === num(t.count),
  },
  partwhole: {
    hint: 'Ẩn một phần rồi thử tìm số còn thiếu.',
    actions: [
      { verb: 'findUnknown', label: 'Ẩn phần 2', args: { which: 1 } },
      { verb: 'findUnknown', label: 'Ẩn tổng', args: { which: 'whole' } },
      { verb: 'reveal', label: 'Hiện đáp án' },
    ],
  },
  placevalue: {
    hint: 'Thêm đơn vị tới khi đủ 10 rồi bấm “Đổi 10”.',
    actions: [
      { verb: 'addCounter', label: '+1 đơn vị', args: { col: 2 } },
      { verb: 'exchange', label: 'Đổi 10' },
      { verb: 'partition', label: 'Phân tích' },
    ],
    check: (p, t) => {
      const n = p.digits.length;
      return (
        p.digits.reduce((s: number, d: number, i: number) => s + d * Math.pow(10, n - 1 - i), 0) ===
        num(t.value)
      );
    },
  },
  hundredsquare: {
    hint: 'Chạm ô để làm nổi số; nút xem bội số.',
    actions: [
      { verb: 'highlightMultiples', label: 'Bội 5', args: { k: 5 } },
      { verb: 'highlightMultiples', label: 'Bội 10', args: { k: 10 } },
      { verb: 'countBy', label: 'Đếm cách 2', args: { step: 2 } },
    ],
    onTap(p, pt, ctx) {
      const cell = Math.min((ctx.box.w * 0.92) / p.cols, (ctx.box.h * 0.86) / p.rows);
      const ox = (ctx.box.w - cell * p.cols) / 2,
        oy = (ctx.box.h - cell * p.rows) / 2;
      const c = Math.floor((pt.x - ox) / cell),
        r = Math.floor((pt.y - oy) / cell);
      if (c < 0 || c >= p.cols || r < 0 || r >= p.rows) return null;
      return { verb: 'highlightNumber', args: { n: r * p.cols + c + 1 } };
    },
  },
  money: {
    hint: 'Bấm để bỏ thêm đồng xu vào khay.',
    actions: [
      { verb: 'addCoin', label: '+50¢', args: { value: 50 } },
      { verb: 'addCoin', label: '+20¢', args: { value: 20 } },
      { verb: 'addCoin', label: '+10¢', args: { value: 10 } },
      { verb: 'makeAmount', label: 'Tạo 85¢', args: { amount: 85 } },
    ],
    check: (p, t) => p.coins.reduce((s: number, c: number) => s + c, 0) === num(t.total),
  },
  datachart: {
    hint: 'Thêm dữ liệu và đổi cách biểu diễn.',
    actions: [
      { verb: 'addData', label: '+ Đỏ', args: { label: 'Đỏ', n: 1 } },
      { verb: 'addData', label: '+ Xanh', args: { label: 'Xanh', n: 1 } },
      { verb: 'setMode', label: 'Cột', args: { mode: 'bar' } },
      { verb: 'setMode', label: 'Pictogram', args: { mode: 'picto' } },
      { verb: 'setMode', label: 'Tally', args: { mode: 'tally' } },
    ],
  },
  count: {
    hint: 'Chạm để thêm một vật; bấm đổi loại (táo / sao / hoa).',
    actions: [
      { verb: 'add', label: '+1', args: { n: 1 } },
      { verb: 'remove', label: '−1', args: { n: 1 } },
      { verb: 'setShape', label: '🍎', args: { shape: 'apple' } },
      { verb: 'setShape', label: '⭐', args: { shape: 'star' } },
      { verb: 'setShape', label: '🌸', args: { shape: 'flower' } },
    ],
    onTap: () => ({ verb: 'add', args: { n: 1 } }),
    check: (p, t) => p.count === num(t.count),
  },
  share: {
    hint: 'Đặt số & số nhóm, rồi bấm “Chia” để rải đều.',
    actions: [
      { verb: 'deal', label: 'Chia đều' },
      { verb: 'setGroups', label: '2 nhóm', args: { g: 2 } },
      { verb: 'setGroups', label: '3 nhóm', args: { g: 3 } },
      { verb: 'setGroups', label: '4 nhóm', args: { g: 4 } },
    ],
    check: (p, t) =>
      t.perGroup != null
        ? Math.floor(p.total / p.groups) === num(t.perGroup)
        : p.groups === num(t.groups),
  },
  evenodd: {
    hint: 'Chạm để thêm một vật; xem số chẵn hay lẻ.',
    actions: [
      { verb: 'add', label: '+1', args: { n: 1 } },
      { verb: 'remove', label: '−1', args: { n: 1 } },
      { verb: 'showResult', label: 'Chẵn hay lẻ?' },
    ],
    onTap: () => ({ verb: 'add', args: { n: 1 } }),
    check: (p, t) =>
      t.parity ? (p.number % 2 === 0 ? 'even' : 'odd') === t.parity : p.number === num(t.number),
  },
  estimate: {
    hint: 'Kéo mũi tên để đoán số vật, rồi bấm “Đếm thật”.',
    actions: [
      { verb: 'guess', label: 'Đoán 10', args: { n: 10 } },
      { verb: 'guess', label: 'Đoán 20', args: { n: 20 } },
      { verb: 'reveal', label: 'Đếm thật' },
    ],
    onDrag: (p, pt, ctx) => {
      const jx = ctx.box.w * 0.12,
        jw = ctx.box.w * 0.76;
      const frac = clamp01((pt.x - jx) / jw);
      return { ...p, guess: Math.round(frac * p.max) };
    },
    check: (p, t) => Math.abs(p.guess - p.actual) <= num(t.within ?? 3),
  },
  table: {
    hint: 'Bấm để làm nổi hàng/cột và xem tổng.',
    actions: [
      { verb: 'highlightRow', label: 'Nổi hàng 1', args: { i: 0 } },
      { verb: 'highlightCol', label: 'Nổi cột 1', args: { i: 0 } },
      { verb: 'showTotal', label: 'Hiện tổng' },
      { verb: 'clear', label: 'Bỏ nổi' },
    ],
  },
  measurescale: {
    hint: 'Thêm khối hai bên rồi so sánh.',
    actions: [
      { verb: 'addLeft', label: 'Trái +1', args: { n: 1 } },
      { verb: 'addRight', label: 'Phải +1', args: { n: 1 } },
      { verb: 'compare', label: 'So sánh' },
    ],
  },

  /* ---- English ---- */
  phonics: {
    hint: 'Tách rồi ghép các âm để đọc từ.',
    actions: [
      { verb: 'segment', label: 'Tách âm' },
      { verb: 'sound', label: 'Âm 1', args: { i: 0 } },
      { verb: 'blend', label: 'Ghép âm' },
    ],
  },
  wordbuilder: {
    hint: 'Đổi từng chữ để tạo từ mới.',
    actions: [
      { verb: 'changeLetter', label: 'c → h', args: { i: 0, ch: 'h' } },
      { verb: 'changeLetter', label: 'a → o', args: { i: 1, ch: 'o' } },
    ],
  },
  sentence: {
    hint: 'Sắp lại thứ tự, viết hoa, thêm dấu.',
    actions: [
      { verb: 'reorder', label: 'Sắp đúng', args: { order: [1, 2, 0] } },
      { verb: 'capitalize', label: 'Viết hoa' },
      { verb: 'punctuate', label: 'Dấu chấm', args: { mark: '.' } },
    ],
  },
  wordclass: {
    hint: 'Hiện từng từ loại.',
    actions: [
      { verb: 'revealClass', label: 'Danh từ', args: { cls: 'noun' } },
      { verb: 'revealClass', label: 'Động từ', args: { cls: 'verb' } },
      { verb: 'revealClass', label: 'Tính từ', args: { cls: 'adj' } },
      { verb: 'reveal', label: 'Hiện hết' },
    ],
  },
  tense: {
    hint: 'Chọn thì, hoặc chia đủ ba thì.',
    actions: [
      { verb: 'setTense', label: 'Quá khứ', args: { t: 'past' } },
      { verb: 'setTense', label: 'Tương lai', args: { t: 'future' } },
      { verb: 'conjugate', label: 'Chia đủ' },
    ],
  },
  alphabet: {
    hint: 'Nổi bật chữ, ghép hoa–thường.',
    actions: [
      { verb: 'highlightLetter', label: 'Chữ b', args: { ch: 'b' } },
      { verb: 'matchCase', label: 'B ↔ b', args: { ch: 'b' } },
      { verb: 'showVowels', label: 'Nguyên âm' },
    ],
  },

  /* ---- Science ---- */
  states: {
    hint: 'Đun nóng / làm lạnh để đổi thể.',
    actions: [
      { verb: 'heat', label: 'Đun nóng 🔥' },
      { verb: 'cool', label: 'Làm lạnh ❄️' },
    ],
  },
  circuit: {
    hint: 'Chạm công tắc để đóng / mở mạch.',
    actions: [
      { verb: 'closeSwitch', label: 'Đóng mạch' },
      { verb: 'openSwitch', label: 'Mở mạch' },
    ],
    onTap: (p) => ({ verb: p.closed ? 'openSwitch' : 'closeSwitch' }),
  },
  forces: {
    hint: 'Thêm lực hai bên rồi xem lực tổng.',
    actions: [
      { verb: 'pushLeft', label: 'Trái +1', args: { n: 1 } },
      { verb: 'pushRight', label: 'Phải +1', args: { n: 1 } },
      { verb: 'showNet', label: 'Lực tổng' },
      { verb: 'reset', label: 'Xóa' },
    ],
  },
  thermometer: {
    hint: 'Kéo lên/xuống để đổi nhiệt độ.',
    actions: [
      { verb: 'setTemp', label: 'Sôi 100°', args: { n: 100 } },
      { verb: 'setTemp', label: 'Băng 0°', args: { n: 0 } },
      { verb: 'mark', label: 'Mốc 0°', args: { n: 0 } },
    ],
    onDrag(p, pt, ctx) {
      const top = ctx.box.h * 0.1,
        bot = ctx.box.h * 0.82;
      const frac = clamp01((bot - pt.y) / (bot - top));
      return { ...p, temp: Math.round(p.min + frac * (p.max - p.min)) };
    },
  },
  shadow: {
    hint: 'Kéo Mặt Trời ngang để đổi bóng.',
    actions: [{ verb: 'showRays', label: 'Hiện tia sáng' }],
    onDrag: (p, pt, ctx) => ({ ...p, lightX: clamp01(pt.x / ctx.box.w) }),
  },
  lifecycle: {
    hint: 'Bấm để sang giai đoạn kế.',
    actions: [
      { verb: 'advance', label: 'Giai đoạn kế' },
      { verb: 'reveal', label: 'Hiện mũi tên' },
    ],
  },
  foodchain: {
    hint: 'Nối từng bậc trong chuỗi.',
    actions: [{ verb: 'addLink', label: 'Nối tiếp →' }],
  },
  organism: {
    hint: 'Hiện tên từng bộ phận.',
    actions: [
      { verb: 'revealPart', label: 'Hoa', args: { name: 'hoa' } },
      { verb: 'revealPart', label: 'Lá', args: { name: 'lá' } },
      { verb: 'revealPart', label: 'Thân', args: { name: 'thân' } },
      { verb: 'revealAll', label: 'Hiện hết' },
    ],
  },
  orbit: {
    hint: 'Quay Trái Đất; xem ngày/đêm.',
    actions: [
      { verb: 'orbit', label: 'Quay 180°', args: { to: 180 } },
      { verb: 'showDayNight', label: 'Ngày/đêm' },
      { verb: 'orbit', label: 'Đủ vòng', args: { to: 360 } },
    ],
  },
  sort: {
    hint: 'Bỏ vật vào nhóm chìm / nổi.',
    actions: [
      { verb: 'placeItem', label: 'Đá → Chìm', args: { label: 'Đá', bin: 0 } },
      { verb: 'placeItem', label: 'Gỗ → Nổi', args: { label: 'Gỗ', bin: 1 } },
    ],
  },

  /* ---- early math (mầm non / đầu tiểu học) ---- */
  pattern: {
    hint: 'Chạm để chọn hình tiếp theo; bấm nút để nối dài quy luật.',
    actions: [
      { verb: 'extend', label: 'Nối dài +2', args: { n: 2 } },
      { verb: 'hide', label: 'Ẩn một ô', args: { i: 2 } },
      { verb: 'revealHidden', label: 'Hiện ô ẩn' },
      { verb: 'setUnit', label: 'Quy luật ABC', args: { unit: ['red', 'green', 'yellow'] } },
    ],
    // tap anywhere → cycle the "next item" choice through the unit's tokens
    onTap(p) {
      const u: string[] = Array.isArray(p.unit) ? p.unit : [];
      if (!u.length) return null;
      const i = p.choice ? u.indexOf(p.choice) : -1;
      return { verb: 'chooseNext', args: { v: u[(i + 1) % u.length] } };
    },
    check: (p, t) =>
      t?.choice != null ? p.choice === t.choice : p.choice === p.unit[p.items % p.unit.length],
  },
  subitize: {
    hint: 'Nhìn nhanh rồi đoán số chấm; chạm thẻ để lật.',
    actions: [
      { verb: 'show', label: 'Hiện 4', args: { count: 4, arrangement: 'dice' } },
      { verb: 'show', label: 'Hiện 6', args: { count: 6, arrangement: 'random' } },
      { verb: 'rearrange', label: 'Đổi cách xếp' },
      { verb: 'guess', label: 'Đoán 5', args: { n: 5 } },
      { verb: 'reveal', label: 'Lật thẻ' },
    ],
    onTap: () => ({ verb: 'reveal' }),
    check: (p, t) => (t?.count != null ? p.guess === num(t.count) : p.guess === p.count),
  },
  comparegroups: {
    hint: 'Chạm nửa trái / phải để thêm vật; ghép 1–1 rồi chọn dấu.',
    actions: [
      { verb: 'pairUp', label: 'Ghép 1–1' },
      { verb: 'showSymbol', label: 'Hiện dấu' },
      { verb: 'chooseSymbol', label: 'Chọn >', args: { s: '>' } },
      { verb: 'chooseSymbol', label: 'Chọn <', args: { s: '<' } },
      { verb: 'chooseSymbol', label: 'Chọn =', args: { s: '=' } },
    ],
    // tap the first group's half → addLeft, the other half → addRight
    // (portrait stacks the groups vertically — keep in sync with comparegroups.ts render)
    onTap(p, pt, ctx) {
      const first = ctx.box.h > ctx.box.w ? pt.y < ctx.box.h / 2 : pt.x < ctx.box.w / 2;
      return { verb: first ? 'addLeft' : 'addRight', args: { n: 1 } };
    },
    check: (p, t) =>
      t?.symbol != null
        ? p.choice === t.symbol
        : p.choice === (p.left > p.right ? '>' : p.left < p.right ? '<' : '='),
  },
  ordinal: {
    hint: 'Chạm một bạn trong hàng để tô vị trí; “Đổi hướng” để thấy thứ tự đổi theo.',
    actions: [
      { verb: 'highlightPos', label: 'Thứ nhất', args: { pos: 1 } },
      { verb: 'highlightPos', label: 'Thứ ba', args: { pos: 3 } },
      { verb: 'flip', label: 'Đổi hướng' },
      { verb: 'setCount', label: '6 bạn', args: { n: 6 } },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with ordinal.ts render layout (queue span per facing)
      const right = p.facing !== 'left';
      const qx0 = right ? ctx.box.w * 0.06 : ctx.box.w * 0.2;
      const qx1 = right ? ctx.box.w * 0.8 : ctx.box.w * 0.94;
      const sw = (qx1 - qx0) / Math.max(1, p.n);
      const i = Math.floor((pt.x - qx0) / sw);
      if (i < 0 || i >= p.n) return null;
      return { verb: 'highlightPos', args: { pos: right ? p.n - i : i + 1 } };
    },
    check: (p, t) => p.highlight != null && p.highlight === num(t.pos),
  },
  sizeorder: {
    hint: 'Chạm hai vật để đổi chỗ cho nhau; bấm “Sắp xếp” để xem thứ tự đúng.',
    actions: [
      { verb: 'sort', label: 'Sắp xếp' },
      { verb: 'setTarget', label: 'Bé → lớn', args: { dir: 'asc' } },
      { verb: 'setTarget', label: 'Lớn → bé', args: { dir: 'desc' } },
      { verb: 'shuffle', label: 'Xáo lại', args: { order: [2, 0, 1] } },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with sizeorder.ts render layout (slot geometry per mode)
      const len = p.values.length;
      let slot = -1;
      if (p.mode === 'length') {
        const top = ctx.box.h * 0.2;
        const rowH = Math.min((ctx.box.h * 0.68) / len, ctx.box.h * 0.2);
        slot = Math.floor((pt.y - top) / rowH);
      } else {
        const x0 = ctx.box.w * 0.06;
        const sw = (ctx.box.w * 0.88) / len;
        slot = Math.floor((pt.x - x0) / sw);
      }
      if (slot < 0 || slot >= len) return { params: { ...p, sel: null } };
      if (p.sel == null) return { params: { ...p, sel: slot } }; // first tap selects
      if (p.sel === slot) return { params: { ...p, sel: null } }; // same tap deselects
      return { verb: 'swap', args: { i: p.sel, j: slot } }; // second tap swaps
    },
    check: (p, t) => {
      if (!t?.sorted) return false;
      const seq = p.order.map((i: number) => p.values[i]);
      return seq.every(
        (v: number, k: number) =>
          k === 0 || (p.target === 'desc' ? seq[k - 1] >= v : seq[k - 1] <= v),
      );
    },
  },
  addstory: {
    hint: 'Bấm “Diễn” để xem nhóm bay vào (hoặc bay đi), rồi “Kết quả”.',
    actions: [
      { verb: 'act', label: 'Diễn' },
      { verb: 'showResult', label: 'Kết quả' },
      { verb: 'setStory', label: '5 − 2', args: { a: 5, b: 2, op: '-' } },
      { verb: 'setStory', label: '3 + 2', args: { a: 3, b: 2, op: '+' } },
      { verb: 'reset', label: 'Làm lại' },
    ],
    onTap: () => ({ verb: 'act' }),
    check: (p, _t) => p.answer != null && num(p.answer) === (p.op === '-' ? p.a - p.b : p.a + p.b),
  },

  /* ---- secondary math (THCS / THPT) ---- */
  integerchips: {
    hint: 'Chạm nửa trên thêm chip dương, nửa dưới thêm chip âm; bấm để triệt tiêu cặp.',
    actions: [
      { verb: 'addPos', label: '+1 dương', args: { n: 1 } },
      { verb: 'addNeg', label: '+1 âm', args: { n: 1 } },
      { verb: 'cancelPairs', label: 'Triệt tiêu cặp', args: {} },
      { verb: 'showValue', label: 'Hiện giá trị', args: {} },
    ],
    // keep in sync with integerchips.ts render: plus zone is the top half, minus zone the bottom half
    onTap: (_p, pt, ctx) =>
      pt.y < ctx.box.h / 2
        ? { verb: 'addPos', args: { n: 1 } }
        : { verb: 'addNeg', args: { n: 1 } },
    check: (p, t) => p.pos - p.neg === num(t.value),
  },
  algebratile: {
    hint: 'Bớt cùng số gạch ở hai vế, rồi chia đều để tìm x.',
    actions: [
      { verb: 'removeBoth', label: 'Bớt 1 đơn vị hai vế', args: { units: 1 } },
      { verb: 'removeBoth', label: 'Bớt 1 gạch x hai vế', args: { x: 1 } },
      { verb: 'splitEqually', label: 'Chia đều', args: {} },
      { verb: 'showSolution', label: 'Hiện nghiệm', args: {} },
    ],
    check: (p, t) => {
      const d = num(p?.left?.x) - num(p?.right?.x);
      if (d === 0 || p.answer == null) return false;
      const sol = (num(p?.right?.units) - num(p?.left?.units)) / d;
      return (
        Math.abs(num(p.answer) - sol) <= 1e-6 && (t?.x == null || Math.abs(num(t.x) - sol) <= 1e-6)
      );
    },
  },
  equationbalance: {
    hint: 'Bớt quả cân hai bên, rồi chia đều cho số túi x.',
    actions: [
      { verb: 'takeFromBoth', label: 'Bớt −b hai bên', args: {} },
      { verb: 'divideBoth', label: 'Chia đều', args: {} },
      { verb: 'showX', label: 'Hiện x', args: {} },
    ],
    check: (p, t) => {
      const a = num(p.a) || 1;
      const sol = (num(p.c) - num(p.b)) / a;
      if (p.answer == null) return false;
      return (
        Math.abs(num(p.answer) - sol) <= 1e-6 && (t?.x == null || Math.abs(num(t.x) - sol) <= 1e-6)
      );
    },
  },
  functionmachine: {
    hint: 'Thả số vào máy rồi đoán quy tắc từ bảng vào–ra.',
    actions: [
      { verb: 'feed', label: 'Thả 3', args: { x: 3 } },
      { verb: 'feed', label: 'Thả 5', args: { x: 5 } },
      { verb: 'revealRule', label: 'Lộ quy tắc' },
      { verb: 'clear', label: 'Xóa bảng' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with functionmachine.ts render (machineBox)
      const portrait = ctx.box.h > ctx.box.w;
      const mx = portrait ? ctx.box.w * 0.5 : ctx.box.w * 0.34;
      const my = portrait ? ctx.box.h * 0.26 : ctx.box.h * 0.46;
      const mw = portrait ? ctx.box.w * 0.56 : ctx.box.w * 0.3;
      const mh = portrait ? ctx.box.h * 0.22 : ctx.box.h * 0.4;
      if (Math.abs(pt.x - mx) <= mw / 2 && Math.abs(pt.y - my) <= mh / 2)
        return { verb: 'revealRule' };
      return null;
    },
    // target {k,b}: learner's guessRule must match the machine's rule.
    // target {output, forX}: learner's answer (via answer{y}) must equal k·forX + b.
    check(p, t) {
      if (t?.output != null && t?.forX != null) {
        return (
          p.answer != null &&
          num(p.answer) === num(t.output) &&
          p.rule.k * num(t.forX) + p.rule.b === num(t.output)
        );
      }
      if (t?.k != null && t?.b != null) {
        return (
          !!p.guess &&
          num(p.guess.k) === num(t.k) &&
          num(p.guess.b) === num(t.b) &&
          p.rule.k === num(t.k) &&
          p.rule.b === num(t.b)
        );
      }
      return false;
    },
  },
  ratiotable: {
    hint: 'Nhân cả hai hàng với cùng một số để mở rộng bảng tỉ số.',
    actions: [
      { verb: 'addColumn', label: '×2', args: { m: 2 } },
      { verb: 'addColumn', label: '×5', args: { m: 5 } },
      { verb: 'showUnitRate', label: 'Tỉ lệ đơn vị' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with ratiotable.ts render (table geometry)
      const n = p.columns.length;
      if (ctx.box.h > ctx.box.w) {
        const y0 = ctx.box.h * 0.16;
        const rowH = Math.min(ctx.box.h * 0.1, (ctx.box.h * 0.72) / Math.max(n, 2));
        const i = Math.floor((pt.y - y0) / rowH);
        if (i >= 0 && i < n) return { verb: 'highlight', args: { m: p.columns[i] } };
        return null;
      }
      const x0 = ctx.box.w * 0.05,
        lw = ctx.box.w * 0.15,
        tw = ctx.box.w * 0.9;
      const colW = (tw - lw) / Math.max(n, 2);
      const i = Math.floor((pt.x - x0 - lw) / colW);
      if (i >= 0 && i < n) return { verb: 'highlight', args: { m: p.columns[i] } };
      return null;
    },
    // target {m, row:"A"|"B", value}: the learner's fillCell answer for column m
    // must equal the true cell base×m (value is the authored expected truth).
    check(p, t) {
      if (!p.filled || t?.m == null || (t?.row !== 'A' && t?.row !== 'B')) return false;
      const truth = (t.row === 'A' ? p.baseA : p.baseB) * num(t.m);
      return (
        p.filled.row === t.row &&
        num(p.filled.m) === num(t.m) &&
        Math.abs(num(p.filled.v) - truth) < 1e-6 &&
        (t.value == null || Math.abs(num(t.value) - truth) < 1e-6)
      );
    },
  },
  factortree: {
    hint: 'Tách dần tới khi mọi lá đều là số nguyên tố.',
    actions: [
      { verb: 'splitBy', label: 'Tách ×2', args: { d: 2 } },
      { verb: 'splitBy', label: 'Tách ×3', args: { d: 3 } },
      { verb: 'circlePrimes', label: 'Khoanh nguyên tố' },
      { verb: 'showProduct', label: 'Hiện tích' },
    ],
    // target {factored:true}: every leaf is prime.
    // target {primes:[...]}: fully factored AND the sorted prime leaves match.
    check(p, t) {
      const prime = (x: number) => {
        if (x < 2) return false;
        for (let d = 2; d * d <= x; d++) if (x % d === 0) return false;
        return true;
      };
      // fold splits over the flat leaf list (same left-to-right order as the tree)
      const leaves = [num(p.n)];
      for (const s of p.splits ?? []) {
        const i = leaves.findIndex((v) => !prime(v));
        if (i < 0) break;
        leaves.splice(i, 1, num(s?.[0]), num(s?.[1]));
      }
      const allPrime = leaves.every(prime);
      if (t?.factored) return allPrime;
      if (Array.isArray(t?.primes)) {
        const want = t.primes.map(num).sort((a: number, b: number) => a - b);
        const got = [...leaves].sort((a, b) => a - b);
        return (
          allPrime &&
          want.length === got.length &&
          want.every((v: number, i: number) => v === got[i])
        );
      }
      return false;
    },
  },
  unitcircle: {
    hint: 'Kéo quanh vòng tròn để đổi góc — xem sin, cos, tan đổi theo.',
    actions: [
      { verb: 'setAngle', label: '30°', args: { deg: 30 } },
      { verb: 'setAngle', label: '45°', args: { deg: 45 } },
      { verb: 'setAngle', label: '90°', args: { deg: 90 } },
      { verb: 'showTan', label: 'tan' },
      { verb: 'toRadians', label: 'Rad (π)' },
    ],
    onDrag(p, pt, ctx) {
      // keep in sync with unitcircle.ts geom(): circle centre + radius
      const portrait = ctx.box.h > ctx.box.w;
      const cx = portrait ? ctx.box.w * 0.5 : ctx.box.w * 0.34;
      const cy = portrait ? ctx.box.h * 0.3 : ctx.box.h * 0.5;
      // SVG y is down → invert dy so the angle runs counterclockwise
      const a = Math.atan2(cy - pt.y, pt.x - cx);
      const deg = ((((a * 180) / Math.PI) % 360) + 360) % 360;
      return { ...p, angle: deg };
    },
    check(p, t) {
      if (t?.angle != null) {
        const norm = (a: number) => ((Math.round(a) % 360) + 360) % 360;
        return norm(num(p.angle)) === norm(num(t.angle));
      }
      if (t?.sinSign != null || t?.cosSign != null) {
        const rad = (num(p.angle) * Math.PI) / 180;
        const sgn = (v: number) => (v >= 0 ? '+' : '-');
        if (t.sinSign != null && sgn(Math.sin(rad)) !== t.sinSign) return false;
        if (t.cosSign != null && sgn(Math.cos(rad)) !== t.cosSign) return false;
        return true;
      }
      return false;
    },
  },
  trianglelab: {
    hint: 'Chọn chế độ rồi bấm “Chứng minh” để thấy vì sao.',
    actions: [
      { verb: 'setMode', label: 'Tổng góc', args: { mode: 'angles' } },
      { verb: 'setMode', label: 'Pytago', args: { mode: 'pythagoras' } },
      { verb: 'setMode', label: 'Tỉ số LG', args: { mode: 'ratio' } },
      { verb: 'showWork', label: 'Chứng minh' },
      { verb: 'setRatio', label: 'sin→cos→tan', args: {} },
    ],
    check(p, t) {
      const tol = (x: number, y: number, e: number) => Math.abs(x - y) <= e;
      if (p.answer == null) return false;
      const ans = num(p.answer);
      if (t?.thirdAngle != null) {
        const truth = 180 - num(p.angles[0]) - num(p.angles[1]);
        return tol(ans, num(t.thirdAngle), 0.5) && tol(truth, num(t.thirdAngle), 0.5);
      }
      if (t?.hyp != null) {
        const truth = Math.hypot(num(p.legs[0]), num(p.legs[1]));
        return tol(ans, num(t.hyp), 0.01) && tol(truth, num(t.hyp), 0.01);
      }
      if (t?.ratio != null) {
        const adj = num(p.legs[0]),
          opp = num(p.legs[1]);
        const hyp = Math.hypot(adj, opp);
        const truth = p.ratioFn === 'cos' ? adj / hyp : p.ratioFn === 'tan' ? opp / adj : opp / hyp;
        return tol(ans, num(t.ratio), 0.01) && tol(truth, num(t.ratio), 0.01);
      }
      return false;
    },
  },
  transformgrid: {
    hint: 'Bấm nút để biến hình; chạm lưới để đánh dấu một điểm.',
    actions: [
      { verb: 'translate', label: 'Tịnh tiến (2;1)', args: { dx: 2, dy: 1 } },
      { verb: 'reflect', label: 'Đối xứng Oy', args: { axis: 'y' } },
      { verb: 'rotate', label: 'Quay 90°', args: { deg: 90 } },
      { verb: 'dilate', label: 'Vị tự ×2', args: { k: 2 } },
      { verb: 'resetShape', label: 'Về hình gốc', args: {} },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with transformgrid.ts render grid geometry (pad/unit/centre)
      const R = num(p.gridRange) || 6;
      const S = Math.min(ctx.box.w, ctx.box.h);
      const pad = S * 0.08;
      const unit = (S - 2 * pad) / (2 * R);
      const gx = Math.round((pt.x - ctx.box.w / 2) / unit);
      const gy = Math.round((ctx.box.h / 2 - pt.y) / unit);
      if (Math.abs(gx) > R || Math.abs(gy) > R) return null;
      return { verb: 'markPoint', args: { x: gx, y: gy } };
    },
    check(p, t) {
      // keep in sync with transformgrid.ts applyXf/chainVertices
      const rot = (v: number[], d: number) => {
        const r = (d * Math.PI) / 180,
          c = Math.cos(r),
          s = Math.sin(r);
        return [v[0]! * c - v[1]! * s, v[0]! * s + v[1]! * c];
      };
      let vs: number[][] = (Array.isArray(p.shape) ? p.shape : []).map((v: number[]) => [
        num(v[0]),
        num(v[1]),
      ]);
      for (const xf of Array.isArray(p.transforms) ? p.transforms : []) {
        if (xf.op === 'translate') vs = vs.map((v) => [v[0]! + num(xf.dx), v[1]! + num(xf.dy)]);
        else if (xf.op === 'reflect')
          vs = vs.map((v) => (xf.axis === 'x' ? [v[0]!, -v[1]!] : [-v[0]!, v[1]!]));
        else if (xf.op === 'rotate') vs = vs.map((v) => rot(v, num(xf.deg)));
        else if (xf.op === 'dilate') vs = vs.map((v) => [v[0]! * num(xf.k), v[1]! * num(xf.k)]);
      }
      const has = (q: number[]) =>
        vs.some(
          (v) =>
            Math.round(v[0]!) === Math.round(num(q[0])) &&
            Math.round(v[1]!) === Math.round(num(q[1])),
        );
      if (Array.isArray(t?.vertexAt)) return has(t.vertexAt);
      if (Array.isArray(t?.finalHas)) return t.finalHas.every((q: number[]) => has(q));
      return false;
    },
  },
  probtree: {
    hint: 'Mở dần từng tầng của cây; chạm vào một lá để tô đường đi.',
    actions: [
      { verb: 'reveal', label: 'Tầng 1', args: { stage: 1 } },
      { verb: 'reveal', label: 'Tầng 2', args: { stage: 2 } },
      { verb: 'showProducts', label: 'Nhân xác suất' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with probtree.ts render (leaf slot mapping)
      const portrait = ctx.box.h > ctx.box.w;
      const n1 = p.stage1.length,
        n2 = p.stage2.length,
        N = Math.max(1, n1 * n2);
      // only taps near the leaf tier count (landscape: right side; portrait: bottom)
      if (portrait ? pt.y < ctx.box.h * 0.55 : pt.x < ctx.box.w * 0.55) return null;
      const pad = (portrait ? ctx.box.w : ctx.box.h) * 0.06;
      const span = (portrait ? ctx.box.w : ctx.box.h) - 2 * pad;
      const slot = span / N; // divide tap position by the leaf slot → leaf index
      const along = portrait ? pt.x : pt.y;
      const k = Math.max(0, Math.min(N - 1, Math.floor((along - pad) / slot)));
      return { verb: 'highlight', args: { path: [Math.floor(k / n2), k % n2] } };
    },
    check(p, t) {
      if (p.answer == null) return false;
      const tol = Math.abs(num(t?.tol ?? 0.001)) || 0.001;
      if (t?.prob != null) return Math.abs(p.answer - num(t.prob)) <= tol;
      if (Array.isArray(t?.path) && t.path.length >= 2) {
        const p1 = p.stage1[Math.floor(num(t.path[0]))]?.p;
        const p2 = p.stage2[Math.floor(num(t.path[1]))]?.p;
        if (p1 == null || p2 == null) return false;
        return Math.abs(p.answer - p1 * p2) <= tol; // truth = the computed product
      }
      return false;
    },
  },
  statplot: {
    hint: 'Chạm vào trục để thêm một điểm dữ liệu — xem các mốc thống kê trượt theo.',
    actions: [
      { verb: 'showMean', label: 'Trung bình' },
      { verb: 'showMedian', label: 'Trung vị' },
      { verb: 'showMode', label: 'Mốt' },
      { verb: 'showRange', label: 'Khoảng biến thiên' },
      { verb: 'addData', label: '+ Ngoại lệ', args: { v: 15 } }, // = axis max of defaults
    ],
    onTap(p, pt, ctx) {
      // keep in sync with statplot.ts render (padX + axisOf axis derivation)
      const padX = ctx.box.w * 0.08;
      const d = Array.isArray(p.data) ? p.data : [];
      const dmin = d.length ? Math.min(...d) : 0,
        dmax = d.length ? Math.max(...d) : 10;
      let lo = p.min ?? Math.floor(dmin) - 1,
        hi = p.max ?? Math.ceil(dmax) + 1;
      lo = Math.min(lo, Math.floor(dmin));
      hi = Math.max(hi, Math.ceil(dmax));
      if (hi <= lo) hi = lo + 1;
      const v = Math.round(lo + clamp01((pt.x - padX) / (ctx.box.w - 2 * padX)) * (hi - lo));
      return { verb: 'addData', args: { v } };
    },
    check(p, t) {
      if (p.answer == null) return false;
      const tol = Math.abs(num(t?.tol ?? 0.01)) || 0.01;
      const d = (Array.isArray(p.data) ? p.data : []).map(num);
      if (!d.length) return false;
      // recompute the TRUE statistic — keep in sync with statplot.ts statsOf
      const s = [...d].sort((a: number, b: number) => a - b);
      const n = s.length;
      let truth: number;
      if (t?.stat === 'mean') truth = s.reduce((a: number, v: number) => a + v, 0) / n;
      else if (t?.stat === 'median')
        truth = n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
      else if (t?.stat === 'mode') {
        const counts: Record<string, number> = {};
        for (const v of d) counts[String(v)] = (counts[String(v)] ?? 0) + 1;
        let best = 0;
        truth = d[0];
        for (const v of d) {
          const c = counts[String(v)] ?? 0;
          if (c > best) {
            best = c;
            truth = v;
          }
        }
      } else if (t?.stat === 'range') truth = s[n - 1] - s[0];
      else if (t?.value != null) truth = num(t.value);
      else return false;
      return Math.abs(p.answer - truth) <= tol;
    },
  },
  calculusgraph: {
    hint: 'Kéo ngang: dời tiếp điểm (chế độ tiếp tuyến) hoặc đầu mút b (chế độ diện tích).',
    actions: [
      { verb: 'setMode', label: 'Tiếp tuyến', args: { mode: 'tangent' } },
      { verb: 'setMode', label: 'Diện tích', args: { mode: 'area' } },
      { verb: 'refine', label: 'Chia mịn ×2' },
      { verb: 'showValue', label: 'Giá trị đúng' },
    ],
    onDrag(p, pt, ctx) {
      // keep in sync with calculusgraph.ts render (pad + x∈[-6,6] mapping)
      const pad = Math.min(ctx.box.w, ctx.box.h) * 0.09;
      const x = -6 + clamp01((pt.x - pad) / (ctx.box.w - 2 * pad)) * 12;
      if (p.mode === 'area') return { ...p, b: Math.max(p.a, x) };
      return { ...p, x0: x };
    },
    check(p, t) {
      if (p.answer == null) return false;
      const tol = Math.abs(num(t?.tol ?? 0.05)) || 0.05;
      // exact formulas — keep in sync with calculusgraph.ts:
      // quadratic f=x²/8 f'=x/4 F=x³/24 · cubic f=x³/32 f'=3x²/32 F=x⁴/128 ·
      // sin f=3sin(x/1.5) f'=2cos(x/1.5) F=−4.5cos(x/1.5)
      const deriv = (fn: string, x: number) =>
        fn === 'cubic' ? (3 * x * x) / 32 : fn === 'sin' ? 2 * Math.cos(x / 1.5) : x / 4;
      const anti = (fn: string, x: number) =>
        fn === 'cubic'
          ? (x * x * x * x) / 128
          : fn === 'sin'
            ? -4.5 * Math.cos(x / 1.5)
            : (x * x * x) / 24;
      let truth: number;
      if (t?.of === 'slope')
        truth = deriv(p.fn, p.x0); // truth at the CURRENT point
      else if (t?.of === 'area')
        truth = anti(p.fn, p.b) - anti(p.fn, p.a); // exact ∫ over [a,b]
      else if (t?.value != null) truth = num(t.value);
      else return false;
      return Number.isFinite(truth) && Math.abs(p.answer - truth) <= tol;
    },
  },

  /* ---- English: early → exam (IELTS/TOEFL/TOEIC) → professional ---- */
  vocabcard: {
    hint: 'Chạm thẻ để lật; ở chế độ nối, chạm tranh rồi chạm chữ tương ứng.',
    actions: [
      { verb: 'next', label: 'Thẻ sau', args: {} },
      { verb: 'flip', label: 'Lật thẻ', args: {} },
      { verb: 'reveal', label: 'Tranh + chữ', args: {} },
      { verb: 'setMode', label: 'Trò nối cặp', args: { mode: 'match' } },
      { verb: 'setMode', label: 'Thẻ rời', args: { mode: 'flash' } },
    ],
    onTap(p, pt, ctx) {
      if (p.mode !== 'match') return { verb: 'flip' };
      // keep in sync with vocabcard.ts render (match-mode grid)
      const n = Math.max(1, p.cards.length);
      const cell = Math.min((ctx.box.w * 0.92) / n, ctx.box.h * 0.3);
      const ox = (ctx.box.w - cell * n) / 2;
      const idx = Math.max(0, Math.min(n - 1, Math.floor((pt.x - ox) / cell)));
      if (pt.y < ctx.box.h / 2) return { params: { ...p, sel: idx } }; // pick a picture
      if (p.sel == null) return null;
      return { verb: 'match', args: { i: p.sel, j: idx } }; // then a word
    },
    check(p, t) {
      if (t && t.allMatched) return p.cards.length > 0 && p.matched.length === p.cards.length;
      if (t && t.matched != null) return p.matched.length === num(t.matched);
      return false;
    },
  },
  rhymetime: {
    hint: 'Chạm để ghép âm đầu với vần thành từ mới; tìm từ không cùng vần.',
    actions: [
      { verb: 'build', label: 'Ghép 1 từ', args: {} },
      { verb: 'buildAll', label: 'Ghép hết', args: {} },
      { verb: 'highlightRime', label: 'Gạch vần', args: {} },
      { verb: 'showOdd', label: 'Thêm từ lạ', args: { word: 'dog' } },
      { verb: 'spotOdd', label: 'Từ lạc vần?', args: {} },
    ],
    onTap: () => ({ verb: 'build', args: {} }),
    check(p, t) {
      if (!p.choice) return false;
      const rhymes = p.choice.endsWith(p.rime);
      if (t && t.rhymes) return rhymes;
      if (t && t.odd) return !rhymes;
      return false;
    },
  },
  minimalpair: {
    hint: 'Chạm thẻ trái / phải để chọn từ; xem khẩu hình và phiên âm.',
    actions: [
      { verb: 'focus', label: 'Nhìn từ A', args: { side: 'a' } },
      { verb: 'focus', label: 'Nhìn từ B', args: { side: 'b' } },
      { verb: 'contrast', label: 'So sánh âm', args: {} },
      { verb: 'showIpa', label: 'Phiên âm', args: {} },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with minimalpair.ts render (a = left/top card, b = right/bottom; portrait split at 0.45h)
      const portrait = ctx.box.h > ctx.box.w;
      const side = portrait
        ? pt.y < ctx.box.h * 0.45
          ? 'a'
          : 'b'
        : pt.x < ctx.box.w / 2
          ? 'a'
          : 'b';
      return { verb: 'choose', args: { side } };
    },
    check: (p, t) => p.chosen != null && p.chosen === (t && t.side),
  },
  wordmatch: {
    hint: 'Chạm từ bên trái rồi chạm từ khớp với nó bên phải.',
    actions: [
      { verb: 'connect', label: 'Nối 1 cặp', args: { i: 0 } },
      { verb: 'connectAll', label: 'Nối hết', args: {} },
      { verb: 'clear', label: 'Xóa', args: {} },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with layout() in wordmatch.ts (rows/columns)
      const n = Math.max(1, p.pairs.length);
      const top = ctx.box.h * 0.28;
      const step = Math.min(ctx.box.h * 0.2, (ctx.box.h * 0.62) / n);
      const row = Math.max(0, Math.min(n - 1, Math.floor((pt.y - top) / step)));
      if (pt.x < ctx.box.w / 2) return { params: { ...p, sel: row } }; // pick left chip
      if (p.sel == null) return null;
      const rot = p.shuffleRight && n > 1 ? 1 : 0;
      const truthSlot = (p.sel - rot + n) % n; // TRUE partner's slot through the rotation
      if (row === truthSlot) return { verb: 'connect', args: { i: p.sel } };
      return { verb: 'flashWrong', args: { i: p.sel, j: row } };
    },
    check(p, t) {
      if (t && t.all) return p.pairs.length > 0 && p.connected.length === p.pairs.length;
      if (t && t.count != null) return p.connected.length === num(t.count);
      return false;
    },
  },
  cloze: {
    hint: 'Chạm từ trong khay để điền vào ô trống; chạm ô đã điền để bỏ từ ra.',
    actions: [
      { verb: 'focus', label: 'Chọn ô 1', args: { gap: 0 } },
      { verb: 'unfill', label: 'Bỏ từ ra', args: {} },
      { verb: 'revealAnswers', label: 'Kiểm tra' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with layoutCloze in cloze.ts (render geometry)
      const box = ctx.box;
      const toks = [];
      for (const raw of String(p.text).split(/\s+/)) {
        if (!raw) continue;
        const m = raw.match(/^\{(\d+)\}(.*)$/);
        if (m) toks.push({ gap: Math.max(0, parseInt(m[1]!, 10) - 1), text: '', post: m[2] || '' });
        else toks.push({ gap: null, text: raw, post: '' });
      }
      const gaps = p.filled.length;
      const maxBank = p.bank.reduce((m2: number, w: string) => Math.max(m2, w.length), 3);
      let fs = Math.min(box.h * 0.08, box.w * 0.062);
      let slots: (HitBox | null)[] = [],
        chips: HitBox[] = [];
      for (let it = 0; ; it++) {
        const ch = fs * 0.55,
          lineH = fs * 1.9,
          x0 = box.w * 0.05,
          maxW = box.w * 0.9;
        const slotW = (maxBank + 2) * ch,
          slotH = fs * 1.5;
        slots = Array.from({ length: gaps }, () => null);
        let x = x0,
          y = box.h * 0.06 + lineH / 2;
        for (const tk of toks) {
          const w = tk.gap != null ? slotW + tk.post.length * ch : tk.text.length * ch;
          if (x + w > x0 + maxW && x > x0) {
            x = x0;
            y += lineH;
          }
          if (tk.gap != null && tk.gap < gaps)
            slots[tk.gap] = { x, y: y - slotH / 2, w: slotW, h: slotH };
          x += w + ch;
        }
        const chipH = fs * 1.5,
          rowH = chipH * 1.3;
        const trayTop = Math.max(y + lineH / 2 + box.h * 0.05, box.h * 0.58);
        chips = [];
        let cx = x0,
          cy = trayTop + chipH / 2;
        for (const w of p.bank) {
          const cw = w.length * ch + fs * 0.9;
          if (cx + cw > x0 + maxW && cx > x0) {
            cx = x0;
            cy += rowH;
          }
          chips.push({ x: cx, y: cy - chipH / 2, w: cw, h: chipH });
          cx += cw + fs * 0.35;
        }
        if (cy + chipH / 2 <= box.h * 0.92 || fs < 7 || it >= 9) break;
        fs *= 0.88;
      }
      const pad = fs * 0.2;
      for (let g = 0; g < slots.length; g++) {
        const s = slots[g];
        if (!s) continue;
        if (
          pt.x >= s.x - pad &&
          pt.x <= s.x + s.w + pad &&
          pt.y >= s.y - pad &&
          pt.y <= s.y + s.h + pad
        )
          return p.filled[g] != null
            ? { verb: 'unfill', args: { gap: g } }
            : { verb: 'focus', args: { gap: g } };
      }
      for (let i = 0; i < chips.length; i++) {
        const c = chips[i]!;
        if (pt.x >= c.x && pt.x <= c.x + c.w && pt.y >= c.y && pt.y <= c.y + c.h) {
          if (p.filled.includes(i)) return null;
          const empty = p.filled.indexOf(null);
          const gap = p.focusGap != null ? p.focusGap : empty < 0 ? 0 : empty;
          return { verb: 'fill', args: { gap, word: i } };
        }
      }
      return null;
    },
    check(p, t) {
      const good = p.filled.filter(
        (v: number | null, g: number) => v != null && v === p.answers[g],
      ).length;
      if (t && t.all) return p.filled.length > 0 && good === p.filled.length;
      return good >= Math.max(1, Math.floor(num(t && t.correct)));
    },
  },
  wordform: {
    hint: 'Chạm một ô từ loại để mở dạng từ; chạm lần nữa để điền vào câu.',
    actions: [
      { verb: 'revealAll', label: 'Hiện cả họ từ' },
      { verb: 'highlightSuffix', label: 'Nổi bật đuôi từ' },
      { verb: 'place', label: 'Điền danh từ', args: { pos: 'noun' } },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with layoutWF in wordform.ts (render geometry)
      const box = ctx.box;
      const portrait = box.h > box.w;
      const n = Math.max(1, p.family.length);
      const maxLen = p.family.reduce(
        (m: number, f: { word: string }) => Math.max(m, f.word.length),
        4,
      );
      const fs = portrait
        ? Math.min(box.h * 0.045, (box.w * 0.7) / (maxLen * 0.58 + 0.9))
        : Math.min(box.h * 0.058, (box.w * 0.3) / (maxLen * 0.58 + 0.9));
      const cardH = fs * 1.6;
      const rcx = box.w * 0.5;
      const rcy = portrait ? box.h * 0.11 : box.h * 0.4;
      for (let i = 0; i < p.family.length; i++) {
        const f = p.family[i];
        const w = Math.max(fs * 2.2, f.word.length * fs * 0.58 + fs * 0.9);
        let cx, cy;
        if (portrait) {
          const step = Math.min(box.h * 0.135, (box.h * 0.56) / Math.max(1, n));
          cx = rcx;
          cy = box.h * 0.26 + i * step;
        } else {
          const dirs = [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ];
          const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
          const d = n <= 4 ? dirs[i]! : [Math.cos(a), Math.sin(a)];
          cx = rcx + d[0]! * box.w * 0.33;
          cy = rcy + d[1]! * box.h * 0.27;
        }
        if (Math.abs(pt.x - cx) <= w / 2 + fs * 0.3 && Math.abs(pt.y - cy) <= cardH * 0.85) {
          return p.revealed.includes(f.pos)
            ? { verb: 'place', args: { pos: f.pos } }
            : { verb: 'reveal', args: { pos: f.pos } };
        }
      }
      return null;
    },
    check(p, t) {
      if (t && t.placedCorrect)
        return p.placed != null && !!p.sentence && p.placed === p.sentence.correctPos;
      return p.revealed.length >= Math.max(1, Math.floor(num(t && t.revealed)));
    },
  },
  collocation: {
    hint: 'Chạm danh từ ở khay rồi chạm cột động từ đi cùng với nó.',
    actions: [
      { verb: 'placeAll', label: 'Xếp hết', args: {} },
      { verb: 'reveal', label: 'Kiểm tra' },
      { verb: 'clear', label: 'Xóa' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with layoutColl in collocation.ts (render geometry)
      const box = ctx.box;
      const nv = Math.max(1, p.verbs.length);
      const colW = box.w / nv;
      const maxN = p.nouns.reduce(
        (m: number, n: { word: string }) => Math.max(m, n.word.length),
        4,
      );
      const nf = Math.min(box.h * 0.05, (colW * 0.85) / (maxN * 0.58 + 0.9));
      const chipH = nf * 1.6,
        trayTop = box.h * 0.78;
      if (pt.y < box.h * 0.18) {
        const c = Math.max(0, Math.min(nv - 1, Math.floor(pt.x / colW)));
        if (p.sel != null) return { verb: 'place', args: { noun: p.sel, under: c } };
        return null;
      }
      if (pt.y >= trayTop - chipH * 0.5) {
        const ch = nf * 0.58,
          x0 = box.w * 0.05,
          maxW = box.w * 0.9,
          rowH = chipH * 1.25;
        let x = x0,
          y = trayTop + chipH / 2;
        for (let i = 0; i < p.nouns.length; i++) {
          const w = p.nouns[i].word.length * ch + nf * 0.9;
          if (x + w > x0 + maxW && x > x0) {
            x = x0;
            y += rowH;
          }
          if (
            p.placed[i] == null &&
            pt.x >= x &&
            pt.x <= x + w &&
            Math.abs(pt.y - y) <= chipH * 0.7
          )
            return { params: { ...p, sel: p.sel === i ? null : i } };
          x += w + nf * 0.4;
        }
      }
      return null;
    },
    check(p, t) {
      const good = p.nouns.filter(
        (n: { goes: number }, i: number) => p.placed[i] === n.goes,
      ).length;
      if (t && t.all) return p.nouns.length > 0 && good === p.nouns.length;
      return good >= Math.max(1, Math.floor(num(t && t.correct)));
    },
  },
  paraphrase: {
    hint: 'Chạm một từ ở câu trên rồi một từ ở câu dưới để ghép cặp đồng nghĩa.',
    actions: [
      { verb: 'showNext', label: 'Cặp tiếp theo' },
      { verb: 'showAll', label: 'Hiện tất cả' },
      { verb: 'clear', label: 'Xóa' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with layoutPara/wrapRow in paraphrase.ts (render geometry)
      const box = ctx.box;
      const tok = (s: unknown) =>
        String(s)
          .split(/\s+/)
          .filter((w) => w.length > 0);
      const ta = tok(p.a),
        tb = tok(p.b);
      const wrap = (words: string[], fs: number, y0: number) => {
        const ch = fs * 0.6,
          x0 = box.w * 0.05,
          maxW = box.w * 0.9,
          rowH = fs * 2.1,
          chipH = fs * 1.5;
        const chips: HitBox[] = [];
        let x = x0,
          y = y0 + chipH / 2;
        for (const w of words) {
          const cw = w.length * ch + fs * 0.7;
          if (x + cw > x0 + maxW && x > x0) {
            x = x0;
            y += rowH;
          }
          chips.push({ x, y, w: cw, h: chipH });
          x += cw + fs * 0.3;
        }
        return { chips, bottom: y + chipH / 2 };
      };
      let fs = Math.min(box.h * 0.055, box.w * 0.05);
      let A = null,
        B = null;
      for (let it = 0; ; it++) {
        A = wrap(ta, fs, box.h * 0.1);
        B = wrap(tb, fs, box.h * 0.56);
        if ((A.bottom <= box.h * 0.44 && B.bottom <= box.h * 0.9) || fs < 7 || it >= 9) break;
        fs *= 0.88;
      }
      const hit = (chips: HitBox[]) => {
        for (let i = 0; i < chips.length; i++) {
          const c = chips[i]!;
          if (pt.x >= c.x && pt.x <= c.x + c.w && Math.abs(pt.y - c.y) <= c.h * 0.7) return i;
        }
        return -1;
      };
      const ia = hit(A.chips);
      if (ia >= 0) return { params: { ...p, selA: p.selA === ia ? null : ia } };
      const ib = hit(B.chips);
      if (ib >= 0 && p.selA != null) return { verb: 'pick', args: { ai: p.selA, bi: ib } };
      return null;
    },
    check(p, t) {
      if (t && t.ai != null && t.bi != null) {
        if (!p.pick) return false;
        const ai = Math.floor(num(t.ai)),
          bi = Math.floor(num(t.bi));
        if (p.pick.ai !== ai || p.pick.bi !== bi) return false;
        return p.links.some((l: ParaLink) => l[0].includes(ai) && l[1].includes(bi));
      }
      return p.shown >= Math.max(1, Math.floor(num(t && t.shown)));
    },
  },
  essaymap: {
    hint: 'Chạm hai thẻ để đổi chỗ khối; bấm nút để mở dàn ý.',
    actions: [
      { verb: 'reveal', label: 'Mở khối kế' },
      { verb: 'revealAll', label: 'Mở cả dàn ý' },
      { verb: 'setMode', label: 'Luyện sắp xếp', args: { mode: 'reorder' } },
      { verb: 'showRoles', label: 'Hiện vai trò' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with essaymap.ts geom()
      const n = p.blocks.length;
      const portrait = ctx.box.h > ctx.box.w;
      const colW = ctx.box.w * (portrait ? 0.86 : 0.52);
      const colX = (ctx.box.w - colW) / 2;
      const slotH = (ctx.box.h * 0.88) / Math.max(1, n);
      if (pt.x < colX || pt.x > colX + colW) return null;
      const s = Math.floor((pt.y - ctx.box.h * 0.06) / slotH);
      if (s < 0 || s >= n) return null;
      if (p.mode !== 'reorder') return { verb: 'reveal', args: {} };
      if (p.sel == null || p.sel === s) return { params: { ...p, sel: s } };
      return { verb: 'swap', args: { i: p.sel, j: s } };
    },
    check(p, t) {
      if (t?.ordered) {
        // canonical essay sequence — the kit's own RANK (single source of truth)
        let last = -1;
        for (const idx of p.order) {
          const role = p.blocks[idx]?.role;
          const r = (role !== undefined ? RANK[role as keyof typeof RANK] : undefined) ?? 2;
          if (r < last) return false;
          last = r;
        }
        return true;
      }
      if (t?.revealed != null) return p.revealed >= num(t.revealed);
      return false;
    },
  },
  dialogue: {
    hint: 'Chạm để hiện lượt thoại kế; ở chế độ sắp xếp, chạm hai bong bóng để đổi chỗ.',
    actions: [
      { verb: 'next', label: 'Lượt kế' },
      { verb: 'playAll', label: 'Phát cả đoạn' },
      { verb: 'highlightFn', label: 'Chức năng câu', args: { fn: 'all' } },
      { verb: 'setMode', label: 'Luyện sắp xếp', args: { mode: 'reorder' } },
    ],
    onTap(p, pt, ctx) {
      if (p.mode !== 'reorder') return { verb: 'next', args: {} };
      // keep in sync with dialogue.ts geom()
      const n = p.turns.length;
      const slotH = (ctx.box.h * 0.9) / Math.max(1, n);
      const s = Math.floor((pt.y - ctx.box.h * 0.05) / slotH);
      if (s < 0 || s >= n) return null;
      if (p.sel == null || p.sel === s) return { params: { ...p, sel: s } };
      return { verb: 'swap', args: { i: p.sel, j: s } };
    },
    check(p, t) {
      if (t?.ordered) return p.order.every((v: number, i: number) => v === i);
      if (t?.shown != null) return p.shown >= num(t.shown);
      return false;
    },
  },
  stresspattern: {
    hint: 'Chạm một âm tiết để đánh dấu trọng âm.',
    actions: [
      { verb: 'showBeats', label: 'Gõ nhịp' },
      { verb: 'showCompare', label: 'So sánh cặp từ' },
      { verb: 'reveal', label: 'Đáp án' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with stresspattern.ts rowGeom() / main-row cy
      const n = p.syllables.length;
      const cv = p.showCompare ? 1 : 0;
      const cy = ctx.box.h * (0.48 - 0.14 * cv);
      const totalW = ctx.box.w * 0.84;
      const ox = (ctx.box.w - totalW) / 2;
      const slotW = totalW / Math.max(1, n);
      const bh = Math.min(ctx.box.h * 0.15, slotW * 0.62);
      if (Math.abs(pt.y - cy) > bh) return null;
      const i = Math.floor((pt.x - ox) / slotW);
      if (i < 0 || i >= n) return null;
      return { verb: 'mark', args: { i } };
    },
    check(p, t) {
      if (t?.correct) return p.marked != null && p.marked === p.stressed;
      if (t?.marked != null) return p.marked === Math.floor(num(t.marked));
      return false;
    },
  },
  registerscale: {
    hint: 'Chạm một câu rồi chạm vùng để xếp mức trang trọng.',
    actions: [
      { verb: 'focus', label: 'Chọn câu 1', args: { i: 0 } },
      { verb: 'placeAll', label: 'Xếp đúng hết' },
      { verb: 'showScale', label: 'Hiện thang' },
      { verb: 'clear', label: 'Xóa hết' },
    ],
    onTap(p, pt, ctx) {
      // keep in sync with registerscale.ts cardPos() / zone layout
      const w = ctx.box.w,
        h = ctx.box.h;
      const portrait = h > w;
      const n = p.variants.length;
      const trayBottom = portrait ? h * 0.21 : h * 0.28;
      if (pt.y < trayBottom) {
        const i = portrait
          ? Math.floor((pt.y - h * 0.03) / (h * 0.048 * 1.2))
          : Math.floor((pt.x - w * 0.05) / ((w * 0.9) / Math.max(1, n)));
        if (i < 0 || i >= n || p.placed[i] != null) return null;
        return { verb: 'focus', args: { i } };
      }
      if (p.focus == null) return null;
      const z = portrait
        ? Math.floor((pt.y - h * 0.24) / (h * 0.25))
        : Math.floor((pt.x - w * 0.05) / (w * 0.3));
      if (z < 0 || z > 2) return null;
      return { verb: 'place', args: { i: p.focus, level: z } };
    },
    check(p, t) {
      const ok = p.variants.map((v: { level: number }, i: number) => p.placed[i] === v.level);
      if (t?.all) return ok.every(Boolean);
      if (t?.correct != null) return ok.filter(Boolean).length >= num(t.correct);
      return false;
    },
  },
};

export function getInteractions(kind: string): Interactions<KitAny> | null {
  return REG[kind] ?? null;
}

/**
 * Mọi kit CÓ TƯƠNG TÁC (có mục trong REG) → nguồn ĐỘNG để lớp trên đăng ký kit là primitive chấm được.
 * Thêm kit mới vào REG là tự có mặt ở đây; KHÔNG nơi nào phải liệt kê tay danh sách kit. Đông lạnh để
 * không ai sửa nhầm.
 */
export const INTERACTIVE_KITS: readonly string[] = Object.freeze(Object.keys(REG));

/** Nhãn/mô tả song ngữ hiện cho NGƯỜI SOẠN (author-facing). VI là ngôn ngữ UI; en là gốc. */
export interface KitLoc {
  readonly vi: string;
  readonly en: string;
}

/**
 * NGUỒN META DUY NHẤT cho mỗi kit — đặt CẠNH REG/check (cùng module), không rải rác:
 *   · `answer` — hợp đồng đáp án (target mà `check` mong đợi); thiếu = kit chưa sinh item được.
 *   · `objectImage` — kit render được ẢNH-VẬT tuỳ biến (params.assets[shape]); gắn ảnh thay icon.
 *   · `label`/`desc` — TÊN + "học sinh làm gì" SONG NGỮ cho palette soạn (trước titleize English thô).
 * Mọi thứ khác (GRADABLE_KITS, OBJECT_IMAGE_KITS, primitive-info nhãn kit, itemMediaSlots) DẪN XUẤT từ
 * đây — KHÔNG hardcode set/map rời ở nơi khác. Kit không khai label → lớp trên titleize + KIT_DOCS.en.
 */
interface KitMeta {
  readonly answer?: AnswerDoc;
  readonly objectImage?: boolean;
  readonly label?: KitLoc;
  readonly desc?: KitLoc;
}
const KIT_META: Record<string, KitMeta> = {
  // target = đáp án trực tiếp
  numberline: {
    answer: {
      shape: 'target.point = vị trí đặt trên trục (min..max, theo bước step).',
      example: { point: 3 },
    },
    label: { vi: 'Trục số', en: 'Number line' },
    desc: {
      vi: 'Kéo điểm hoặc nhảy tới giá trị trên trục.',
      en: 'Place/jump to a value on the line.',
    },
  },
  base10: {
    answer: {
      shape: 'target.value = số cần dựng bằng khối trăm/chục/đơn vị (nguyên ≥ 0).',
      example: { value: 34 },
    },
    label: { vi: 'Khối cơ số 10', en: 'Base-10 blocks' },
    desc: {
      vi: 'Dựng số bằng khối trăm/chục/đơn vị, đổi 10.',
      en: 'Build a number from hundreds/tens/ones.',
    },
  },
  fraction: {
    answer: {
      shape: 'target.denominator = số phần bằng nhau; target.shaded = số phần tô (0..denominator).',
      example: { denominator: 4, shaded: 3 },
    },
    label: { vi: 'Phân số', en: 'Fraction' },
    desc: {
      vi: 'Chia hình và tô các phần để biểu diễn phân số.',
      en: 'Split a shape and shade parts.',
    },
  },
  clock: {
    answer: {
      shape:
        'target.minute = phút (0–59); target.hour tuỳ chọn (0–11) — bỏ hour nếu chỉ chấm phút.',
      example: { hour: 3, minute: 30 },
    },
    label: { vi: 'Đồng hồ', en: 'Clock' },
    desc: { vi: 'Kéo kim để chỉnh giờ/phút.', en: 'Set the clock hands.' },
  },
  tenframe: {
    answer: {
      shape: 'target.count = số chấm đặt vào khung mười (0..capacity, thường 0–10).',
      example: { count: 7 },
    },
    objectImage: true,
    label: { vi: 'Khung mười ô', en: 'Ten-frame' },
    desc: { vi: 'Chạm để thêm chấm, thể hiện số lượng 0–10.', en: 'Place counters to show 0–10.' },
  },
  placevalue: {
    answer: {
      shape: 'target.value = số cần biểu diễn trên bảng giá trị vị trí (nguyên ≥ 0).',
      example: { value: 42 },
    },
    label: { vi: 'Bảng giá trị vị trí', en: 'Place value' },
    desc: {
      vi: 'Thêm/đổi cột trăm–chục–đơn vị để dựng số.',
      en: 'Build a number by place columns.',
    },
  },
  money: {
    answer: {
      shape: 'target.total = tổng tiền cần tạo bằng xu (đơn vị nhỏ nhất).',
      example: { total: 85 },
    },
    label: { vi: 'Tiền', en: 'Money' },
    desc: { vi: 'Chọn các đồng xu để tạo đủ tổng tiền.', en: 'Pick coins to make a total.' },
  },
  count: {
    answer: { shape: 'target.count = số vật cần đếm/đặt.', example: { count: 5 } },
    objectImage: true,
    label: { vi: 'Đếm vật', en: 'Count objects' },
    desc: { vi: 'Chạm để thêm vật, đếm đủ số lượng.', en: 'Tap to add objects and count.' },
  },
  comparegroups: {
    answer: {
      shape: "target.symbol = dấu so sánh đúng giữa hai nhóm: '>' | '<' | '='.",
      example: { symbol: '>' },
    },
    objectImage: true,
    label: { vi: 'So sánh nhóm', en: 'Compare groups' },
    desc: { vi: 'So hai nhóm rồi chọn dấu >, <, =.', en: 'Compare two groups with >, <, =.' },
  },
  subitize: {
    answer: {
      shape: 'target.count = số chấm hiện ra để nhận nhanh (không cần đếm).',
      example: { count: 6 },
    },
    objectImage: true,
    label: { vi: 'Nhận nhanh số lượng', en: 'Subitize' },
    desc: {
      vi: 'Nhìn nhanh cụm vật, nói số lượng không cần đếm.',
      en: 'Recognise a quantity at a glance.',
    },
  },
  evenodd: {
    answer: {
      shape: "target.number = số cần tạo (HOẶC target.parity = 'even'|'odd').",
      example: { number: 6 },
    },
    objectImage: true,
    label: { vi: 'Chẵn / lẻ', en: 'Even / odd' },
    desc: { vi: 'Tạo số rồi xét chẵn hay lẻ (ghép đôi).', en: 'Build a number and test parity.' },
  },
  addstory: {
    answer: { shape: 'Không cần target — đáp án tính từ a,b,op trong params (đề).', example: {} },
    objectImage: true,
    label: { vi: 'Toán có lời (cộng/trừ)', en: 'Add/subtract story' },
    desc: {
      vi: 'Dựng phép cộng/trừ từ một tình huống.',
      en: 'Model an add/subtract word problem.',
    },
  },
  share: {
    answer: {
      shape: 'target.groups = số nhóm chia đều (HOẶC target.perGroup = số mỗi nhóm).',
      example: { groups: 3 },
    },
    label: { vi: 'Chia đều', en: 'Share equally' },
    desc: { vi: 'Rải đều số vật vào các nhóm.', en: 'Deal objects evenly into groups.' },
  },
  estimate: {
    answer: {
      shape: 'target.within = sai số cho phép quanh giá trị thật (mặc định 3).',
      example: { within: 3 },
    },
    label: { vi: 'Ước lượng', en: 'Estimate' },
    desc: { vi: 'Đoán gần đúng rồi kiểm bằng đếm/đo.', en: 'Estimate, then check by counting.' },
  },
  pattern: {
    answer: {
      shape: 'target.choice = phần tử tiếp theo đúng của dãy (khớp p.choice).',
      example: { choice: 0 },
    },
    label: { vi: 'Quy luật', en: 'Pattern' },
    desc: { vi: 'Tiếp tục dãy lặp cho đúng.', en: 'Continue a repeating pattern.' },
  },
  ordinal: {
    answer: { shape: 'target.pos = vị trí thứ tự cần chọn (1-based).', example: { pos: 3 } },
    label: { vi: 'Thứ tự (thứ nhất, nhì…)', en: 'Ordinal position' },
    desc: { vi: 'Chọn vật theo vị trí thứ tự.', en: 'Pick the item at an ordinal position.' },
  },
  sizeorder: {
    answer: {
      shape: 'target.sorted = true (đúng khi đã xếp theo kích thước tăng dần).',
      example: { sorted: true },
    },
    label: { vi: 'Xếp theo kích thước', en: 'Size order' },
    desc: { vi: 'Sắp các vật từ nhỏ đến lớn.', en: 'Order objects small → large.' },
  },
  integerchips: {
    answer: {
      shape: 'target.value = số nguyên cần dựng bằng chip dương/âm.',
      example: { value: 3 },
    },
    label: { vi: 'Chip số nguyên', en: 'Integer chips' },
    desc: { vi: 'Dựng số nguyên bằng chip dương/âm.', en: 'Build an integer with +/− chips.' },
  },
  minimalpair: {
    answer: {
      shape: "target.side = bên chứa đáp án đúng ('left'|'right' hoặc nhãn bên).",
      example: { side: 'left' },
    },
    label: { vi: 'Cặp âm tối thiểu', en: 'Minimal pair' },
    desc: { vi: 'Nghe/nhìn rồi chọn bên có âm đúng.', en: 'Pick the side with the right sound.' },
  },
  algebratile: {
    answer: { shape: 'Không cần target — nghiệm tính từ phương trình trong params.', example: {} },
    label: { vi: 'Ô đại số', en: 'Algebra tiles' },
    desc: { vi: 'Dùng ô để dựng và giải phương trình.', en: 'Model and solve with tiles.' },
  },
  equationbalance: {
    answer: { shape: 'Không cần target — nghiệm tính từ a,b,c trong params.', example: {} },
    label: { vi: 'Cân phương trình', en: 'Equation balance' },
    desc: { vi: 'Cân hai vế để tìm ẩn.', en: 'Balance both sides to solve.' },
  },
  // Kit CÓ nhãn nhưng chưa khai đáp án (dùng trong explainer / chấm generic) — display-only, không vào GRADABLE.
  hundredsquare: {
    label: { vi: 'Bảng trăm ô', en: 'Hundred square' },
    desc: { vi: 'Tô/đếm trên lưới 100 ô.', en: 'Shade/count on a 100-grid.' },
  },
  arrayarea: {
    label: { vi: 'Mảng / diện tích', en: 'Array / area' },
    desc: { vi: 'Mô hình nhân bằng hàng × cột.', en: 'Multiplication as rows × columns.' },
  },
  barmodel: {
    label: { vi: 'Sơ đồ đoạn thẳng', en: 'Bar model' },
    desc: { vi: 'Chia đoạn (Singapore) để giải toán.', en: 'Singapore bar model.' },
  },
  partwhole: {
    label: { vi: 'Phần – tổng', en: 'Part–whole' },
    desc: { vi: 'Tách tổng thành các phần (number bond).', en: 'Split a whole into parts.' },
  },
};

/** Hợp đồng đáp án của kit — null nếu chưa khai. Xem [[AnswerDoc]]. */
export function kitAnswerDoc(kind: string): AnswerDoc | null {
  return KIT_META[kind]?.answer ?? null;
}

/** Kit render được ảnh-vật tuỳ biến (dẫn xuất từ KIT_META, không hardcode set nơi khác). */
export function kitHasObjectImage(kind: string): boolean {
  return KIT_META[kind]?.objectImage === true;
}

/** Nhãn + mô tả song ngữ của kit (author-facing) — null nếu kit chưa khai (lớp trên tự titleize). */
export function kitDisplay(kind: string): { label: KitLoc; desc: KitLoc | null } | null {
  const m = KIT_META[kind];
  if (!m?.label) return null;
  return { label: m.label, desc: m.desc ?? null };
}

/** Kit SINH item chấm được ngay (đã khai answer). Dẫn xuất từ KIT_META. */
export const GRADABLE_KITS: readonly string[] = Object.freeze(
  Object.keys(KIT_META).filter((k) => KIT_META[k]?.answer != null),
);

/** Kit hỗ trợ ảnh-vật. Dẫn xuất từ KIT_META. */
export const OBJECT_IMAGE_KITS: readonly string[] = Object.freeze(
  Object.keys(KIT_META).filter((k) => KIT_META[k]?.objectImage === true),
);

/**
 * Grade a learner's current params against a goal for an interactive gate. Uses
 * the kit's own `check` when present (value/count/total etc.), else a generic
 * field match: every key in `target` must equal that field in `params` (numbers
 * within tolerance, everything else by structural equality).
 */
export function checkAnswer(kind: string, params: unknown, target: unknown): boolean {
  const inter = REG[kind];
  if (inter?.check) return inter.check(params, target as Record<string, unknown>);
  return genericCheck(params, target);
}

function genericCheck(params: unknown, target: unknown): boolean {
  if (params == null || target == null) return false;
  const src = params as Record<string, unknown>;
  const goal = target as Record<string, unknown>;
  for (const k of Object.keys(goal)) {
    const a = src[k];
    const b = goal[k];
    if (typeof b === 'number') {
      if (typeof a !== 'number' || Math.abs(a - b) > 1e-6) return false;
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      return false;
    }
  }
  return true;
}
