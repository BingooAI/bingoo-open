// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
/**
 * Service tokens for machine/AI consumers of the media library (docs §7). The
 * RAG/generation layer authenticates with an `X-Service-Token` header instead of
 * a user session; the token maps to a SERVICE subject key, and access is granted
 * by MediaGrant rows with subjectType=SERVICE, subjectId=<label>.
 *
 * Tokens are configured server-side (R1 — never shipped to a client):
 *   MEDIA_SERVICE_TOKENS="s3cr3t-token:ai-rag,other-token:importer"
 * Returns the label (the grant subjectId), or null when the token is unknown.
 */
export function resolveServiceToken(token: string | null | undefined): string | null {
  if (!token) return null
  const raw = process.env.MEDIA_SERVICE_TOKENS
  if (!raw) return null
  for (const pair of raw.split(',')) {
    const idx = pair.indexOf(':')
    if (idx <= 0) continue
    const t = pair.slice(0, idx).trim()
    const label = pair.slice(idx + 1).trim()
    if (t && label && t === token) return label
  }
  return null
}
