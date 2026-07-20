/**
 * sfx-catalog.ts — the built-in sound-effect library.
 *
 * A `{ verb: "sfx", sound: "<name>" }` action names a sound from THIS catalog;
 * the player plays the real clip. Before this, `sfx` fell back to a synth blip —
 * fine as a placeholder, wrong for a finished lesson. Names are stable ids, so a
 * doc that says `sound: "correct"` keeps working if the hosting URL changes.
 *
 * Hosted on bingoo R2 (migrated from the source pack). Curated by the team. The editor exposes it as a picker
 * and the authoring prompt lists the names so a model can only pick real ones.
 */
export const SFX_CATALOG: Record<string, string> = {
  abacus: 'https://storage.bingoo.ai/sfx/abacus.mp3',
  achievement: 'https://storage.bingoo.ai/sfx/achievement.mp3',
  activate: 'https://storage.bingoo.ai/sfx/activate.mp3',
  activity_complete: 'https://storage.bingoo.ai/sfx/activity_complete.mp3',
  ai_end: 'https://storage.bingoo.ai/sfx/ai_end.mp3',
  ai_feedback: 'https://storage.bingoo.ai/sfx/ai_feedback.mp3',
  ai_processing: 'https://storage.bingoo.ai/sfx/ai_processing.mp3',
  ai_start: 'https://storage.bingoo.ai/sfx/ai_start.mp3',
  airplane: 'https://storage.bingoo.ai/sfx/airplane.mp3',
  alarm_clock: 'https://storage.bingoo.ai/sfx/alarm_clock.mp3',
  animal_bear: 'https://storage.bingoo.ai/sfx/animal_bear.mp3',
  animal_bee: 'https://storage.bingoo.ai/sfx/animal_bee.mp3',
  animal_cat: 'https://storage.bingoo.ai/sfx/animal_cat.mp3',
  animal_chicken: 'https://storage.bingoo.ai/sfx/animal_chicken.mp3',
  animal_cow: 'https://storage.bingoo.ai/sfx/animal_cow.mp3',
  animal_cricket: 'https://storage.bingoo.ai/sfx/animal_cricket.mp3',
  animal_dog: 'https://storage.bingoo.ai/sfx/animal_dog.mp3',
  animal_dolphin: 'https://storage.bingoo.ai/sfx/animal_dolphin.mp3',
  animal_duck: 'https://storage.bingoo.ai/sfx/animal_duck.mp3',
  animal_eagle: 'https://storage.bingoo.ai/sfx/animal_eagle.mp3',
  animal_elephant: 'https://storage.bingoo.ai/sfx/animal_elephant.mp3',
  animal_frog: 'https://storage.bingoo.ai/sfx/animal_frog.mp3',
  animal_goat: 'https://storage.bingoo.ai/sfx/animal_goat.mp3',
  animal_hamster: 'https://storage.bingoo.ai/sfx/animal_hamster.mp3',
  animal_horse: 'https://storage.bingoo.ai/sfx/animal_horse.mp3',
  animal_lion: 'https://storage.bingoo.ai/sfx/animal_lion.mp3',
  animal_monkey: 'https://storage.bingoo.ai/sfx/animal_monkey.mp3',
  animal_owl: 'https://storage.bingoo.ai/sfx/animal_owl.mp3',
  animal_parrot: 'https://storage.bingoo.ai/sfx/animal_parrot.mp3',
  animal_pig: 'https://storage.bingoo.ai/sfx/animal_pig.mp3',
  animal_seal: 'https://storage.bingoo.ai/sfx/animal_seal.mp3',
  animal_sheep: 'https://storage.bingoo.ai/sfx/animal_sheep.mp3',
  animal_snake: 'https://storage.bingoo.ai/sfx/animal_snake.mp3',
  animal_tiger: 'https://storage.bingoo.ai/sfx/animal_tiger.mp3',
  animal_whale: 'https://storage.bingoo.ai/sfx/animal_whale.mp3',
  assignment_return: 'https://storage.bingoo.ai/sfx/assignment_return.mp3',
  badge_unlock: 'https://storage.bingoo.ai/sfx/badge_unlock.mp3',
  bead: 'https://storage.bingoo.ai/sfx/bead.mp3',
  bicycle_bell: 'https://storage.bingoo.ai/sfx/bicycle_bell.mp3',
  block_snap: 'https://storage.bingoo.ai/sfx/block_snap.mp3',
  book_open: 'https://storage.bingoo.ai/sfx/book_open.mp3',
  bounce: 'https://storage.bingoo.ai/sfx/bounce.mp3',
  bus_stop: 'https://storage.bingoo.ai/sfx/bus_stop.mp3',
  cancel: 'https://storage.bingoo.ai/sfx/cancel.mp3',
  car_drive: 'https://storage.bingoo.ai/sfx/car_drive.mp3',
  car_horn: 'https://storage.bingoo.ai/sfx/car_horn.mp3',
  car_start: 'https://storage.bingoo.ai/sfx/car_start.mp3',
  card_flip: 'https://storage.bingoo.ai/sfx/card_flip.mp3',
  cave_drop: 'https://storage.bingoo.ai/sfx/cave_drop.mp3',
  celebrate: 'https://storage.bingoo.ai/sfx/celebrate.mp3',
  chalk_write: 'https://storage.bingoo.ai/sfx/chalk_write.mp3',
  character_enter: 'https://storage.bingoo.ai/sfx/character_enter.mp3',
  character_exit: 'https://storage.bingoo.ai/sfx/character_exit.mp3',
  chat_message: 'https://storage.bingoo.ai/sfx/chat_message.mp3',
  classroom_ambience: 'https://storage.bingoo.ai/sfx/classroom_ambience.mp3',
  click_soft: 'https://storage.bingoo.ai/sfx/click_soft.mp3',
  clock_tick: 'https://storage.bingoo.ai/sfx/clock_tick.mp3',
  close: 'https://storage.bingoo.ai/sfx/close.mp3',
  code_block_snap: 'https://storage.bingoo.ai/sfx/code_block_snap.mp3',
  coin: 'https://storage.bingoo.ai/sfx/coin.mp3',
  collision_hard: 'https://storage.bingoo.ai/sfx/collision_hard.mp3',
  collision_soft: 'https://storage.bingoo.ai/sfx/collision_soft.mp3',
  confirm: 'https://storage.bingoo.ai/sfx/confirm.mp3',
  correct: 'https://storage.bingoo.ai/sfx/correct.mp3',
  countdown_alert: 'https://storage.bingoo.ai/sfx/countdown_alert.mp3',
  course_complete: 'https://storage.bingoo.ai/sfx/course_complete.mp3',
  cup_clink: 'https://storage.bingoo.ai/sfx/cup_clink.mp3',
  daily_reward: 'https://storage.bingoo.ai/sfx/daily_reward.mp3',
  deactivate: 'https://storage.bingoo.ai/sfx/deactivate.mp3',
  ding: 'https://storage.bingoo.ai/sfx/ding.mp3',
  door_close: 'https://storage.bingoo.ai/sfx/door_close.mp3',
  door_knock: 'https://storage.bingoo.ai/sfx/door_knock.mp3',
  door_open: 'https://storage.bingoo.ai/sfx/door_open.mp3',
  drag_start: 'https://storage.bingoo.ai/sfx/drag_start.mp3',
  drop_fail: 'https://storage.bingoo.ai/sfx/drop_fail.mp3',
  drop_success: 'https://storage.bingoo.ai/sfx/drop_success.mp3',
  encouragement: 'https://storage.bingoo.ai/sfx/encouragement.mp3',
  energy_charge: 'https://storage.bingoo.ai/sfx/energy_charge.mp3',
  eraser: 'https://storage.bingoo.ai/sfx/eraser.mp3',
  error_soft: 'https://storage.bingoo.ai/sfx/error_soft.mp3',
  fire: 'https://storage.bingoo.ai/sfx/fire.mp3',
  forest: 'https://storage.bingoo.ai/sfx/forest.mp3',
  fraction_snap: 'https://storage.bingoo.ai/sfx/fraction_snap.mp3',
  graduation: 'https://storage.bingoo.ai/sfx/graduation.mp3',
  helicopter: 'https://storage.bingoo.ai/sfx/helicopter.mp3',
  hint: 'https://storage.bingoo.ai/sfx/hint.mp3',
  hover_invalid: 'https://storage.bingoo.ai/sfx/hover_invalid.mp3',
  hover_valid: 'https://storage.bingoo.ai/sfx/hover_valid.mp3',
  incorrect: 'https://storage.bingoo.ai/sfx/incorrect.mp3',
  jump: 'https://storage.bingoo.ai/sfx/jump.mp3',
  kettle: 'https://storage.bingoo.ai/sfx/kettle.mp3',
  lab_bubble: 'https://storage.bingoo.ai/sfx/lab_bubble.mp3',
  lab_click: 'https://storage.bingoo.ai/sfx/lab_click.mp3',
  land: 'https://storage.bingoo.ai/sfx/land.mp3',
  lesson_complete: 'https://storage.bingoo.ai/sfx/lesson_complete.mp3',
  lesson_start: 'https://storage.bingoo.ai/sfx/lesson_start.mp3',
  level_up: 'https://storage.bingoo.ai/sfx/level_up.mp3',
  lock: 'https://storage.bingoo.ai/sfx/lock.mp3',
  magnet_attach: 'https://storage.bingoo.ai/sfx/magnet_attach.mp3',
  magnet_detach: 'https://storage.bingoo.ai/sfx/magnet_detach.mp3',
  microscope_focus: 'https://storage.bingoo.ai/sfx/microscope_focus.mp3',
  microwave: 'https://storage.bingoo.ai/sfx/microwave.mp3',
  motorbike: 'https://storage.bingoo.ai/sfx/motorbike.mp3',
  next_question: 'https://storage.bingoo.ai/sfx/next_question.mp3',
  ocean_wave: 'https://storage.bingoo.ai/sfx/ocean_wave.mp3',
  open: 'https://storage.bingoo.ai/sfx/open.mp3',
  page_flip: 'https://storage.bingoo.ai/sfx/page_flip.mp3',
  participant_join: 'https://storage.bingoo.ai/sfx/participant_join.mp3',
  participant_leave: 'https://storage.bingoo.ai/sfx/participant_leave.mp3',
  pass: 'https://storage.bingoo.ai/sfx/pass.mp3',
  pencil_write: 'https://storage.bingoo.ai/sfx/pencil_write.mp3',
  phone_ring: 'https://storage.bingoo.ai/sfx/phone_ring.mp3',
  pickup: 'https://storage.bingoo.ai/sfx/pickup.mp3',
  pop_in: 'https://storage.bingoo.ai/sfx/pop_in.mp3',
  pop_out: 'https://storage.bingoo.ai/sfx/pop_out.mp3',
  puzzle_fit: 'https://storage.bingoo.ai/sfx/puzzle_fit.mp3',
  quiz_end: 'https://storage.bingoo.ai/sfx/quiz_end.mp3',
  quiz_start: 'https://storage.bingoo.ai/sfx/quiz_start.mp3',
  rain_heavy: 'https://storage.bingoo.ai/sfx/rain_heavy.mp3',
  rain_light: 'https://storage.bingoo.ai/sfx/rain_light.mp3',
  retry: 'https://storage.bingoo.ai/sfx/retry.mp3',
  river: 'https://storage.bingoo.ai/sfx/river.mp3',
  robot_beep: 'https://storage.bingoo.ai/sfx/robot_beep.mp3',
  robot_move: 'https://storage.bingoo.ai/sfx/robot_move.mp3',
  rocket_launch: 'https://storage.bingoo.ai/sfx/rocket_launch.mp3',
  rotate_tick: 'https://storage.bingoo.ai/sfx/rotate_tick.mp3',
  save_success: 'https://storage.bingoo.ai/sfx/save_success.mp3',
  school_bell: 'https://storage.bingoo.ai/sfx/school_bell.mp3',
  scissors: 'https://storage.bingoo.ai/sfx/scissors.mp3',
  score_reveal: 'https://storage.bingoo.ai/sfx/score_reveal.mp3',
  shape_place: 'https://storage.bingoo.ai/sfx/shape_place.mp3',
  ship_horn: 'https://storage.bingoo.ai/sfx/ship_horn.mp3',
  shower: 'https://storage.bingoo.ai/sfx/shower.mp3',
  slide: 'https://storage.bingoo.ai/sfx/slide.mp3',
  snap: 'https://storage.bingoo.ai/sfx/snap.mp3',
  spark: 'https://storage.bingoo.ai/sfx/spark.mp3',
  splash: 'https://storage.bingoo.ai/sfx/splash.mp3',
  star: 'https://storage.bingoo.ai/sfx/star.mp3',
  streak: 'https://storage.bingoo.ai/sfx/streak.mp3',
  submit: 'https://storage.bingoo.ai/sfx/submit.mp3',
  surprise: 'https://storage.bingoo.ai/sfx/surprise.mp3',
  success: 'https://storage.bingoo.ai/sfx/success.mp3',
  teacher_feedback: 'https://storage.bingoo.ai/sfx/teacher_feedback.mp3',
  think: 'https://storage.bingoo.ai/sfx/think.mp3',
  thunder: 'https://storage.bingoo.ai/sfx/thunder.mp3',
  tile_click: 'https://storage.bingoo.ai/sfx/tile_click.mp3',
  timer_tick: 'https://storage.bingoo.ai/sfx/timer_tick.mp3',
  train: 'https://storage.bingoo.ai/sfx/train.mp3',
  treasure: 'https://storage.bingoo.ai/sfx/treasure.mp3',
  unit_complete: 'https://storage.bingoo.ai/sfx/unit_complete.mp3',
  unlock: 'https://storage.bingoo.ai/sfx/unlock.mp3',
  volcano: 'https://storage.bingoo.ai/sfx/volcano.mp3',
  warning_soft: 'https://storage.bingoo.ai/sfx/warning_soft.mp3',
  water_tap: 'https://storage.bingoo.ai/sfx/water_tap.mp3',
  whoosh_close: 'https://storage.bingoo.ai/sfx/whoosh_close.mp3',
  whoosh_move: 'https://storage.bingoo.ai/sfx/whoosh_move.mp3',
  whoosh_open: 'https://storage.bingoo.ai/sfx/whoosh_open.mp3',
  wind: 'https://storage.bingoo.ai/sfx/wind.mp3',
  wire_connect: 'https://storage.bingoo.ai/sfx/wire_connect.mp3',
  xp_gain: 'https://storage.bingoo.ai/sfx/xp_gain.mp3',
  zoom_in: 'https://storage.bingoo.ai/sfx/zoom_in.mp3',
  zoom_out: 'https://storage.bingoo.ai/sfx/zoom_out.mp3',
};

export const SFX_NAMES = Object.keys(SFX_CATALOG);
export const sfxUrl = (name: string): string | undefined => SFX_CATALOG[name];

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
  | 'Khác';

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
};

function sfxGroup(name: string): SfxGroup {
  if (name.startsWith('animal_')) return 'Động vật';
  if (
    name.startsWith('ai_') ||
    /robot|participant|chat|save_success|activate|deactivate|lock|unlock/.test(name)
  )
    return 'AI · hệ thống';
  if (
    /correct|incorrect|confirm|cancel|submit|hint|retry|pass|error|warning|click|hover|drag|drop|ding|close|open$/.test(
      name,
    )
  )
    return 'Phản hồi';
  if (
    /achievement|celebrate|level_up|coin|star|treasure|xp|badge|graduation|reward|streak|surprise|complete|score|unlock/.test(
      name,
    )
  )
    return 'Khen thưởng';
  if (
    /whoosh|pop_|zoom|slide|bounce|jump|land|snap|spark|swipe|rotate|magnet|puzzle|shape|block|tile|fraction|card_flip/.test(
      name,
    )
  )
    return 'Chuyển động';
  if (
    /chalk|pencil|eraser|school_bell|book|page|scissors|abacus|bead|classroom|quiz|lesson|assignment|next_question|course|unit/.test(
      name,
    )
  )
    return 'Lớp học';
  if (
    /rain|wind|thunder|ocean|river|forest|fire|volcano|splash|water|shower|kettle|microwave/.test(
      name,
    )
  )
    return 'Thiên nhiên';
  if (/airplane|train|helicopter|rocket|car_|bus|bicycle|motorbike|ship/.test(name))
    return 'Phương tiện';
  if (/door|phone|alarm|clock|timer|cup|bell/.test(name)) return 'Đồ vật';
  return 'Khác';
}

const prettify = (n: string) => n.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

export type SfxMeta = { name: string; group: SfxGroup; label: string; url: string };

export const SFX_META: SfxMeta[] = SFX_NAMES.map((name) => ({
  name,
  group: sfxGroup(name),
  label: SFX_LABEL[name] ?? prettify(name.replace(/^animal_/, '')),
  url: SFX_CATALOG[name]!,
}));

export const SFX_GROUPS = [...new Set(SFX_META.map((m) => m.group))];
