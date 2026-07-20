import { setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@bingoo.ai/ui-web';
import { CoverageView } from '@/components/authoring/coverage-view';

export default async function CoveragePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Độ phủ 2 chiều"
        description="Mục tiêu (khung) ↕ Năng lực ↕ Bài học (khoá). Thấy được lỗ hổng cả hai phía: mục tiêu chưa dạy, và năng lực dạy thừa không chuẩn nào chứng nhận."
      />
      <CoverageView />
    </div>
  );
}
