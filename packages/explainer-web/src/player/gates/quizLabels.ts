/**
 * quizLabels.ts — default Vietnamese labels for the shared quiz UI (@bingoo.ai/ui-web
 * QuizShell is i18n-free — every string is data). Used by the activity gate so an
 * embedded quiz question renders with sensible copy out of the box. (Proper i18n
 * later routes these through @bingoo.ai/i18n at the app layer.)
 */
import type { QuizLabels } from '@bingoo.ai/ui-web'

export const VI_QUIZ_LABELS: QuizLabels = {
  questionOf: (i, t) => `Câu ${i + 1}/${t}`,
  check: 'Kiểm tra',
  next: 'Tiếp',
  finish: 'Xong',
  skip: 'Bỏ qua',
  undo: 'Hoàn tác',
  crosswordAcross: 'Hàng ngang',
  crosswordDown: 'Hàng dọc',
  showHint: 'Gợi ý',
  correct: 'Chính xác!',
  incorrect: 'Chưa đúng',
  explanationTitle: 'Giải thích',
  moveUp: 'Lên',
  moveDown: 'Xuống',
  fillPlaceholder: '…',
  progressLabel: 'Tiến độ',
  playMedia: 'Phát',
  vennNeither: 'Ngoài cả hai',
  clockMinuteLabels: { 0: 'đúng giờ', 30: 'rưỡi' },
  placeValueLabels: { tens: 'Chục', ones: 'Đơn vị' },
  result: {
    passTitle: 'Hoàn thành!',
    failTitle: 'Thử lại nhé',
    passSubtitle: 'Làm tốt lắm!',
    failSubtitle: 'Xem lại rồi thử lại nhé.',
    accuracyLabel: 'Độ chính xác',
    correctLabel: 'Số câu đúng',
    retry: 'Làm lại',
    continueLabel: 'Tiếp tục',
  },
}
