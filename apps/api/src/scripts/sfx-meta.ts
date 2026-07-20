/**
 * sfx-meta.ts — turns a sound-effect id (e.g. "level_up", "animal_cat") into
 * rich, bilingual media-library metadata: a title, a searchable description and
 * a set of tag descriptors. The description + tag labels are what the embedding
 * (media-enrich) is computed from, so a Vietnamese OR English semantic query
 * ("tiếng mèo", "reward chime", "âm báo sai") lands on the right asset.
 */

export interface TagSpec {
  slug: string
  kind: 'SOURCE' | 'STYLE' | 'TOPIC' | 'KEYWORD' | 'ENTITY'
  vi: string
  en: string
}

export interface SfxMeta {
  title: { vi: string; en: string }
  description: { vi: string; en: string }
  tags: TagSpec[]
}

/** Specific entities (animals, vehicles, tools) → bilingual keyword labels. */
const ENTITY: Record<string, { vi: string; en: string }> = {
  bear: { vi: 'gấu', en: 'bear' },
  bee: { vi: 'ong', en: 'bee' },
  cat: { vi: 'mèo', en: 'cat' },
  chicken: { vi: 'gà', en: 'chicken' },
  cow: { vi: 'bò', en: 'cow' },
  cricket: { vi: 'dế', en: 'cricket' },
  dog: { vi: 'chó', en: 'dog' },
  dolphin: { vi: 'cá heo', en: 'dolphin' },
  duck: { vi: 'vịt', en: 'duck' },
  eagle: { vi: 'đại bàng', en: 'eagle' },
  elephant: { vi: 'voi', en: 'elephant' },
  frog: { vi: 'ếch', en: 'frog' },
  goat: { vi: 'dê', en: 'goat' },
  hamster: { vi: 'chuột hamster', en: 'hamster' },
  horse: { vi: 'ngựa', en: 'horse' },
  lion: { vi: 'sư tử', en: 'lion' },
  monkey: { vi: 'khỉ', en: 'monkey' },
  owl: { vi: 'cú', en: 'owl' },
  parrot: { vi: 'vẹt', en: 'parrot' },
  pig: { vi: 'lợn', en: 'pig' },
  seal: { vi: 'hải cẩu', en: 'seal' },
  sheep: { vi: 'cừu', en: 'sheep' },
  snake: { vi: 'rắn', en: 'snake' },
  tiger: { vi: 'hổ', en: 'tiger' },
  whale: { vi: 'cá voi', en: 'whale' },
}

interface Category {
  slug: string
  vi: string // short label
  en: string
  /** blurb: when this sound is used (feeds the embedding). */
  descVi: string
  descEn: string
  match: RegExp
}

/** Ordered rules — first match wins. */
const CATEGORIES: Category[] = [
  {
    slug: 'animal',
    vi: 'tiếng con vật',
    en: 'animal sound',
    descVi:
      'Tiếng kêu con vật sinh động, dùng cho bài học tự nhiên, thẻ từ vựng và trò chơi nhận biết loài vật.',
    descEn: 'A lively animal call for nature lessons, vocabulary flashcards and animal-guessing games.',
    match: /^animal_/,
  },
  {
    slug: 'vehicle',
    vi: 'phương tiện',
    en: 'vehicle',
    descVi: 'Âm thanh phương tiện giao thông, dùng cho bài học giao thông, từ vựng và hiệu ứng cảnh.',
    descEn: 'A vehicle sound for transport lessons, vocabulary and scene effects.',
    match: /airplane|bicycle|bus_|car_|helicopter|motorbike|rocket|ship_|train/,
  },
  {
    slug: 'reward',
    vi: 'phần thưởng',
    en: 'reward',
    descVi:
      'Hiệu ứng phần thưởng vui tươi — dùng khi đạt thành tích, thắng vòng, lên cấp, nhận sao, mở khoá hoặc hoàn thành.',
    descEn:
      'A cheerful reward effect — for achievements, winning, levelling up, earning stars, unlocking or completing.',
    match:
      /achievement|badge|celebrate|coin|complete|daily_reward|graduation|level_up|star|streak|treasure|unlock|xp_gain|score_reveal|correct|save_success|activate$/,
  },
  {
    slug: 'error',
    vi: 'báo lỗi',
    en: 'error',
    descVi: 'Âm báo nhẹ nhàng khi trả lời sai, thao tác không hợp lệ hoặc bị huỷ — không gây sợ cho trẻ.',
    descEn: 'A gentle negative cue for a wrong answer, invalid action or cancel — never harsh for kids.',
    match: /cancel|deactivate|drop_fail|error|hover_invalid|incorrect|retry|warning|collision_hard/,
  },
  {
    slug: 'notification',
    vi: 'thông báo',
    en: 'notification',
    descVi: 'Tiếng chuông/báo hiệu thu hút chú ý — thông báo, tin nhắn, chuông lớp, đồng hồ, đếm ngược.',
    descEn: 'An attention chime — notifications, messages, the class bell, clocks and countdowns.',
    match: /alarm|chat_message|countdown|ding|phone_ring|school_bell|timer_tick|clock_tick|notify/,
  },
  {
    slug: 'ai',
    vi: 'trợ lý AI',
    en: 'AI assistant',
    descVi: 'Hiệu ứng cho trợ lý AI và robot — bắt đầu, xử lý, phản hồi, di chuyển.',
    descEn: 'Cues for the AI assistant and robots — start, processing, feedback and movement.',
    match: /^ai_|robot_/,
  },
  {
    slug: 'classroom',
    vi: 'lớp học',
    en: 'classroom',
    descVi:
      'Âm thanh lớp trực tiếp — vào/ra lớp, nhân vật xuất hiện, giáo viên phản hồi, cửa, không khí lớp.',
    descEn: 'Live-class sounds — join/leave, characters entering, teacher feedback, doors and room ambience.',
    match: /classroom|participant_|character_|teacher_feedback|encouragement|door_/,
  },
  {
    slug: 'nature',
    vi: 'thiên nhiên',
    en: 'nature',
    descVi: 'Âm thanh thiên nhiên và thời tiết — nước, gió, mưa, lửa, sóng, sấm — cho cảnh và bài khoa học.',
    descEn: 'Nature and weather ambience — water, wind, rain, fire, waves, thunder — for scenes and science.',
    match: /forest|ocean|rain_|river|thunder|wind|volcano|cave_drop|splash|water_tap|shower|fire/,
  },
  {
    slug: 'science',
    vi: 'khoa học',
    en: 'science',
    descVi: 'Hiệu ứng phòng thí nghiệm và thí nghiệm — bong bóng, kính hiển vi, nam châm, tích điện.',
    descEn: 'Lab and experiment effects — bubbles, microscope, magnets and charging.',
    match: /lab_|microscope|microwave|kettle|magnet_|energy_charge/,
  },
  {
    slug: 'tools',
    vi: 'dụng cụ học',
    en: 'learning tools',
    descVi: 'Tiếng dụng cụ học tập — bàn tính, viết bảng, bút chì, tẩy, kéo, lật sách/trang.',
    descEn: 'Learning-tool sounds — abacus, chalk, pencil, eraser, scissors, page and book flips.',
    match: /abacus|book_open|chalk|pencil|eraser|scissors|page_flip|bead/,
  },
  {
    slug: 'quiz',
    vi: 'luyện tập',
    en: 'quiz flow',
    descVi: 'Nhịp cho bài luyện tập — bắt đầu/kết thúc bài, câu hỏi tiếp theo, suy nghĩ, gợi ý, nộp bài.',
    descEn: 'Quiz-flow beats — start/end, next question, thinking, hint and submit.',
    match: /quiz_|lesson_start|lesson_complete|next_question|think|hint|submit|pass$/,
  },
  {
    slug: 'motion',
    vi: 'chuyển động',
    en: 'motion',
    descVi: 'Hiệu ứng chuyển động và chuyển cảnh — lướt, nhảy, rơi, nảy, phóng to/thu nhỏ.',
    descEn: 'Motion and transition whooshes — swipe, jump, land, bounce, zoom.',
    match: /whoosh|bounce|jump|land|zoom_|slide|drag_start/,
  },
  {
    slug: 'ui',
    vi: 'giao diện',
    en: 'interface',
    descVi: 'Hiệu ứng giao diện tinh gọn — chạm, chọn, xác nhận, mở/đóng, ghép mảnh, kéo thả.',
    descEn: 'Crisp interface cues — tap, select, confirm, open/close, snapping and drag-drop.',
    match: /.*/, // fallback
  },
]

const humanize = (id: string) => id.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

const SOURCE_TAG: TagSpec = { slug: 'devup', kind: 'SOURCE', vi: 'DevUP', en: 'DevUP' }
const SFX_TAG: TagSpec = {
  slug: 'sfx',
  kind: 'STYLE',
  vi: 'hiệu ứng âm thanh',
  en: 'sound effect',
}

export function sfxMeta(id: string): SfxMeta {
  const cat = CATEGORIES.find((c) => c.match.test(id))!
  const human = humanize(id)
  const tags: TagSpec[] = [
    SFX_TAG,
    SOURCE_TAG,
    { slug: `sfx-${cat.slug}`, kind: 'TOPIC', vi: cat.vi, en: cat.en },
  ]

  // Entity keyword (animal / vehicle names) sharpens semantic search.
  const suffix = id.replace(/^animal_/, '')
  const ent = ENTITY[suffix]
  let entityVi = ''
  let entityEn = ''
  if (ent) {
    entityVi = ent.vi
    entityEn = ent.en
    tags.push({ slug: `animal-${suffix}`, kind: 'ENTITY', vi: ent.vi, en: ent.en })
  }

  const descVi = ent ? `Tiếng ${ent.vi} — ${cat.descVi}` : `${cat.descVi} (${human}).`
  const descEn = ent ? `A ${ent.en} sound — ${cat.descEn}` : `${cat.descEn} (${human}).`

  return {
    title: {
      vi: ent ? `Tiếng ${entityVi}` : `Hiệu ứng · ${human}`,
      en: ent ? `${entityEn.charAt(0).toUpperCase()}${entityEn.slice(1)} sound` : `SFX · ${human}`,
    },
    description: { vi: descVi, en: descEn },
    tags,
  }
}
