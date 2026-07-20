import { setRequestLocale } from 'next-intl/server'
import { ImportView } from '@/components/explainer/ImportView'

/** Nhập một bài giảng do AI viết: kiểm tra → ảnh → giọng đọc → Studio. */
export default async function ExplainerImportPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <ImportView />
}
