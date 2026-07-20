/**
 * Personalization (L3) — chân dung + dữ liệu engine → GenerationSpec (chưa payload).
 * Cùng Instruction Plan → nhiều spec khác nhau; CHUẨN/cut KHÔNG đổi theo level (CONTENT-ARCHITECTURE §6).
 */

import type { Slug } from '@bingoo/knowledge-engine';

export type LearningLevel = 'L1' | 'L2' | 'L3';
export type DifficultyBand = 'easy' | 'core' | 'stretch';

export interface LearnerPersona {
  readonly level: LearningLevel;
  readonly language: string;
  readonly age?: number;
  readonly interests?: readonly string[];
  readonly accessibility?: readonly string[];
}

export interface TeacherPersona {
  readonly style?: string;
  readonly classSize?: number;
  readonly minutes?: number;
  readonly variants?: readonly string[];
}

/** Cái engine biết về học viên lúc này — dẫn dắt cá nhân hoá (frontier/fading). */
export interface EngineSnapshot {
  readonly mastered?: readonly Slug[];
  readonly fading?: readonly Slug[];
  readonly frontier?: readonly Slug[];
}

/** Đầu ra: đơn đặt hàng cho khâu sinh content (S4b) — chưa có payload. */
export interface GenerationSpec {
  readonly targetKcs: readonly Slug[];
  readonly variant: string;
  readonly storyTheme?: string;
  readonly difficultyBand: DifficultyBand;
  readonly bandRange: readonly DifficultyBand[];
  readonly scaffolding: {
    readonly hintOpenLevel: number;
    readonly representationStage: 'concrete' | 'pictorial' | 'abstract';
  };
  readonly reviewInserts: readonly Slug[];
  readonly language: string;
  readonly accessibility?: readonly string[];
  readonly pace: 'slow' | 'standard' | 'fast';
}
