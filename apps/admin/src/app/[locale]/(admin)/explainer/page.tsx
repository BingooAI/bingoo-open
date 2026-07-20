import { setRequestLocale } from 'next-intl/server'
import { LessonsView } from '@/components/explainer/LessonsView'

/** Bài giảng Explainer — danh sách, mở lại, xoá. "Tạo mới" là trang nhập bài. */
export default async function ExplainerLessonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <LessonsView />
}
