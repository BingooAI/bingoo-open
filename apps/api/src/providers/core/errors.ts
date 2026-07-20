/**
 * Errors raised by the provider layer. Kept separate from HTTP `AppError` so the
 * provider code stays transport-agnostic; the API error middleware maps these to
 * status codes (not configured → 503, other provider failures → 502).
 */
export class ProviderError extends Error {
  readonly capability: string
  readonly provider: string
  override readonly cause?: unknown

  constructor(capability: string, provider: string, message: string, cause?: unknown) {
    super(`[${capability}:${provider}] ${message}`)
    this.name = 'ProviderError'
    this.capability = capability
    this.provider = provider
    this.cause = cause
  }
}

/** Thrown when a provider is selected/used but its required env vars are absent. */
export class ProviderNotConfiguredError extends ProviderError {
  readonly missing: readonly string[]

  constructor(capability: string, provider: string, missing: readonly string[]) {
    super(capability, provider, `not configured (missing env: ${missing.join(', ')})`)
    this.name = 'ProviderNotConfiguredError'
    this.missing = missing
  }
}
