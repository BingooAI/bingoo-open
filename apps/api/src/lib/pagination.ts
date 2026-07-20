import { z } from 'zod'

/** Sane defaults + a hard cap so a client can't request an unbounded page. */
export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

/** Query-string schema for list endpoints. Coerces `?page=&limit=` to numbers. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
})

export type PaginationParams = z.infer<typeof paginationQuerySchema>

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Translate page/limit into Prisma-style `skip`/`take`. */
export function toSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.limit, take: params.limit }
}

/** Build the meta block returned alongside a paginated list. */
export function paginationMeta(params: PaginationParams, total: number): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  }
}
