'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button, Callout, Textarea, useToast } from '@bingoo.ai/ui-web'
import { Dropzone } from './dropzone'
import { Stepper, type StepDef, type StepState } from './stepper'
import {
  useApplyFramework,
  useExtractText,
  useFrameworkFromPrompt,
  useFrameworkFromText,
  type IngestResultDto,
} from '@/lib/authoring-queries'
import { cn } from '@/lib/cn'

type Mode = 'pdf' | 'prompt'

/**
 * Sinh khung năng lực theo TỪNG BƯỚC, mỗi bước hiện kết quả để người soạn xem/sửa trước khi đi tiếp:
 * nguồn → (OCR → văn bản sửa được) → khái niệm + quan hệ → duyệt & ghi vào đồ thị.
 */
export function FrameworkWizard({ onApplied }: { onApplied?: () => void }) {
  const t = useTranslations('admin.authoring')
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [topic, setTopic] = useState('')
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<IngestResultDto | null>(null)
  const [appliedMsg, setAppliedMsg] = useState<string | null>(null)

  const extract = useExtractText()
  const fromText = useFrameworkFromText()
  const fromPrompt = useFrameworkFromPrompt()
  const apply = useApplyFramework()

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    })

  const reset = () => {
    setFile(null)
    setTopic('')
    setText('')
    setDraft(null)
    setAppliedMsg(null)
  }

  const runExtract = () => {
    if (!file) return
    extract.mutate(file, {
      onSuccess: (r) => setText(r.text),
      onError: onErr,
    })
  }

  const runGenerate = () => {
    const onSuccess = (r: IngestResultDto) => setDraft(r)
    if (mode === 'pdf') fromText.mutate({ text }, { onSuccess, onError: onErr })
    else fromPrompt.mutate({ topic }, { onSuccess, onError: onErr })
  }

  const runApply = () => {
    if (!draft) return
    apply.mutate(draft.compiled, {
      onSuccess: (r) => {
        setAppliedMsg(`${r.nodes} ${t('concepts')} · ${r.edges} ${t('edges')}`)
        toast({ variant: 'success', title: t('fwApplied') })
        onApplied?.()
      },
      onError: onErr,
    })
  }

  // ── trạng thái từng bước ───────────────────────────────────────────────────
  const hasSource = mode === 'pdf' ? !!file : topic.trim().length > 0
  const genPending = fromText.isPending || fromPrompt.isPending

  const sourceState: StepState = hasSource ? 'done' : 'idle'
  const extractState: StepState = extract.isPending
    ? 'running'
    : extract.isError
      ? 'error'
      : text
        ? 'done'
        : 'idle'
  const genState: StepState = genPending
    ? 'running'
    : fromText.isError || fromPrompt.isError
      ? 'error'
      : draft
        ? 'done'
        : 'idle'
  const applyState: StepState = apply.isPending
    ? 'running'
    : apply.isError
      ? 'error'
      : appliedMsg
        ? 'done'
        : 'idle'

  const steps: StepDef[] = []

  // 1) Nguồn
  steps.push({
    key: 'source',
    title: t('srcTitle'),
    state: sourceState,
    body: (
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['pdf', 'prompt'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-muted text-foreground-muted hover:text-foreground',
              )}
            >
              {m === 'pdf' ? t('srcPdf') : t('srcPrompt')}
            </button>
          ))}
        </div>

        {mode === 'pdf' ? (
          <Dropzone
            file={file}
            onFile={setFile}
            label={t('dropLabel')}
            hint={t('dropHint')}
            disabled={extract.isPending}
          />
        ) : (
          <Textarea
            rows={3}
            value={topic}
            placeholder={t('fwPromptPh')}
            onChange={(e) => setTopic(e.target.value)}
          />
        )}
      </div>
    ),
  })

  // 2) Trích văn bản — chỉ ở luồng PDF
  if (mode === 'pdf') {
    steps.push({
      key: 'extract',
      title: t('extractTitle'),
      state: extractState,
      ...(text ? { summary: t('textChars', { n: text.length }) } : {}),
      body: (
        <div className="space-y-3">
          <Button
            size="sm"
            onClick={runExtract}
            loading={extract.isPending}
            disabled={!file || extract.isPending}
          >
            {t('extractRun')}
          </Button>
          {text ? (
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-label={t('editText')}
            />
          ) : null}
        </div>
      ),
    })
  }

  // 3) Sinh khung
  steps.push({
    key: 'generate',
    title: t('genTitle'),
    state: genState,
    ...(draft
      ? {
          summary: `${draft.compiled.graph.nodes.length} ${t('concepts')} · ${draft.compiled.graph.edges.length} ${t('edges')} · ${draft.compiled.objectives.length} ${t('objectives')}`,
        }
      : {}),
    body: (
      <div className="space-y-3">
        <Button
          size="sm"
          onClick={runGenerate}
          loading={genPending}
          disabled={genPending || (mode === 'pdf' ? !text.trim() : !topic.trim())}
        >
          {t('genRun')}
        </Button>

        {draft ? (
          <div className="space-y-3">
            {/* KC + FACETS — facets là thứ quyết định hai KC có phải một; giấu nó đi thì người soạn
                không có căn cứ nào để duyệt. */}
            <ul className="space-y-1.5">
              {draft.compiled.graph.nodes
                .filter((n) => n.kind !== 'OBJECTIVE')
                .slice(0, 14)
                .map((n) => {
                  const f = (n.facets ?? {}) as Record<string, unknown>
                  const chips = [
                    typeof f.object === 'string' ? `object: ${f.object}` : null,
                    f.scope ? `scope: ${JSON.stringify(f.scope)}` : null,
                    typeof f.channel === 'string' ? f.channel : null,
                    typeof f.bloom === 'string' ? f.bloom : null,
                    typeof f.representation === 'string' ? f.representation : null,
                  ].filter(Boolean) as string[]
                  return (
                    <li key={n.slug} className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm text-foreground">{n.title.en ?? n.title.vi ?? n.slug}</span>
                        <span className="font-mono text-[11px] text-foreground-subtle">{n.slug}</span>
                      </div>
                      {chips.length ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {chips.map((c) => (
                            <span
                              key={c}
                              className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-foreground-muted"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[10px] text-danger">
                          chưa khai facet — không phân biệt được với KC khác
                        </span>
                      )}
                    </li>
                  )
                })}
            </ul>

            {/* VI PHẠM BẤT BIẾN — xem TRƯỚC, không đợi bấm Duyệt mới bị chặn. */}
            {draft.violations?.length ? (
              <Callout
                variant={draft.violations.some((v) => v.severity === 'error') ? 'danger' : 'warning'}
                title={`Vi phạm bất biến (${draft.violations.length})`}
              >
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {draft.violations.slice(0, 6).map((v, k) => (
                    <li key={`${v.code}-${k}`}>
                      <span className="font-mono text-xs">{v.code}</span> — {v.message}
                    </li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            {/* CẢNH BÁO PIPELINE — nuốt cảnh báo là lý do đồ thị từng mất sạch cạnh mà không ai biết. */}
            {draft.warnings?.length ? (
              <Callout variant="warning" title={`Cảnh báo pipeline (${draft.warnings.length})`}>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {draft.warnings.slice(0, 5).map((w, k) => (
                    <li key={k}>{w}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}

            {draft.issues.length ? (
              <Callout variant={draft.blocking ? 'danger' : 'warning'} title={t('issues')}>
                <ul className="list-disc space-y-1 pl-4 text-sm">
                  {draft.issues.slice(0, 6).map((i, k) => (
                    <li key={`${i.code}-${k}`}>{i.message}</li>
                  ))}
                </ul>
              </Callout>
            ) : null}
          </div>
        ) : null}
      </div>
    ),
  })

  // 4) Duyệt & ghi
  steps.push({
    key: 'apply',
    title: t('applyTitle'),
    state: applyState,
    ...(appliedMsg ? { summary: appliedMsg } : {}),
    body: (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={runApply}
          loading={apply.isPending}
          disabled={!draft || draft.blocking || !!appliedMsg}
        >
          {draft?.blocking ? t('blocked') : t('fwApply')}
        </Button>
        {appliedMsg ? (
          <Button size="sm" variant="secondary" onClick={reset}>
            {t('reset')}
          </Button>
        ) : null}
      </div>
    ),
  })

  return <Stepper steps={steps} />
}
