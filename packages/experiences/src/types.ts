import type { ContentBlock } from '@bingoo/core';
import type { ExperienceDescriptor } from '@bingoo/learning-experience';
import type { IconChipColor, InteractiveBlock, LeaderboardEntry } from '@bingoo/ui-web';
import type { ReactNode } from 'react';

/** Hình dạng nội dung DẠY — chỉ áp cho experience=learn (course/lesson/infinite). */
export type LearnFormat = 'course' | 'lesson' | 'infinite';

/** Sắc thái topic — feed theme theo trục này (đổi data → đổi giao diện). */
export type TopicAccent = 'primary' | 'teal' | 'sunbeam' | 'coral' | 'success';

export interface LearnStep {
  id: string;
  title?: ReactNode;
  eyebrow?: ReactNode;
  /** Emoji/biểu tượng chủ đề (feed dùng làm điểm nhấn lớn). */
  emoji?: string;
  /** Sắc thái chủ đề — feed tô nền/màu theo đây. */
  accent?: TopicAccent;
  blocks: ContentBlock[];
  /** Node tuỳ ý do host cắm (vd manipulative/explainer) — nếu có, render THAY cho blocks. */
  node?: ReactNode;
}

export interface LearnLessonRef {
  id: string;
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  progress?: number;
  color?: IconChipColor;
}

export interface LearnCourseData {
  title: ReactNode;
  subtitle?: ReactNode;
  progress?: number;
  xp?: { level: number; xp: number; nextXp: number };
  path?: { id: string; status: 'done' | 'current' | 'locked'; label?: ReactNode }[];
  lessons: LearnLessonRef[];
}

/** Câu hỏi drill (practice + arena) — engine chấm đúng/sai, view vẽ. */
export interface LearnQuizItem {
  id: string;
  prompt: ReactNode;
  choices: { id: string; label: ReactNode }[];
  answerId: string;
  explanation?: ReactNode;
}

export interface LearnProjectData {
  title: ReactNode;
  brief: ReactNode;
  tasks: { id: string; label: ReactNode }[];
  workspaceLabel: ReactNode;
}

export interface Participant {
  name: string;
  src?: string | null;
  role?: 'teacher' | 'student';
  /** Trạng thái thật (do host/engine cấp) — KHÔNG suy theo index trong view. */
  muted?: boolean;
  handRaised?: boolean;
  speaking?: boolean;
}

/** Cấu hình trận đấu arena — tuỳ chọn; host cấp để bỏ mọi hằng số cứng trong view. */
export interface ArenaConfig {
  rounds?: number;
  enemyEmoji?: string;
  bossEmoji?: string;
  youEmoji?: string;
  allyEmoji?: string;
}

export interface LearnHud {
  xp?: number;
  streak?: number;
  hearts?: { left: number; max: number };
}

/** Một "kênh" chủ đề trong feed — trục NGANG (vuốt ngang đổi topic); mỗi topic có feed dọc riêng. */
export interface FeedTopic {
  id: string;
  name: ReactNode;
  accent: TopicAccent;
  steps: LearnStep[];
}

/** ĐẦU VÀO nội dung — mọi dữ liệu do host cấp; package KHÔNG chứa nội dung. */
export interface ExperienceContent {
  steps?: LearnStep[];
  /** Feed 2 trục: các topic (ngang) × item (dọc). Nếu có, feed dùng cái này. */
  topics?: FeedTopic[];
  course?: LearnCourseData;
  /** Ngân hàng câu hỏi drill cho practice + arena. */
  quiz?: LearnQuizItem[];
  leaderboard?: LeaderboardEntry[];
  opponents?: Participant[];
  participants?: Participant[];
  project?: LearnProjectData;
  arena?: ArenaConfig;
}

/** ĐẦU VÀO nhãn hiển thị — package i18n-free, host cấp text (R4). */
export interface ExperienceLabels {
  prev: ReactNode;
  next: ReactNode;
  finish: ReactNode;
  loadMore: ReactNode;
  completed: ReactNode;
  restart: ReactNode;
  start: ReactNode;
  empty: ReactNode;
  exit?: string;
  action: { check: ReactNode; next: ReactNode; correct: ReactNode; incorrect: ReactNode };
  chrome: { live: string; scheduled: string; participants: string; opponents: string };
  arena: {
    start: ReactNode;
    difficultyLabel: ReactNode;
    diffEasy: ReactNode;
    diffMid: ReactNode;
    diffHard: ReactNode;
    pillarLearn: ReactNode;
    pillarPlay: ReactNode;
    you: ReactNode;
    enemy: ReactNode;
    boss: ReactNode;
    ally: ReactNode;
    won: ReactNode;
    lost: ReactNode;
    combo: ReactNode;
    special: ReactNode;
    score: ReactNode;
    modes: Record<'practice' | 'coop' | 'solo' | 'vsAI', { title: ReactNode; desc: ReactNode }>;
  };
  feed: { swipe: ReactNode; forYou: ReactNode };
  classroom: {
    live: ReactNode;
    title: ReactNode;
    you: ReactNode;
    whiteboard: ReactNode;
    participants: ReactNode;
    teacher: ReactNode;
    penTool: string;
    clearTool: string;
    chatTitle: ReactNode;
    chatPlaceholder: string;
    send: ReactNode;
    raiseHand: string;
    leave: string;
    muteToggle: string;
    camToggle: string;
    share: string;
    people: string;
    chat: string;
    grid: string;
    present: string;
    reactions: string;
  };
  /** Nhãn block `discuss` khi render nội dung (ContentBlocks). */
  discuss?: {
    pair?: string;
    group?: string;
    class?: string;
    minutes?: (n: number) => string;
  };
}

export interface LearnExperienceProps {
  descriptor: ExperienceDescriptor;
  format?: LearnFormat;
  content: ExperienceContent;
  labels: ExperienceLabels;
  /** Tên hiển thị của experience hiện tại (cho thanh chrome). */
  modeLabel?: ReactNode;
  hud?: LearnHud;
  /** Render block tương tác (quiz/flashcards/experiment/selfAssessment…) trong nội dung dạy. */
  renderActivity?: (block: InteractiveBlock) => ReactNode;
  companionSlot?: ReactNode;
  onExit?: () => void;
  onSelectLesson?: (id: string) => void;
  className?: string;
}
