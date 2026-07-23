// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@bingoo.ai/ui-web'
import { GraphCanvas, type GEdge, type GNode } from './graph-canvas'
import { CaseViewer } from './case-viewer'
import { NodeExplain } from './node-explain'
import {
  useCaseExport,
  useCreateVersion,
  useFramework,
  useFrameworkGraph,
  usePublishVersion,
  type CaseExportDto,
} from '@/lib/authoring-queries'

/** Chi tiết khung: bản phát hành (tạo/publish), mục tiêu, và ĐỒ THỊ năng lực. */
export function FrameworkDetail({ slug }: { slug: string }) {
  const t = useTranslations('admin.authoring')
  const { toast } = useToast()

  const detail = useFramework(slug)
  const graph = useFrameworkGraph(slug)
  const createVersion = useCreateVersion(slug)
  const publish = usePublishVersion(slug)
  const caseExport = useCaseExport(slug)
  const [viewing, setViewing] = useState<{ semver: string; data: CaseExportDto } | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    })

  if (detail.isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    )
  }
  if (detail.isError || !detail.data) return <EmptyState title={t('failed')} />

  const f = detail.data

  return (
    <div className="space-y-6">
      {/* Bản phát hành */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>{t('versionsTitle')}</CardTitle>
          <div className="flex gap-2">
            {(['PATCH', 'MINOR', 'MAJOR'] as const).map((r) => (
              <Button
                key={r}
                size="sm"
                variant={r === 'MINOR' ? 'primary' : 'secondary'}
                loading={createVersion.isPending && createVersion.variables === r}
                onClick={() =>
                  createVersion.mutate(r, {
                    onSuccess: (v) => toast({ variant: 'success', title: `${t('newVersion')} ${v.semver}` }),
                    onError: onErr,
                  })
                }
              >
                {t('newVersion')} · {r}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {f.versions.length === 0 ? (
            <div className="p-6">
              <EmptyState title={t('empty')} />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Semver</TH>
                  <TH>{t('status')}</TH>
                  <TH>{t('objectivesTitle')}</TH>
                  <TH className="text-right">{t('actions')}</TH>
                </TR>
              </THead>
              <TBody>
                {f.versions.map((v) => (
                  <TR key={v.id}>
                    <TD className="font-mono text-xs">{v.semver}</TD>
                    <TD>
                      <Badge
                        color={
                          v.status === 'PUBLISHED'
                            ? 'success'
                            : v.status === 'DEPRECATED'
                              ? 'neutral'
                              : 'warning'
                        }
                      >
                        {v.status}
                      </Badge>
                    </TD>
                    <TD>{v.objectives}</TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant={viewing?.semver === v.semver ? 'primary' : 'secondary'}
                          loading={caseExport.isPending && caseExport.variables === v.semver}
                          onClick={() =>
                            caseExport.mutate(v.semver, {
                              onSuccess: (data) => setViewing({ semver: v.semver, data }),
                              onError: onErr,
                            })
                          }
                        >
                          {t('caseView')}
                        </Button>
                        {v.status === 'PUBLISHED' ? (
                          <span className="text-xs text-foreground-muted">{t('published')}</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={publish.isPending && publish.variables === v.id}
                            onClick={() =>
                              publish.mutate(v.id, {
                                onSuccess: () => toast({ variant: 'success', title: t('published') }),
                                onError: onErr,
                              })
                            }
                          >
                            {t('publish')}
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Trình xem CASE — hiện khi giáo viên nhấn "Xem CASE" trên một bản phát hành */}
      {viewing ? (
        <CaseViewer
          pkg={viewing.data.package}
          report={viewing.data.report}
          semver={viewing.semver}
          slug={slug}
          onClose={() => setViewing(null)}
        />
      ) : null}

      {/* Mục tiêu */}
      <Card>
        <CardHeader>
          <CardTitle>{t('objectivesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {f.objectives.length === 0 ? (
            <EmptyState title={t('empty')} />
          ) : (
            <ul className="space-y-2">
              {f.objectives.map((o) => (
                <li key={o.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  {o.code ? <Badge tone="soft">{o.code}</Badge> : null}
                  <span className="text-sm text-foreground">{o.title.vi ?? o.title.en ?? o.slug}</span>
                  <span className="font-mono text-xs text-foreground-muted">{o.slug}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Đồ thị */}
      <Card>
        <CardHeader>
          <CardTitle>{t('graphTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {graph.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : graph.data ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <GraphCanvas
                nodes={graph.data.nodes.map((n): GNode => ({
                  id: n.slug,
                  label: n.title.vi ?? n.title.en ?? n.slug,
                  kind: n.kind,
                  band: n.kind === 'OBJECTIVE' ? 0 : 1,
                  // Mạch kiến thức → gom nhóm & thu gọn. Khung lớn (Cambridge: 289 mục tiêu) vào là
                  // thấy các MẠCH trước, bung ra từng mạch một.
                  ...(n.strand ? { group: n.strand } : {}),
                }))}
                edges={graph.data.edges.map((e): GEdge => ({
                  from: e.from,
                  to: e.to,
                  relType: e.relType,
                }))}
                height={560}
                legend={[
                  { color: 'var(--color-primary)', label: 'Mục tiêu' },
                  { color: 'var(--color-accent-sunbeam)', label: 'Kỹ năng' },
                  { color: 'var(--color-accent-coral)', label: 'Kiến thức' },
                ]}
                onSelect={setSelectedNode}
              />
              {/* DIỄN GIẢI (XAI): bấm một node trên đồ thị → panel giải thích bên phải (dính khi cuộn) */}
              <div className="lg:sticky lg:top-4 lg:self-start">
                {selectedNode ? (
                  <NodeExplain slug={selectedNode} nodes={graph.data.nodes} edges={graph.data.edges} />
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-4 text-[13px] text-foreground-subtle">
                    {t('explainSelectHint')}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState title={t('empty')} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
