import { setRequestLocale } from 'next-intl/server';
import { CourseDetail } from '@/components/authoring/course-detail';

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  return <CourseDetail slug={slug} />;
}
