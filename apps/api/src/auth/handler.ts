// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { auth } from './auth'

/** Auth bodies are tiny (credentials); cap to avoid unbounded buffering here,
 *  since the global bodyLimit middleware deliberately doesn't run on this route. */
const MAX_BODY_BYTES = 1024 * 1024

const tooLarge = () =>
  new Response(JSON.stringify({ error: { code: 'payload_too_large' } }), {
    status: 413,
    headers: { 'content-type': 'application/json' },
  })

/**
 * Hono handler for /api/auth/* → Better Auth. It rebuilds a standard web Request
 * from a buffered body before delegating: Better Auth clones the request
 * internally (it wraps sign-up/in in a DB transaction), and @hono/node-server's
 * Request throws `TypeError: unusable` when cloned. A fresh undici Request clones
 * cleanly. GET/HEAD carry no body, so they pass through untouched.
 */
export async function authHandler(raw: Request): Promise<Response> {
  if (raw.method === 'GET' || raw.method === 'HEAD') return auth.handler(raw)

  if (Number(raw.headers.get('content-length') ?? '0') > MAX_BODY_BYTES) return tooLarge()
  const body = await raw.arrayBuffer()
  if (body.byteLength > MAX_BODY_BYTES) return tooLarge()

  const request = new Request(raw.url, {
    method: raw.method,
    headers: raw.headers,
    body,
  })
  return auth.handler(request)
}
