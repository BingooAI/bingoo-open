import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader } from '@bingoo.ai/ui-web'
import { CoursesList } from '@/components/authoring/courses-list'
import { CourseWizard } from '@/components/authoring/course-wizard'
import { GenerateSection } from '@/components/authoring/generate-section'

/** GIAI ĐOẠN 2 — vỏ khoá: danh sách + sinh vỏ khoá mới (thu gọn). Soạn giáo án từng bài ở chi tiết khoá. */
export default async function CoursesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations({ locale, namespace: 'admin.authoring' })

  return (
    <div className="space-y-6">
      <PageHeader title={t('courseListTitle')} description={t('courseListDesc')} />
      <GenerateSection title={t('courseTitle')} hint={t('courseDesc')}>
        <CourseWizard />
      </GenerateSection>
      <CoursesList />
    </div>
  )
}
