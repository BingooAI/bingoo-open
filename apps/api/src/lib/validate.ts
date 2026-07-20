import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import type { ZodType } from 'zod'
import { AppError } from './errors'

/**
 * Wraps @hono/zod-validator so every validation failure becomes a uniform
 * AppError.validation (→ 400 { code: 'validation_error', details }). Handlers
 * read fully-typed, validated input via `c.req.valid(target)`.
 *
 * Usage: `app.post('/x', validate('json', BodySchema), (c) => { ... })`
 */
export function validate<T extends ZodType>(target: keyof ValidationTargets, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw AppError.validation(
        result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      )
    }
  })
}
