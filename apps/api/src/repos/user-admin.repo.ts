// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Đọc danh sách/chi tiết người dùng cho màn quản trị.
 *
 * Chọn trường bằng danh sách TƯỜNG MINH, không `select` cả bảng và cũng không trả nguyên bản
 * ghi. `User` chứa cả ngày sinh, quốc gia, giới tính, và với tài khoản trẻ thì email là địa
 * chỉ nội bộ suy ra từ `publicId`. Một `findMany` không giới hạn trường sẽ đẩy hết những thứ
 * đó ra client, và không ai nhận ra cho tới khi có người xem tab Network.
 *
 * Nói cách khác: danh sách dưới đây là quyết định về quyền riêng tư, không phải chuyện tối ưu
 * truy vấn. Thêm trường vào đây là mở rộng thứ màn quản trị nhìn thấy được.
 */

import { db } from '@bingoo.ai/db'

export interface AdminUserRow {
  readonly id: string
  readonly publicId: string
  readonly name: string
  readonly email: string | null
  readonly image: string | null
  readonly role: string
  readonly status: string
  readonly accountType: string
  readonly banned: boolean
  readonly createdAt: Date
}

export interface AdminUserDetail extends AdminUserRow {
  readonly locale: string | null
  readonly managedByGuardian: boolean
  readonly updatedAt: Date
  /** Số khái niệm đã có ít nhất một quan sát — thước nhanh cho biết có dữ liệu để đọc không. */
  readonly trackedSkills: number
}

const ROW_SELECT = {
  id: true,
  publicId: true,
  name: true,
  email: true,
  image: true,
  role: true,
  status: true,
  accountType: true,
  banned: true,
  createdAt: true,
} as const

export interface ListUsersArgs {
  readonly skip: number
  readonly take: number
  readonly q?: string
  readonly role?: string
  readonly accountType?: string
}

export async function listUsers(args: ListUsersArgs): Promise<{ items: AdminUserRow[]; total: number }> {
  const q = args.q?.trim()
  const where = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
            { publicId: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(args.role ? { role: { contains: args.role } } : {}),
    ...(args.accountType ? { accountType: args.accountType as never } : {}),
  }

  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      select: ROW_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: args.skip,
      take: args.take,
    }),
    db.user.count({ where }),
  ])

  return {
    items: rows.map((r) => ({ ...r, banned: r.banned ?? false })),
    total,
  }
}

export async function getUserDetail(id: string): Promise<AdminUserDetail | null> {
  const row = await db.user.findUnique({
    where: { id },
    select: { ...ROW_SELECT, locale: true, managedByGuardian: true, updatedAt: true },
  })
  if (!row) return null

  const trackedSkills = await db.skillState.count({ where: { userId: id } })
  return { ...row, banned: row.banned ?? false, trackedSkills }
}

export interface FrameworkOption {
  readonly slug: string
  readonly name: unknown
}

/** Khung có ít nhất một objective — khung rỗng thì báo cáo lỗ hổng không nói được gì. */
export async function listReportableFrameworks(): Promise<FrameworkOption[]> {
  const rows = await db.framework.findMany({
    where: { objectives: { some: { kind: 'OBJECTIVE' } } },
    select: { slug: true, name: true },
    orderBy: { slug: 'asc' },
  })
  return rows
}
