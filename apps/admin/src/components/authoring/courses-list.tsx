'use client';

import { useTranslations } from 'next-intl';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@bingoo/ui-web';
import { Link } from '@/i18n/navigation';
import { useCourses, useDeleteCourse, useSetCourseStatus } from '@/lib/authoring-queries';

const NEXT_STATUS: Record<string, string | undefined> = {
  DRAFT: 'NEEDS_REVIEW',
  NEEDS_REVIEW: 'APPROVED',
  APPROVED: 'PUBLISHED',
};

/** Danh sách vỏ khoá — đẩy trạng thái theo vòng đời (DRAFT→…→PUBLISHED) hoặc xoá. */
export function CoursesList() {
  const t = useTranslations('admin.authoring');
  const { toast } = useToast();

  const { data, isLoading, isError } = useCourses();
  const setStatus = useSetCourseStatus();
  const del = useDeleteCourse();

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }
  if (isError) return <EmptyState title={t('failed')} />;
  if (!data?.length) return <EmptyState title={t('empty')} />;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>{t('courses')}</TH>
              <TH>{t('status')}</TH>
              <TH className="text-right">{t('actions')}</TH>
            </TR>
          </THead>
          <TBody>
            {data.map((c) => {
              const title = (c.title as Record<string, string> | null) ?? {};
              const next = NEXT_STATUS[c.status];
              return (
                <TR key={c.slug}>
                  <TD>
                    <div className="font-medium text-foreground">
                      {title.vi ?? title.en ?? c.slug}
                    </div>
                    <div className="text-xs text-foreground-muted">
                      {c.slug}
                      {c.frameworkVersionId ? ` · fw:${c.frameworkVersionId.slice(0, 8)}` : ''}
                    </div>
                  </TD>
                  <TD>
                    <Badge color={c.status === 'PUBLISHED' ? 'success' : 'warning'}>
                      {c.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/authoring/courses/${c.slug}`}
                        className="self-center text-sm font-semibold text-primary hover:underline"
                      >
                        {t('view')}
                      </Link>
                      {next ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={setStatus.isPending && setStatus.variables?.slug === c.slug}
                          onClick={() =>
                            setStatus.mutate(
                              { slug: c.slug, status: next },
                              {
                                onSuccess: (r) =>
                                  toast({ variant: 'success', title: `${r.status}` }),
                                onError: onErr,
                              },
                            )
                          }
                        >
                          → {next}
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={del.isPending && del.variables === c.slug}
                        onClick={() => {
                          if (!window.confirm(t('confirmDelete'))) return;
                          del.mutate(c.slug, { onError: onErr });
                        }}
                      >
                        {t('delete')}
                      </Button>
                    </div>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}
