// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { useQuery } from '@tanstack/react-query'
import { api } from './api-client'
import type { PageMeta } from './api-types'

/**
 * Quản lý người dùng + đọc lỗ hổng theo khung.
 *
 * DTO viết tay mirror `apps/api/src/routes/admin.ts`. Biên phân quyền thật nằm ở API
 * (`requireRole('ADMIN')`); phía này chỉ nói đúng giao thức, không phải hàng rào.
 */

export interface AdminUserRowDto {
  id: string
  publicId: string
  name: string
  email: string | null
  image: string | null
  role: string
  status: string
  accountType: string
  banned: boolean
  createdAt: string
}

export interface AdminUserDetailDto extends AdminUserRowDto {
  locale: string | null
  managedByGuardian: boolean
  updatedAt: string
  trackedSkills: number
}

/** Chỉ có khi mục tiêu được phép mang điểm — xem ADR 0007. */
export interface IntervalDto {
  lo: number
  hi: number
}

export interface ConceptGapDto {
  slug: string
  title: Record<string, string>
  kind: string
  required: boolean
  mastery: number
  observations: number
  met: boolean
}

export type GapRuleDto = 'weakest-required' | 'weighted-average' | 'direct' | 'no-evidence'

/** Vì sao ra con số đó — engine phơi ra chính các mảnh nó đã dùng, không suy luận thêm. */
export interface GapExplanationDto {
  rule: GapRuleDto
  binding: string | null
  cut: number
  observations: number
  requiredCount: number
  conceptCount: number
}

export interface ObjectiveGapDto {
  slug: string
  title: Record<string, string>
  stage: string | null
  strand: string | null
  status: 'achieved' | 'partial' | 'none'
  reason: 'not-yet' | 'no-evidence' | null
  reportMode: 'score' | 'evidence-only'
  mastery: number | null
  interval: IntervalDto | null
  explanation: GapExplanationDto
  coverage: number
  met: string[]
  notYet: string[]
  unevidenced: string[]
  concepts: ConceptGapDto[]
}

export interface GapReportDto {
  objectives: ObjectiveGapDto[]
  summary: {
    total: number
    achieved: number
    partial: number
    none: number
    awaitingEvidence: number
  }
}

export interface FrameworkOptionDto {
  slug: string
  name: Record<string, string>
}

export const userKeys = {
  all: ['admin', 'users'] as const,
  list: (q: string, page: number) => ['admin', 'users', 'list', q, page] as const,
  detail: (id: string) => ['admin', 'users', id] as const,
  gap: (id: string, framework: string, stage: string | null) =>
    ['admin', 'users', id, 'gap', framework, stage] as const,
  frameworks: () => ['admin', 'users', 'gap-frameworks'] as const,
  stages: (slug: string) => ['admin', 'frameworks', slug, 'stages'] as const,
}

export function useAdminUsers(q: string, page: number, limit = 20) {
  return useQuery({
    queryKey: userKeys.list(q, page),
    queryFn: () =>
      api.list<AdminUserRowDto>('/admin/users', {
        query: { ...(q ? { q } : {}), page, limit },
      }),
  })
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: userKeys.detail(id),
    queryFn: () => api.get<AdminUserDetailDto>(`/admin/users/${id}`),
    enabled: !!id,
  })
}

export function useReportableFrameworks(userId: string) {
  return useQuery({
    queryKey: userKeys.frameworks(),
    queryFn: () => api.get<FrameworkOptionDto[]>(`/admin/users/${userId}/gap/frameworks`),
    enabled: !!userId,
  })
}

export function useFrameworkStages(slug: string | null) {
  return useQuery({
    queryKey: userKeys.stages(slug ?? ''),
    queryFn: () => api.get<string[]>(`/admin/frameworks/${slug}/stages`),
    enabled: !!slug,
  })
}

export function useLearnerGap(userId: string, framework: string | null, stage: string | null) {
  return useQuery({
    queryKey: userKeys.gap(userId, framework ?? '', stage),
    queryFn: () =>
      api.get<GapReportDto>(`/admin/users/${userId}/gap`, {
        query: { framework: framework as string, ...(stage ? { stage } : {}) },
      }),
    enabled: !!userId && !!framework,
  })
}

export type { PageMeta }
