import type { ApiErrorBody, PageMeta } from './api-types'

/**
 * Browser-side API client for the Bingoo backend.
 *
 * All calls are SAME-ORIGIN to `/api/*`, which Next proxies to the API server
 * (see next.config `rewrites`) with the session cookie forwarded — no CORS, no
 * token juggling. The API is the real AAA/RBAC boundary; this client just speaks
 * its envelope ({ data }, { data, meta }, { error }) and surfaces typed errors.
 *
 * Never put secrets here (R1). Uploads go direct-to-storage via presigned URLs
 * the API mints — see `uploadToSignedUrl`, which bypasses this base path.
 */
const BASE = '/api'

/** A structured failure from the API (or the network). `status` is the HTTP code
 *  (0 = network/abort). `code` is the API's machine code for i18n mapping. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly requestId?: string
  readonly details?: unknown

  constructor(args: {
    status: number
    code: string
    message: string
    requestId?: string
    details?: unknown
  }) {
    super(args.message)
    this.name = 'ApiError'
    this.status = args.status
    this.code = args.code
    this.requestId = args.requestId
    this.details = args.details
  }

  /** True when the failure is an auth/permission wall (drives re-login / 403 UI). */
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403
  }
}

type Query = Record<string, string | number | boolean | undefined | null | string[]>

interface RequestOptions {
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(key, String(v))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
  }
  return url.pathname + url.search
}

/**
 * Validation/domain errors carry the human-meaningful text in `details[].message`
 * (Zod issues, gate failures, coverage complaints…); the envelope `message` is only
 * a generic title like "Validation failed". Surface the detail so a toast says WHY it
 * failed, not just THAT it did. One place fixes every consumer that shows `err.message`.
 */
function detailMessage(details: unknown): string | undefined {
  if (!Array.isArray(details)) return undefined
  const msgs = details
    .map((d) =>
      d && typeof d === 'object' && 'message' in d ? String((d as { message: unknown }).message ?? '') : '',
    )
    .map((s) => s.trim())
    .filter(Boolean)
  return msgs.length ? msgs.join(' ') : undefined
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'unknown'
  let message = res.statusText || 'Request failed'
  let requestId: string | undefined
  let details: unknown
  try {
    const body = (await res.json()) as ApiErrorBody
    if (body?.error) {
      code = body.error.code ?? code
      message = body.error.message ?? message
      requestId = body.error.requestId
      details = body.error.details
    }
  } catch {
    // non-JSON error body (proxy/HTML) — keep the status text.
  }
  // Prefer the specific detail message(s) over the generic envelope title.
  return new ApiError({
    status: res.status,
    code,
    message: detailMessage(details) ?? message,
    requestId,
    details,
  })
}

async function raw<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<{ data: T; meta?: PageMeta }> {
  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      credentials: 'include',
      signal: opts.signal,
      headers: opts.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError({ status: 0, code: 'network', message: 'Network error' })
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return { data: undefined as T }
  const json = (await res.json()) as { data: T; meta?: PageMeta }
  return { data: json.data, meta: json.meta }
}

/** JSON API surface. `*` variants return the unwrapped `data`; `list` keeps meta. */
export const api = {
  get: <T>(path: string, opts?: RequestOptions) => raw<T>('GET', path, opts).then((r) => r.data),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    raw<T>('POST', path, { ...opts, body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    raw<T>('PUT', path, { ...opts, body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    raw<T>('PATCH', path, { ...opts, body }).then((r) => r.data),
  del: <T>(path: string, opts?: RequestOptions) => raw<T>('DELETE', path, opts).then((r) => r.data),
  /** Paginated GET — returns both the rows and the page meta. */
  list: <T>(path: string, opts?: RequestOptions) =>
    raw<T[]>('GET', path, opts).then((r) => ({
      data: r.data,
      meta: r.meta ?? { page: 1, limit: r.data.length, total: r.data.length, totalPages: 1 },
    })),
}

/**
 * Upload bytes directly to storage using a presigned URL the API minted.
 * Cross-origin PUT (to R2), NOT through the `/api` proxy, and it carries no
 * cookie — the presigned signature is the authorization. Reports progress via
 * XHR so the UI can show a real bar; falls back to no-progress on abort.
 */
export function uploadToSignedUrl(
  url: string,
  file: Blob,
  opts: {
    contentType?: string
    signal?: AbortSignal
    onProgress?: (fraction: number) => void
  } = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    if (opts.contentType) xhr.setRequestHeader('content-type', opts.contentType)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && opts.onProgress) opts.onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else
        reject(
          new ApiError({
            status: xhr.status,
            code: 'upload_failed',
            message: `Upload failed (${xhr.status})`,
          }),
        )
    }
    xhr.onerror = () =>
      reject(new ApiError({ status: 0, code: 'upload_network', message: 'Upload network error' }))
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'))
    if (opts.signal) {
      if (opts.signal.aborted) {
        xhr.abort()
        return
      }
      opts.signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file)
  })
}
