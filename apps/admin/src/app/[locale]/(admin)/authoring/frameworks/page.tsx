import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@bingoo/ui-web';
import { FrameworksList } from '@/components/authoring/frameworks-list';
import { FrameworkWizard } from '@/components/authoring/framework-wizard';
import { GenerateSection } from '@/components/authoring/generate-section';

/** GIAI ĐOẠN 1 — khung năng lực: danh sách + sinh khung mới (thu gọn). Không lẫn với sinh vỏ khoá. */
export default async function FrameworksPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'admin.authoring' });

  return (
    <div className="space-y-6">
      <PageHeader title={t('fwListTitle')} description={t('fwListDesc')} />
      <GenerateSection title={t('fwTitle')} hint={t('fwDesc')}>
        <FrameworkWizard />
      </GenerateSection>
      <FrameworksList />
    </div>
  );
}
