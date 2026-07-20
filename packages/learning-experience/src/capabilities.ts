/**
 * Từ descriptor → tập NĂNG LỰC host phải cung cấp. Đây là SEAM sạch giữa engine (thuần) và app:
 * engine không biết cách dựng video call hay matchmaking, nó chỉ nói "trải nghiệm này CẦN gì".
 * Host đọc danh sách này để quyết mount subsystem nào (realtime transport, lịch, roster, AI tutor…).
 */

import type { ExperienceDescriptor } from './descriptor';

export const CAPABILITY = [
  'lesson-runtime', // trình chạy bài giảng có cấu trúc (learn)
  'practice-queue', // hàng đợi luyện tập / SRS (practice)
  'matchmaking', // ghép đối thủ (arena)
  'leaderboard', // bảng xếp hạng (arena)
  'feed-stream', // dòng nội dung ngắn (feed)
  'project-workspace', // không gian làm dự án (project)
  'realtime', // kênh đồng bộ thời gian thực (live)
  'scheduling', // đặt lịch / booking (scheduled)
  'roster', // quản lý danh sách lớp (class/classroom)
  'ai-tutor', // runtime gia sư AI (companion=ai)
  'human-presence', // sự hiện diện người thật (teacher/mentor/ta/peer)
  'social-chat', // trò chuyện / thảo luận nhóm (peer, group, class)
] as const;
export type Capability = (typeof CAPABILITY)[number];

/** Suy ra năng lực cần thiết. Trả mảng theo thứ tự `CAPABILITY` (ổn định, đã khử trùng lặp). */
export function deriveCapabilities(d: ExperienceDescriptor): readonly Capability[] {
  const set = new Set<Capability>();

  switch (d.experience) {
    case 'learn':
      set.add('lesson-runtime');
      break;
    case 'practice':
      set.add('practice-queue');
      break;
    case 'arena':
      set.add('matchmaking');
      set.add('leaderboard');
      break;
    case 'feed':
      set.add('feed-stream');
      break;
    case 'project':
      set.add('project-workspace');
      break;
  }

  if (d.delivery === 'live') set.add('realtime');
  if (d.delivery === 'classroom') set.add('roster');

  switch (d.companion) {
    case 'ai':
      set.add('ai-tutor');
      break;
    case 'teacher':
    case 'mentor':
    case 'ta':
      set.add('human-presence');
      break;
    case 'peer':
      set.add('human-presence');
      set.add('social-chat');
      break;
    case 'self':
      break;
  }

  if (d.scale === 'group' || d.scale === 'class') set.add('social-chat');
  if (d.scale === 'class') set.add('roster');

  if (d.time === 'scheduled') set.add('scheduling');
  if (d.time === 'live') set.add('realtime');

  return CAPABILITY.filter((c) => set.has(c));
}
