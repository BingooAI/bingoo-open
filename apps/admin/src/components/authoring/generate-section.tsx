'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { Card, CardContent } from '@bingoo/ui-web';
import { cn } from '@/lib/cn';

/**
 * Khối "sinh mới" THU GỌN đặt trên danh sách.
 *
 * Vì sao thu gọn: xem/quản lý danh sách là việc THƯỜNG XUYÊN; sinh mới là việc THỈNH THOẢNG. Trước
 * đây form sinh chiếm trọn trang và đẩy danh sách xuống dưới — sai trọng tâm. Mặc định đóng, mở khi cần.
 */
export function GenerateSection({
  title,
  hint,
  children,
  defaultOpen = false,
}: {
  title: string;
  hint: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <div className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
          <Plus className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">{title}</div>
          <div className="truncate text-xs text-foreground-muted">{hint}</div>
        </div>
        <ChevronDown
          className={cn('size-5 text-foreground-muted transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? <CardContent className="border-t border-border pt-4">{children}</CardContent> : null}
    </Card>
  );
}
