/**
 * Locale NỘI DUNG cho quiz — text của quiz (đề, nhãn đáp án…) giờ có thể là đa ngôn ngữ
 * (`LocalizedString` = chuỗi HOẶC map {en,vi,…}). QuizShell cấp locale người xem qua context; các input
 * con đọc bằng `useQuizText()` để rút đúng chuỗi. Content một-ngôn-ngữ (chuỗi cũ) vẫn hiện nguyên.
 */
'use client'

import { createContext, useContext } from 'react'
import { pickText, type LocalizedString } from '@bingoo/core'

/** Locale hiển thị hiện hành (mặc định 'vi' — sản phẩm ưu tiên tiếng Việt). */
const QuizLocaleContext = createContext<string>('vi')

export const QuizLocaleProvider = QuizLocaleContext.Provider

/** Hook rút chuỗi hiển thị theo locale hiện hành: `t(item.label)`. */
export function useQuizText(): (value: LocalizedString | undefined | null) => string {
  const locale = useContext(QuizLocaleContext)
  return (value) => pickText(value, locale)
}

/** Locale hiện hành (khi cần truyền tay). */
export function useQuizLocale(): string {
  return useContext(QuizLocaleContext)
}
