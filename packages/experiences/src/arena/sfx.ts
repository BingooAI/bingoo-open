/**
 * Âm thanh arena — SFX là FILE THẬT do host phục vụ tại `/sfx/{id}.mp3` (bộ 161 hiệu ứng). Ánh xạ
 * sự kiện game → id SFX; phát chồng lấn được (clone node). Nhạc nền (BGM) tổng hợp WebAudio nhẹ, tắt
 * được. Thuần client; no-op khi không có `Audio`/`AudioContext`. Nếu file lỗi thì im lặng (không chặn).
 */

export type Sfx =
  'correct' | 'wrong' | 'hit' | 'win' | 'lose' | 'special' | 'combo' | 'round' | 'tap';

/** Đường dẫn gốc SFX host phục vụ. Đổi được nếu re-host chỗ khác. */
export const SFX_BASE = '/sfx/';

/** Sự kiện game → id file trong bộ 161. */
const EVENT_SFX: Record<Sfx, string> = {
  correct: 'correct',
  wrong: 'incorrect',
  hit: 'coin',
  win: 'level_up',
  lose: 'error_soft',
  special: 'achievement',
  combo: 'streak',
  round: 'whoosh_move',
  tap: 'click_soft',
};

const cache = new Map<string, HTMLAudioElement>();

function base(id: string): HTMLAudioElement | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  let a = cache.get(id);
  if (!a) {
    a = new Audio(`${SFX_BASE}${id}.mp3`);
    a.preload = 'auto';
    cache.set(id, a);
  }
  return a;
}

export function playSfx(kind: Sfx): void {
  const a = base(EVENT_SFX[kind]);
  if (!a) return;
  try {
    // clone để phát chồng lấn (nhiều đòn liên tiếp không cắt tiếng nhau)
    const node = a.cloneNode() as HTMLAudioElement;
    node.volume = 0.6;
    void node.play().catch(() => undefined);
  } catch {
    /* im lặng */
  }
}

/** Nạp trước vài SFX hay dùng để phát tức thì (gọi khi vào trận). */
export function primeSfx(): void {
  (['correct', 'wrong', 'hit', 'combo', 'round'] as Sfx[]).forEach((k) =>
    base(EVENT_SFX[k])?.load(),
  );
}

/* ── BGM: vòng arpeggio nhẹ (WebAudio), tắt được ── */
let bgmTimer: ReturnType<typeof setInterval> | null = null;
let ctx: AudioContext | null = null;
let step = 0;
const SEQ = [262, 330, 392, 494, 392, 330];

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function bgmTone(c: AudioContext, f: number, dur: number, peak: number): void {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, c.currentTime);
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(peak, c.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur + 0.02);
}

export function startBgm(): void {
  const c = ac();
  if (!c || bgmTimer) return;
  step = 0;
  const beat = () => {
    const f = SEQ[step % SEQ.length]!;
    bgmTone(c, f, 0.22, 0.04);
    bgmTone(c, f / 2, 0.3, 0.028);
    step++;
  };
  beat();
  bgmTimer = setInterval(beat, 420);
}

export function stopBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}
