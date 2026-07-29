// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * endpoints.ts — where the Studio's server calls go.
 *
 * These URLs were hardcoded in three separate components ("/api/tts", "/api/image")
 * — routes from the standalone studio that DO NOT EXIST in bingoo, whose API lives
 * under /api/explainer/*. So "Tạo giọng" 404'd, and nobody noticed because each
 * component failed on its own. One place to name them, so the next move breaks
 * loudly and in exactly one file.
 */
export const EXPLAINER_API = {
  tts: '/api/explainer/tts',
  audioFind: '/api/explainer/audio/find',
  image: '/api/explainer/image/resolve',
  imagesSearch: '/api/explainer/images/search',
  imagesFind: '/api/explainer/images/find',
  llm: '/api/explainer/llm',
  translate: '/api/explainer/translate',
  localize: '/api/explainer/localize',
} as const

/**
 * The API wraps every success as `{ data: … }`. The Studio read the payload from
 * the OUTER object (`json.audioUrl`), which is always undefined — so "Tạo giọng"
 * ran, the server produced audio, and the editor stored nothing. It looked like
 * TTS was broken; it was the envelope.
 */
export async function apiPost<T>(url: string, body: unknown, opts?: { timeoutMs?: number }): Promise<T> {
  // A hung LLM call (translate/generate) used to leave the UI stuck on a spinner
  // forever. Abort after a timeout so the caller can SHOW the failure.
  const ctrl = new AbortController()
  const timer = opts?.timeoutMs ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : undefined
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError')
      throw new Error(`Hết thời gian chờ (${Math.round((opts!.timeoutMs ?? 0) / 1000)}s)`, { cause: e })
    throw e
  } finally {
    if (timer) clearTimeout(timer)
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T
    error?: { message?: string }
  } | null
  if (!res.ok) throw new Error(json?.error?.message ?? `${res.status} ${res.statusText}`)
  if (!json || json.data === undefined) throw new Error('API trả về rỗng')
  return json.data
}
