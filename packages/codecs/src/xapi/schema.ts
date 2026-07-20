// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0

import { z } from 'zod'

/**
 * The xAPI statement, as ADL specifies it.
 *
 * **This lives here, not in `contracts`.** An earlier draft put it in the shared contract, which
 * was wrong for the same reason CASE's `CFItem` is not in there: a standard's wire format is
 * the codec's business. Only this package speaks xAPI, so only this package should have to
 * change when ADL publishes an erratum.
 *
 * What crosses the family boundary is an `Observation` — our own evidence shape. Statements are
 * translated at the edge, in `statements.ts`.
 *
 * Held loosely on purpose. xAPI's whole design premise is extension, and a school's existing
 * LRS will send profiles nobody here has seen. Rejecting them would make "works with your LRS"
 * false, so unknown properties pass through untouched.
 */

export const xapiAgent = z
  .object({
    objectType: z.literal('Agent').optional(),
    name: z.string().max(256).optional(),
    mbox: z.string().max(256).optional(),
    account: z.object({ homePage: z.string().max(2048), name: z.string().max(256) }).optional(),
  })
  .loose()
export type XapiAgent = z.infer<typeof xapiAgent>

export const xapiStatement = z
  .object({
    id: z.string().max(128).optional(),
    actor: xapiAgent,
    verb: z.object({
      id: z.string().min(1).max(2048),
      display: z.record(z.string(), z.string()).optional(),
    }),
    object: z
      .object({
        id: z.string().min(1).max(2048),
        objectType: z.string().max(64).optional(),
        definition: z.record(z.string(), z.unknown()).optional(),
      })
      .loose(),
    result: z
      .object({
        success: z.boolean().optional(),
        completion: z.boolean().optional(),
        score: z
          .object({
            raw: z.number().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            /** The only score field that is comparable across items without their scale. */
            scaled: z.number().min(-1).max(1).optional(),
          })
          .optional(),
        /** ISO-8601 duration, e.g. `PT42S`. Response latency is signal, not noise. */
        duration: z.string().max(64).optional(),
        response: z.string().max(10_000).optional(),
      })
      .loose()
      .optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string().max(64).optional(),
  })
  .loose()
export type XapiStatement = z.infer<typeof xapiStatement>
