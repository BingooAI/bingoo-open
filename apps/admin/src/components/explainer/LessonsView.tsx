'use client';

/**
 * LessonsView — the lessons a person owns.
 *
 * "Create" is the import page: a lesson comes in as JSON from a model, gets
 * validated, illustrated and voiced there, and is saved on the way through. This
 * screen is where you come back to one.
 *
 * The counts are the point. A lesson's pictures and narration are MediaAssets
 * with permanent URLs, made once and paid for once — so `ảnh 6/6 · giọng 15/15`
 * means "this one is finished and costs nothing to open", and `ảnh 2/6` means
 * "four pictures still to find or generate".
 */
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { listLessons, deleteLesson, type LessonRow } from '@/lib/explainerLessons';

const STATUS: Record<LessonRow['status'], { label: string; tone: string }> = {
  DRAFT: { label: 'Nháp', tone: 'var(--foreground-muted, #6f665e)' },
  READY: { label: 'Sẵn sàng', tone: '#3f9d5a' },
  PUBLISHED: { label: 'Đã xuất bản', tone: '#d4703c' },
};

export function LessonsView() {
  const [rows, setRows] = useState<LessonRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listLessons()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  async function remove(l: LessonRow) {
    if (!confirm(`Xoá bài "${l.title}"? Ảnh và giọng đọc vẫn còn trong thư viện media.`)) return;
    setBusy(l.id);
    try {
      await deleteLesson(l.id);
      setRows(await listLessons());
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        padding: '24px 20px 80px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <header style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Bài giảng Explainer</h1>
          <p
            style={{
              margin: '4px 0 0',
              color: 'var(--foreground-muted, #6f665e)',
              maxWidth: '70ch',
            }}
          >
            Ảnh và giọng đọc trong mỗi bài là <b>MediaAsset thật</b>, sinh một lần và trả tiền một
            lần. Mở lại bài là phát luôn — không sinh lại.
          </p>
        </div>
        <Link
          href="/explainer-import"
          style={{
            padding: '9px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
            background: 'var(--accent-coral, #d4703c)',
            color: '#fff',
          }}
        >
          + Bài mới
        </Link>
      </header>

      {rows === null && <p style={{ color: 'var(--foreground-muted, #6f665e)' }}>Đang tải…</p>}

      {rows?.length === 0 && (
        <div
          style={{
            padding: '28px 20px',
            borderRadius: 12,
            border: '1px dashed var(--border, #e6ddd0)',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: '0 0 12px', color: 'var(--foreground-muted, #6f665e)' }}>
            Chưa có bài nào. Tải file hướng dẫn, đưa cho ChatGPT/Claude, rồi nhập JSON nó trả về.
          </p>
          <Link
            href="/explainer-import"
            style={{ fontWeight: 700, color: 'var(--accent-coral, #d4703c)' }}
          >
            Tạo bài đầu tiên →
          </Link>
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {rows.map((l) => {
            const st = STATUS[l.status];
            const imagesLeft = l.imagesTotal - l.imagesDone;
            const audioLeft = l.audioTotal - l.audioDone;
            return (
              <li
                key={l.id}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: '1px solid var(--border, #e6ddd0)',
                  opacity: busy === l.id ? 0.5 : 1,
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800 }}>{l.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--foreground-muted, #6f665e)' }}>
                    <code>{l.slug}</code> · sửa lần cuối{' '}
                    {new Date(l.updatedAt).toLocaleString('vi')}
                  </div>
                </div>

                <span style={{ fontSize: 12, fontWeight: 700, color: st.tone }}>{st.label}</span>

                <span
                  style={{
                    fontSize: 13,
                    color: 'var(--foreground-muted, #6f665e)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                  title={
                    imagesLeft || audioLeft
                      ? `Còn ${imagesLeft} ảnh và ${audioLeft} lời giảng chưa làm — sẽ tốn tiền`
                      : 'Đã đủ ảnh và giọng đọc — mở lại không tốn gì'
                  }
                >
                  ảnh {l.imagesDone}/{l.imagesTotal} · giọng {l.audioDone}/{l.audioTotal}
                  {imagesLeft || audioLeft ? '' : ' ✓'}
                </span>

                <Link
                  href={{ pathname: '/explainer-import', query: { lesson: l.id } }}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 13,
                    textDecoration: 'none',
                    border: '1px solid var(--border, #e6ddd0)',
                    color: 'inherit',
                  }}
                >
                  Mở
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(l)}
                  disabled={busy === l.id}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    border: '1px solid var(--border, #e6ddd0)',
                    background: 'transparent',
                    color: 'inherit',
                  }}
                >
                  Xoá
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
