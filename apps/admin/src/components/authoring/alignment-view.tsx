'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  useToast,
} from '@bingoo/ui-web';
import {
  useAlignHistory,
  useAlignSource,
  useApplyAlignment,
  type AlignHistoryRow,
  type AlignProposalDto,
  type AlignVerdict,
} from '@/lib/authoring-queries';
import { cn } from '@/lib/cn';

/**
 * ĐỐI CHIẾU khung thứ 2 vào vốn KC canonical đã có.
 *
 * Máy quyết phần lớn BẰNG CẤU TRÚC (miễn phí, tất định); LLM chỉ xử phần dư và phải nêu CÂU HỎI
 * PHÂN BIỆT làm bằng chứng. Nhưng mọi phán quyết dẫn tới GỘP (SAME) hoặc còn mờ (UNKNOWN/OVERLAP)
 * đều DỪNG Ở ĐÂY chờ người chốt — gộp sai làm hỏng vĩnh viễn bằng chứng học tập mà không báo lỗi.
 */

const VERDICTS: AlignVerdict[] = ['SAME', 'SUBSET', 'SUPERSET', 'OVERLAP', 'NEW'];

const VERDICT_HELP: Record<AlignVerdict, string> = {
  SAME: 'Cùng MỘT kiến thức → tái dùng KC cũ, KHÔNG tạo node mới',
  SUBSET: 'Hẹp hơn KC cũ → tạo KC mới + cạnh TIÊN QUYẾT (mới → cũ)',
  SUPERSET: 'Rộng hơn KC cũ → tạo KC mới + cạnh TIÊN QUYẾT (cũ → mới)',
  OVERLAP: 'Chồng lấn, không bao nhau → tạo KC mới + cạnh ALIGNS',
  NEW: 'Không liên quan → mint KC mới, không cạnh',
  UNKNOWN: 'Chưa quyết được — phải chọn một phán quyết trước khi ghi',
};

function verdictTone(v: AlignVerdict): 'success' | 'warning' | 'danger' | 'neutral' {
  if (v === 'SAME') return 'success';
  if (v === 'UNKNOWN') return 'danger';
  if (v === 'OVERLAP') return 'warning';
  return 'neutral';
}

export function AlignmentView() {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('math');
  const [choices, setChoices] = useState<Record<string, AlignVerdict>>({});
  const [applied, setApplied] = useState<string | null>(null);

  const align = useAlignSource();
  const apply = useApplyAlignment();
  const history = useAlignHistory();
  const report = align.data;

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: 'Thất bại',
      description: e instanceof Error ? e.message : String(e),
    });

  const run = () => {
    setChoices({});
    setApplied(null);
    align.mutate({ text, subject }, { onError: onErr });
  };

  const verdictOf = useCallback(
    (p: AlignProposalDto): AlignVerdict => choices[p.tempId] ?? p.decision.verdict,
    [choices],
  );

  const undecided = useMemo(
    () => (report?.proposals ?? []).filter((p) => verdictOf(p) === 'UNKNOWN').length,
    [report, verdictOf],
  );

  const doApply = () => {
    if (!report) return;
    // Dùng NGUYÊN slug/kind/facets do SERVER mint. Client tự chế slug + bỏ facets là cách chắc chắn
    // nhất để đẻ ra KC vô danh (vi phạm I8) và làm mù mọi lần đối chiếu sau.
    const decisions = report.proposals.map((p) => ({
      slug: p.slug,
      title: { en: p.title },
      kind: p.kind,
      ...(p.subject ? { subject: p.subject } : {}),
      ...(p.facets ? { facets: p.facets } : {}),
      verdict: verdictOf(p),
      ...(p.target ? { target: p.target } : {}),
      // Gửi kèm ĐỀ XUẤT CỦA MÁY: chỗ nào người sửa khác máy sẽ được đánh dấu `overridden` — đó là
      // tín hiệu trực tiếp nhất để biết facets/prompt cần chỉnh ở đâu.
      proposedVerdict: p.decision.verdict,
      proposedBy: p.decision.decidedBy,
      proposedReason: p.decision.reason,
    }));
    apply.mutate(decisions, {
      onSuccess: (r) => {
        setApplied(
          `tái dùng ${r.reused} · tạo mới ${r.created} · tiên quyết ${r.prerequisite} · ALIGNS ${r.aligns}`,
        );
        toast({ variant: 'success', title: 'Đã ghi quyết định đối chiếu' });
      },
      onError: onErr,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nguồn khung mới</CardTitle>
          <p className="text-sm text-foreground-muted">
            Dán văn bản chuẩn/chương trình của khung THỨ HAI (vd Bộ GD&amp;ĐT). Nó sẽ được ánh xạ
            vào vốn KC canonical đã có — <b>không</b> trích thành một tập KC riêng.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Môn/ngành">
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </Field>
          <Field label="Văn bản khung">
            <Textarea
              rows={8}
              value={text}
              placeholder="1Ss1 Count, read, and write numbers within 10; within 20; within 100…"
              onChange={(e) => setText(e.target.value)}
            />
          </Field>
          <Button
            onClick={run}
            loading={align.isPending}
            disabled={!text.trim() || align.isPending}
          >
            Đối chiếu vào đồ thị
          </Button>
        </CardContent>
      </Card>

      {report ? (
        <Card>
          <CardHeader>
            <CardTitle>Đề xuất đối chiếu</CardTitle>
            <div className="flex flex-wrap gap-2 pt-1">
              {Object.entries(report.summary).map(([v, n]) => (
                <Badge key={v} color={verdictTone(v as AlignVerdict)}>
                  {v}: {n}
                </Badge>
              ))}
              <Badge tone="soft">👤 cần người duyệt: {report.needsHuman}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.warnings.length ? (
              <Callout variant="warning" title={`Cảnh báo pipeline (${report.warnings.length})`}>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {report.warnings.slice(0, 5).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            <ul className="space-y-3">
              {report.proposals.map((p) => {
                const v = verdictOf(p);
                const changed =
                  choices[p.tempId] !== undefined && choices[p.tempId] !== p.decision.verdict;
                return (
                  <li
                    key={p.tempId}
                    className={cn(
                      'rounded-xl border p-3',
                      v === 'UNKNOWN'
                        ? 'border-danger/60 bg-danger-soft/20'
                        : 'border-border bg-surface',
                    )}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {p.needsHuman ? <span title="Cần người duyệt">👤</span> : null}
                      <span className="text-sm font-medium text-foreground">{p.title}</span>
                      {p.targetTitle ? (
                        <span className="text-xs text-foreground-muted">
                          ↔ <span className="font-mono">{p.target}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-foreground-subtle">
                          (không có KC tương tự)
                        </span>
                      )}
                      <Badge tone="soft">
                        {p.decision.decidedBy === 'structure' ? 'cấu trúc' : p.decision.decidedBy}
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-foreground-muted">{p.decision.reason}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {VERDICTS.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          title={VERDICT_HELP[opt]}
                          disabled={opt === 'SAME' && !p.target}
                          onClick={() => setChoices((c) => ({ ...c, [p.tempId]: opt }))}
                          className={cn(
                            'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-30',
                            v === opt
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-muted text-foreground-muted hover:text-foreground',
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                      {changed ? <span className="text-[11px] text-primary">đã sửa</span> : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {undecided > 0 ? (
              <Callout variant="danger" title={`Còn ${undecided} mục chưa quyết`}>
                Máy KHÔNG tự gộp. Phải chốt tất cả trước khi ghi — gộp sai làm hỏng vĩnh viễn bằng
                chứng học tập mà không có tín hiệu báo lỗi.
              </Callout>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={doApply}
                loading={apply.isPending}
                disabled={undecided > 0 || !!applied}
              >
                Ghi quyết định vào đồ thị
              </Button>
              {applied ? <span className="text-sm text-success">✅ {applied}</span> : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <AlignHistoryCard rows={history.data ?? []} />
    </div>
  );
}

/**
 * LỊCH SỬ ĐỐI CHIẾU — append-only.
 *
 * Gộp hai khái niệm làm một là thao tác VĨNH VIỄN và không suy ngược được từ đồ thị (KC của khung
 * mới biến mất hẳn). Nếu một ngày phát hiện mastery "lan" sang kiến thức học sinh chưa học, đây là
 * chỗ DUY NHẤT trả lời được: ai chốt, máy đề xuất gì, và người đã sửa máy ở đâu.
 */
function AlignHistoryCard({ rows }: { rows: readonly AlignHistoryRow[] }) {
  if (rows.length === 0) return null;
  const overridden = rows.filter((r) => r.overridden).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lịch sử đối chiếu</CardTitle>
        <p className="text-sm text-foreground-muted">
          {rows.length} quyết định · <b>{overridden}</b> lần người duyệt sửa khác máy
          {overridden > 0 ? ' — xem lại facets/prompt ở đúng những chỗ đó' : ''}.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-foreground-subtle">
              <tr>
                <th className="pb-2 pr-3 font-medium">Khái niệm</th>
                <th className="pb-2 pr-3 font-medium">Đối chiếu vào</th>
                <th className="pb-2 pr-3 font-medium">Máy</th>
                <th className="pb-2 pr-3 font-medium">Người chốt</th>
                <th className="pb-2 font-medium">Ai · khi nào</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">
                      {r.sourceTitle['en'] ?? r.sourceSlug}
                    </div>
                    <code className="text-[11px] text-foreground-subtle">{r.sourceSlug}</code>
                  </td>
                  <td className="py-2 pr-3">
                    {r.targetSlug ? (
                      <code className="text-xs">{r.targetSlug}</code>
                    ) : (
                      <span className="text-foreground-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {r.proposedVerdict ? (
                      <Badge tone="soft">
                        {r.proposedVerdict}
                        {r.proposedBy
                          ? ` · ${r.proposedBy === 'structure' ? 'cấu trúc' : r.proposedBy}`
                          : ''}
                      </Badge>
                    ) : (
                      <span className="text-foreground-subtle">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <Badge color={verdictTone(r.verdict)}>{r.verdict}</Badge>
                    {r.overridden ? (
                      <div className="mt-1 text-[11px] text-warning">người SỬA máy</div>
                    ) : null}
                  </td>
                  <td className="py-2 text-xs text-foreground-muted">
                    {r.decidedBy ?? '—'}
                    <div className="text-foreground-subtle">
                      {new Date(r.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
