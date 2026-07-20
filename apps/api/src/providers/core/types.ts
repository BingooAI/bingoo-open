/** Readiness snapshot for a single registered provider (from `/health/providers`). */
export interface ProviderStatus {
  capability: string;
  provider: string;
  /** All required env vars present (does not verify credentials are valid). */
  configured: boolean;
  /** Whether this is the provider currently selected by config for the capability. */
  active: boolean;
}
