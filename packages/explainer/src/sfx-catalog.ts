// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * sfx-catalog.ts — the built-in sound-effect vocabulary.
 *
 * This file lists sound *names*, not sounds. A `{ verb: "sfx", sound: "<name>" }`
 * action names an entry here, and the host decides what — if anything — that name
 * plays. The audio itself is not part of this repository: the original pack could
 * not be traced to a licence that permits redistribution, and a URL pointing at
 * someone else's server is the same problem with an extra hop.
 *
 * So a lesson that says `sound: "correct"` stays portable. It is valid whether the
 * host serves a licensed pack, serves nothing (the player falls back to a synth
 * blip), or serves its own recordings under these names.
 *
 * Point `NEXT_PUBLIC_SFX_BASE_URL` at a directory of `<name>.mp3` files to enable
 * real audio. Leaving it unset is a supported state, not a broken one.
 */

/** Every sound name a document may reference. Stable ids — renaming one breaks saved lessons. */
export const SFX_NAMES: string[] = [
  'abacus',
  'achievement',
  'activate',
  'activity_complete',
  'ai_end',
  'ai_feedback',
  'ai_processing',
  'ai_start',
  'airplane',
  'alarm_clock',
  'animal_bear',
  'animal_bee',
  'animal_cat',
  'animal_chicken',
  'animal_cow',
  'animal_cricket',
  'animal_dog',
  'animal_dolphin',
  'animal_duck',
  'animal_eagle',
  'animal_elephant',
  'animal_frog',
  'animal_goat',
  'animal_hamster',
  'animal_horse',
  'animal_lion',
  'animal_monkey',
  'animal_owl',
  'animal_parrot',
  'animal_pig',
  'animal_seal',
  'animal_sheep',
  'animal_snake',
  'animal_tiger',
  'animal_whale',
  'assignment_return',
  'badge_unlock',
  'bead',
  'bicycle_bell',
  'block_snap',
  'book_open',
  'bounce',
  'bus_stop',
  'cancel',
  'car_drive',
  'car_horn',
  'car_start',
  'card_flip',
  'cave_drop',
  'celebrate',
  'chalk_write',
  'character_enter',
  'character_exit',
  'chat_message',
  'classroom_ambience',
  'click_soft',
  'clock_tick',
  'close',
  'code_block_snap',
  'coin',
  'collision_hard',
  'collision_soft',
  'confirm',
  'correct',
  'countdown_alert',
  'course_complete',
  'cup_clink',
  'daily_reward',
  'deactivate',
  'ding',
  'door_close',
  'door_knock',
  'door_open',
  'drag_start',
  'drop_fail',
  'drop_success',
  'encouragement',
  'energy_charge',
  'eraser',
  'error_soft',
  'fire',
  'forest',
  'fraction_snap',
  'graduation',
  'helicopter',
  'hint',
  'hover_invalid',
  'hover_valid',
  'incorrect',
  'jump',
  'kettle',
  'lab_bubble',
  'lab_click',
  'land',
  'lesson_complete',
  'lesson_start',
  'level_up',
  'lock',
  'magnet_attach',
  'magnet_detach',
  'microscope_focus',
  'microwave',
  'motorbike',
  'next_question',
  'ocean_wave',
  'open',
  'page_flip',
  'participant_join',
  'participant_leave',
  'pass',
  'pencil_write',
  'phone_ring',
  'pickup',
  'pop_in',
  'pop_out',
  'puzzle_fit',
  'quiz_end',
  'quiz_start',
  'rain_heavy',
  'rain_light',
  'retry',
  'river',
  'robot_beep',
  'robot_move',
  'rocket_launch',
  'rotate_tick',
  'save_success',
  'school_bell',
  'scissors',
  'score_reveal',
  'shape_place',
  'ship_horn',
  'shower',
  'slide',
  'snap',
  'spark',
  'splash',
  'star',
  'streak',
  'submit',
  'surprise',
  'success',
  'teacher_feedback',
  'think',
  'thunder',
  'tile_click',
  'timer_tick',
  'train',
  'treasure',
  'unit_complete',
  'unlock',
  'volcano',
  'warning_soft',
  'water_tap',
  'whoosh_close',
  'whoosh_move',
  'whoosh_open',
  'wind',
  'wire_connect',
  'xp_gain',
  'zoom_in',
  'zoom_out',
]

const NAME_SET = new Set(SFX_NAMES)

/** Whether a document's `sound` names a real entry. Cheap enough to call per action. */
export const isSfxName = (name: string): boolean => NAME_SET.has(name)

/**
 * Resolve a name to a playable URL, or `undefined` when the host has configured no pack.
 * The base arrives as an argument rather than from the environment, so this package keeps
 * returning the same answer for the same inputs and stays runnable outside a browser.
 */
export const sfxUrl = (name: string, baseUrl: string | undefined): string | undefined =>
  baseUrl && isSfxName(name) ? `${baseUrl.replace(/\/$/, '')}/${name}.mp3` : undefined

/* ── grouping + Vietnamese labels ────────────────────────────────────────────
 * The catalog names are English slugs ("whoosh_move") — unreadable to a Viet
 * teacher scanning for a sound. SFX_META gives each a GROUP and a friendly label
 * so the editor can show "Vút (bay/lướt)" under "Chuyển động" instead of a raw id.
 * Derived by rule from the name, so a new sound is categorised automatically. */
export type SfxGroup =
  | 'Phản hồi'
  | 'Khen thưởng'
  | 'Chuyển động'
  | 'Lớp học'
  | 'Động vật'
  | 'Thiên nhiên'
  | 'Phương tiện'
  | 'Đồ vật'
  | 'AI · hệ thống'
  | 'Khác'

/** Vietnamese labels for the common ones; the rest are prettified from the slug. */
const SFX_LABEL: Record<string, string> = {
  correct: 'Đúng rồi',
  incorrect: 'Sai rồi',
  confirm: 'Xác nhận',
  cancel: 'Huỷ',
  submit: 'Nộp bài',
  hint: 'Gợi ý',
  retry: 'Thử lại',
  pass: 'Qua bài',
  ding: 'Ting (chú ý)',
  error_soft: 'Lỗi nhẹ',
  warning_soft: 'Cảnh báo',
  click_soft: 'Bấm nhẹ',
  close: 'Đóng',
  open: 'Mở',
  achievement: 'Thành tích',
  celebrate: 'Ăn mừng',
  level_up: 'Lên cấp',
  coin: 'Đồng xu',
  star: 'Ngôi sao',
  treasure: 'Kho báu',
  xp_gain: 'Cộng điểm',
  badge_unlock: 'Mở huy hiệu',
  graduation: 'Tốt nghiệp',
  daily_reward: 'Thưởng ngày',
  streak: 'Chuỗi đúng',
  surprise: 'Bất ngờ',
  pop_in: 'Bụp (hiện ra)',
  pop_out: 'Bụp (biến mất)',
  whoosh_move: 'Vút (lướt)',
  whoosh_open: 'Vút (mở)',
  whoosh_close: 'Vút (đóng)',
  bounce: 'Nảy',
  jump: 'Nhảy',
  land: 'Đáp',
  slide: 'Trượt',
  snap: 'Tách',
  spark: 'Loé sáng',
  zoom_in: 'Phóng to',
  zoom_out: 'Thu nhỏ',
  chalk_write: 'Viết phấn',
  pencil_write: 'Viết chì',
  eraser: 'Tẩy',
  school_bell: 'Chuông trường',
  book_open: 'Mở sách',
  page_flip: 'Lật trang',
  scissors: 'Kéo cắt',
  abacus: 'Bàn tính',
  bead: 'Hạt tính',
  rain_light: 'Mưa nhẹ',
  rain_heavy: 'Mưa to',
  wind: 'Gió',
  thunder: 'Sấm',
  ocean_wave: 'Sóng biển',
  river: 'Suối',
  forest: 'Rừng',
  fire: 'Lửa',
  volcano: 'Núi lửa',
  splash: 'Tõm nước',
  airplane: 'Máy bay',
  train: 'Tàu hoả',
  helicopter: 'Trực thăng',
  rocket_launch: 'Phóng tên lửa',
  car_horn: 'Còi xe',
  ship_horn: 'Còi tàu',
  bicycle_bell: 'Chuông xe đạp',
  door_open: 'Mở cửa',
  door_close: 'Đóng cửa',
  door_knock: 'Gõ cửa',
  phone_ring: 'Chuông điện thoại',
  alarm_clock: 'Đồng hồ báo thức',
  clock_tick: 'Tích tắc',
  timer_tick: 'Đếm giờ',
}

function sfxGroup(name: string): SfxGroup {
  if (name.startsWith('animal_')) return 'Động vật'
  if (
    name.startsWith('ai_') ||
    /robot|participant|chat|save_success|activate|deactivate|lock|unlock/.test(name)
  )
    return 'AI · hệ thống'
  if (
    /correct|incorrect|confirm|cancel|submit|hint|retry|pass|error|warning|click|hover|drag|drop|ding|close|open$/.test(
      name,
    )
  )
    return 'Phản hồi'
  if (
    /achievement|celebrate|level_up|coin|star|treasure|xp|badge|graduation|reward|streak|surprise|complete|score|unlock/.test(
      name,
    )
  )
    return 'Khen thưởng'
  if (
    /whoosh|pop_|zoom|slide|bounce|jump|land|snap|spark|swipe|rotate|magnet|puzzle|shape|block|tile|fraction|card_flip/.test(
      name,
    )
  )
    return 'Chuyển động'
  if (
    /chalk|pencil|eraser|school_bell|book|page|scissors|abacus|bead|classroom|quiz|lesson|assignment|next_question|course|unit/.test(
      name,
    )
  )
    return 'Lớp học'
  if (/rain|wind|thunder|ocean|river|forest|fire|volcano|splash|water|shower|kettle|microwave/.test(name))
    return 'Thiên nhiên'
  if (/airplane|train|helicopter|rocket|car_|bus|bicycle|motorbike|ship/.test(name)) return 'Phương tiện'
  if (/door|phone|alarm|clock|timer|cup|bell/.test(name)) return 'Đồ vật'
  return 'Khác'
}

const prettify = (n: string) => n.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

export type SfxMeta = { name: string; group: SfxGroup; label: string }

export const SFX_META: SfxMeta[] = SFX_NAMES.map((name) => ({
  name,
  group: sfxGroup(name),
  label: SFX_LABEL[name] ?? prettify(name.replace(/^animal_/, '')),
}))

export const SFX_GROUPS = [...new Set(SFX_META.map((m) => m.group))]
