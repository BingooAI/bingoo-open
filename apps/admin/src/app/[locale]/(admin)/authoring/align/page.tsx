import { setRequestLocale } from 'next-intl/server';
import { PageHeader } from '@bingoo/ui-web';
import { AlignmentView } from '@/components/authoring/alignment-view';

export default async function AlignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Đối chiếu khung"
        description="Khung thứ hai KHÔNG trích thành tập KC riêng — nó được ÁNH XẠ vào vốn năng lực canonical đã có. Máy quyết bằng cấu trúc; mọi phán quyết dẫn tới GỘP đều chờ người chốt."
      />
      <AlignmentView />
    </div>
  );
}
