// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
'use client'

import { ArrowLeftRight, BookOpen, GitCompareArrows, LayoutGrid, Network, SquareStack } from 'lucide-react'
import { Card, CardContent } from '@bingoo.ai/ui-web'
import { Link } from '@/i18n/navigation'
import { useCourses, useFrameworks } from '@/lib/authoring-queries'

/**
 * TỔNG QUAN pipeline biên soạn — KHÔNG nhét form.
 *
 * Lý do tồn tại: ba việc dưới đây xảy ra ở BA THỜI ĐIỂM khác nhau, không phải một luồng liền mạch:
 *   ① Dựng KHUNG năng lực   — một lần, khi đưa một chương trình/curriculum vào hệ.
 *   ② Dựng VỎ KHOÁ          — khi bắt đầu làm một khoá, bám vào khung đã có.
 *   ③ Soạn GIÁO ÁN + nội dung từng bài — làm DẦN về sau, từng bài một.
 * Gộp chúng vào một trang (như trước) khiến người soạn tưởng phải làm tuốt một mạch, và giấu mất bước
 * ③. Trang này chỉ là TẤM BẢN ĐỒ: mỗi giai đoạn dẫn tới đúng chỗ của nó.
 */

interface Stage {
  readonly n: number
  readonly Icon: typeof Network
  readonly title: string
  readonly when: string
  readonly desc: string
  readonly href: string
  readonly cta: string
  readonly count?: number
}

function StageCard({ s }: { s: Stage }) {
  return (
    <Card>
      <CardContent className="flex gap-4 p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <s.Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-semibold text-foreground-subtle">Bước {s.n}</span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-foreground-muted">
              {s.when}
            </span>
            {s.count !== undefined ? (
              <span className="ml-auto text-xs text-foreground-muted">{s.count} mục</span>
            ) : null}
          </div>
          <h3 className="mt-1 text-base font-semibold text-foreground">{s.title}</h3>
          <p className="mt-1 text-sm text-foreground-muted">{s.desc}</p>
          <Link
            href={s.href}
            className="mt-3 inline-block text-sm font-semibold text-primary hover:underline"
          >
            {s.cta} →
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

export function AuthoringHub() {
  const frameworks = useFrameworks()
  const courses = useCourses()

  const stages: Stage[] = [
    {
      n: 1,
      Icon: Network,
      title: 'Khung năng lực',
      when: 'một lần / mỗi chương trình',
      desc: 'Tải PDF chương trình hoặc mô tả để sinh đồ thị năng lực (objective → KC → tiên quyết). Đây là gốc mọi khoá bám vào.',
      href: '/authoring/frameworks',
      cta: 'Xem & sinh khung',
      count: frameworks.data?.length,
    },
    {
      n: 2,
      Icon: GitCompareArrows,
      title: 'Đối chiếu khung',
      when: 'khi thêm khung thứ 2+',
      desc: 'Ánh xạ một khung khác (vd Bộ GD&ĐT) vào vốn KC canonical đã có — không đẻ ra một tập KC riêng. Người duyệt chốt các ca gộp.',
      href: '/authoring/align',
      cta: 'Mở đối chiếu',
    },
    {
      n: 3,
      Icon: BookOpen,
      title: 'Vỏ khoá học',
      when: 'khi bắt đầu một khoá',
      desc: 'Sinh cây chương→bài từ sách (bám đúng cấu trúc sách) hoặc từ mô tả, map mỗi bài vào KC của khung theo grade/stage.',
      href: '/authoring/courses',
      cta: 'Xem & sinh vỏ khoá',
      count: courses.data?.length,
    },
    {
      n: 4,
      Icon: SquareStack,
      title: 'Giáo án & nội dung từng bài',
      when: 'làm dần, từng bài',
      desc: 'Trong từng khoá: mỗi bài sinh giáo án (Instruction Plan) → nội dung học/đánh giá/ôn tập → duyệt để item vào ngân hàng. Đây là bước riêng, không ép làm ngay sau khi tạo vỏ khoá.',
      href: '/authoring/courses',
      cta: 'Vào một khoá để soạn bài',
    },
    {
      n: 5,
      Icon: LayoutGrid,
      title: 'Độ phủ',
      when: 'để rà soát chất lượng',
      desc: 'Đồ thị 2 chiều khung ↕ KC ↕ bài học: thấy mục tiêu nào chưa được dạy, bài nào dạy kiến thức không mục tiêu nào chứng nhận.',
      href: '/authoring/coverage',
      cta: 'Xem độ phủ',
    },
    {
      n: 6,
      Icon: ArrowLeftRight,
      title: 'Chuyển khung & lỗ hổng',
      when: 'khi so hai khung',
      desc: 'Học theo khung này chuyển sang khung kia còn thiếu gì. Đối chiếu qua KC nền dùng chung (vd MOET Lớp 1 → Cambridge Stage 2): thấy phần trùng và các mục tiêu còn phải học.',
      href: '/authoring/crosswalk',
      cta: 'Mở đối chiếu & lỗ hổng',
    },
  ]

  return (
    <div className="space-y-3">
      {stages.map((s) => (
        <StageCard key={s.n} s={s} />
      ))}
    </div>
  )
}
