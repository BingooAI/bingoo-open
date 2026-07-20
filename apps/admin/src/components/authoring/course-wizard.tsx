'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Badge, Button, Field, Input, Textarea, useToast } from '@bingoo/ui-web'
import { ArrowRight } from 'lucide-react'
import { Dropzone } from './dropzone'
import { Stepper, type StepDef, type StepState } from './stepper'
import { useCourseFromBook, useCourseFromPrompt, type SavedCourseDto } from '@/lib/authoring-queries'
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/cn'

type Mode = 'prompt' | 'book'

/**
 * GIAI ĐOẠN 2 — sinh VỎ KHOÁ bám khung: nguồn (mô tả / sách PDF) → cây chương→bài (chỉ neo vào KC
 * CÓ THẬT trong đồ thị). DỪNG Ở ĐÂY. Sinh giáo án + nội dung TỪNG BÀI là GIAI ĐOẠN 3, làm dần về sau
 * ở trang chi tiết khoá — không gộp vào đây vì đó là việc của thời điểm khác (một vỏ khoá có thể để
 * đó nhiều ngày rồi mới soạn tới từng bài). Sau khi tạo xong, wizard chỉ DẪN sang chi tiết khoá.
 */
export function CourseWizard() {
  const t = useTranslations('admin.authoring')
  const { toast } = useToast()

  const [mode, setMode] = useState<Mode>('prompt')
  const [brief, setBrief] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fwVersionId, setFwVersionId] = useState('')
  const [fwSlug, setFwSlug] = useState('')
  const [stage, setStage] = useState('')
  const [course, setCourse] = useState<SavedCourseDto | null>(null)

  const fromPrompt = useCourseFromPrompt()
  const fromBook = useCourseFromBook()
  const pending = fromPrompt.isPending || fromBook.isPending

  const onErr = (e: unknown) =>
    toast({
      variant: 'danger',
      title: t('failed'),
      description: e instanceof Error ? e.message : String(e),
    })

  const run = () => {
    const onSuccess = (c: SavedCourseDto) => setCourse(c)
    // Phạm vi quyết định vốn KC được map — sách Stage 1 chỉ neo vào KC mà khung Stage 1 chứng nhận.
    const scope = {
      ...(fwVersionId.trim() ? { frameworkVersionId: fwVersionId.trim() } : {}),
      ...(fwSlug.trim() ? { frameworkSlug: fwSlug.trim() } : {}),
      ...(stage.trim() ? { stage: stage.trim() } : {}),
    }
    if (mode === 'book') {
      if (!file) return
      fromBook.mutate({ file, ...scope }, { onSuccess, onError: onErr })
    } else {
      fromPrompt.mutate({ brief, ...scope }, { onSuccess, onError: onErr })
    }
  }

  const lessonCount = course?.plan.units.reduce((n, u) => n + u.lessons.length, 0) ?? 0
  const hasSource = mode === 'book' ? !!file : brief.trim().length > 0

  const genState: StepState = pending
    ? 'running'
    : fromPrompt.isError || fromBook.isError
      ? 'error'
      : course
        ? 'done'
        : 'idle'

  const steps: StepDef[] = [
    {
      key: 'source',
      title: t('srcTitle'),
      state: hasSource ? 'done' : 'idle',
      body: (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['prompt', 'book'] as Mode[]).map((m) => (
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
                {m === 'prompt' ? t('srcPrompt') : t('courseBook')}
              </button>
            ))}
          </div>

          {mode === 'book' ? (
            <Dropzone
              file={file}
              onFile={setFile}
              label={t('dropLabel')}
              hint={t('courseBook')}
              disabled={pending}
            />
          ) : (
            <Textarea
              rows={3}
              value={brief}
              placeholder={t('coursePromptPh')}
              onChange={(e) => setBrief(e.target.value)}
            />
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={t('fwVersion')}>
              <Input value={fwVersionId} onChange={(e) => setFwVersionId(e.target.value)} />
            </Field>
            {/* Khung + stage: quyết định sách được map vào bộ KC nào. Sách Lớp 1 phải neo vào khung Lớp 1. */}
            <Field label="Khung (slug)">
              <Input
                value={fwSlug}
                placeholder="cambridge-primary-maths-0096"
                onChange={(e) => setFwSlug(e.target.value)}
              />
            </Field>
            <Field label="Stage / Grade">
              <Input value={stage} placeholder="Stage 1" onChange={(e) => setStage(e.target.value)} />
            </Field>
          </div>
          {mode === 'book' ? (
            <p className="text-xs text-foreground-muted">
              Vỏ khoá sẽ bám <b>đúng cấu trúc và thứ tự của sách</b>; mỗi bài được map vào KC của khung theo
              stage đã chọn. Bài dạy kiến thức ngoài khung vẫn giữ đúng chỗ và được đánh dấu
              <span className="text-warning"> chưa map</span>.
            </p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'shell',
      title: t('courseTitle'),
      state: genState,
      ...(course
        ? {
            summary: `${course.plan.units.length} ${t('units')} · ${lessonCount} ${t('lessons')}`,
          }
        : {}),
      body: (
        <div className="space-y-3">
          <Button size="sm" onClick={run} loading={pending} disabled={!hasSource || pending}>
            {mode === 'book' ? t('courseGenBook') : t('courseGenPrompt')}
          </Button>

          {course ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge tone="soft">{course.slug}</Badge>
                <Badge tone="soft">{course.status}</Badge>
                <Badge>
                  {course.plan.objectives.length} {t('objectives')}
                </Badge>
              </div>

              {course.bookReport?.truncated ? (
                <div className="rounded-lg border border-danger/50 bg-danger-soft/20 p-2.5 text-xs text-danger">
                  Sách dài hơn cửa sổ đọc — có thể THIẾU chương cuối. Tách sách theo phần rồi sinh từng phần
                  để đủ cấu trúc.
                </div>
              ) : null}

              {course.bookReport && course.bookReport.unmappedLessons.length > 0 ? (
                <div className="rounded-lg border border-warning/50 bg-warning-soft/20 p-2.5 text-xs">
                  <div className="font-semibold text-warning">
                    {course.bookReport.unmappedLessons.length} bài giữ đúng cấu trúc sách nhưng CHƯA map được
                    KC nào
                  </div>
                  <div className="mt-1 text-foreground-muted">
                    {course.bookReport.unmappedLessons.slice(0, 8).join(' · ')}
                    {course.bookReport.unmappedLessons.length > 8 ? ' …' : ''}
                  </div>
                  <div className="mt-1 text-foreground-subtle">
                    Thường là ôn tập/kiểm tra, hoặc kiến thức ngoài stage đã chọn. Đối chiếu bổ sung KC hoặc
                    đổi stage nếu cần.
                  </div>
                </div>
              ) : null}

              {/* XEM TRƯỚC cấu trúc (chỉ đọc). Soạn giáo án/nội dung từng bài là bước sau, ở chi tiết khoá. */}
              <ol className="space-y-3">
                {course.plan.units.map((u) => (
                  <li key={u.slug}>
                    <div className="text-sm font-semibold text-foreground">
                      {u.title.vi ?? u.title.en ?? u.slug}
                    </div>
                    <ul className="mt-1 space-y-1">
                      {u.lessons.map((l) => (
                        <li key={l.slug} className="flex items-center gap-2 text-xs text-foreground-muted">
                          <span>{l.title.vi ?? l.title.en ?? l.slug}</span>
                          {l.teaches.length === 0 ? (
                            <Badge color="warning" tone="soft">
                              chưa map KC
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>

              {/* DẪN sang giai đoạn 3 — soạn giáo án + nội dung từng bài, ở thời điểm khác. */}
              <Link
                href={`/authoring/courses/${course.slug}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
              >
                Mở khoá để soạn giáo án từng bài
                <ArrowRight className="size-4" />
              </Link>
            </div>
          ) : null}
        </div>
      ),
    },
  ]

  return <Stepper steps={steps} />
}
