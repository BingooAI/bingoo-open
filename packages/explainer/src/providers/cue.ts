/**
 * providers/cue.ts — narration ↔ visual sync timing (pure).
 *
 * This is the explainer's sync spine: a narration script carries `[[cue:cN]]`
 * markers; once a TTS voice yields per-word timings, each cue is re-timed onto
 * the MOMENT its following word is actually spoken. Vendor-neutral — the same
 * functions run whether the words come from ElevenLabs alignment, another TTS's
 * timestamps, or the even-spacing fallback. Kept identical to the studio logic.
 */
import type { Word, CueMark } from './types';

/** Strip cue markers + collapse whitespace → the text a TTS actually speaks. */
export const cleanScript = (text: string): string =>
  (text ?? '')
    .replace(/\[\[cue:[^\]]+\]\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Re-time each `[[cue:x]]` to the start of the word that follows it. */
export function cueMarksFrom(rawScript: string, words: Word[]): CueMark[] {
  const parts = (rawScript ?? '').split(/(\[\[cue:[^\]]+\]\])/);
  const marks: CueMark[] = [];
  let wi = 0;
  const lastEnd = words.length ? words[words.length - 1]!.end : 0;
  for (const p of parts) {
    const m = p.match(/^\[\[cue:([^\]]+)\]\]$/);
    if (m)
      marks.push({ cue: m[1]!, t: +(wi < words.length ? words[wi]!.start : lastEnd).toFixed(2) });
    else wi += p.split(/\s+/).filter(Boolean).length;
  }
  return marks;
}

/** Even word spacing (~2.6 w/s), no audio — the offline shape every adapter reuses. */
export function evenWords(cleanText: string): Word[] {
  const per = 0.38;
  return cleanText
    .split(/\s+/)
    .filter(Boolean)
    .map((w, i) => ({
      word: w,
      start: +(0.25 + i * per).toFixed(2),
      end: +(0.25 + (i + 1) * per).toFixed(2),
    }));
}

/** Char-level alignment (start/end per character) → word timings. The shape
 *  ElevenLabs `with-timestamps` returns; other TTS char-timing maps here too. */
export function charsToWords(a: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): Word[] {
  const words: Word[] = [];
  let cur = '',
    start = 0,
    end = 0,
    open = false;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i]!;
    if (/\s/.test(ch)) {
      if (open) {
        words.push({ word: cur, start, end });
        cur = '';
        open = false;
      }
    } else {
      if (!open) {
        start = a.character_start_times_seconds[i]!;
        open = true;
      }
      cur += ch;
      end = a.character_end_times_seconds[i]!;
    }
  }
  if (open && cur) words.push({ word: cur, start, end });
  return words;
}
