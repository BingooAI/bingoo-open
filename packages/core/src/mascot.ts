/**
 * Bingoo mascot catalog. The animated SVGs live in `public/brand/mascot/emotions`
 * (copied from the brand kit). Each emotion maps to an optional sound effect.
 */
export const MASCOT_EMOTIONS = [
  'happy',
  'excited',
  'proud',
  'amazed',
  'thinking',
  'calm',
  'celebrate',
  'cheer',
  'praise',
  'encourage',
  'care',
  'congrats',
  'curious',
  'focus',
  'gentle',
  'idea',
  'studying',
  'writing',
  'graduate',
  'start',
  'win',
  'waiting',
  'sleepy',
  'resting',
  'confused',
  'disappointed',
  'sad',
  'longing',
  'companion',
  'schedule',
  'target',
] as const

export type MascotEmotion = (typeof MASCOT_EMOTIONS)[number]

/** Emotions that ship with a matching sound effect in `public/sounds`. */
const EMOTION_SOUND: Partial<Record<MascotEmotion, string>> = {
  happy: 'success',
  excited: 'levelup',
  proud: 'proud',
  celebrate: 'celebrate',
  congrats: 'congrats',
  encourage: 'star',
  win: 'win',
  idea: 'idea',
}

export function mascotSrc(emotion: MascotEmotion): string {
  return `/brand/mascot/emotions/${emotion}.svg`
}

export function mascotSound(emotion: MascotEmotion): string | undefined {
  const file = EMOTION_SOUND[emotion]
  return file ? `/sounds/${file}.wav` : undefined
}
