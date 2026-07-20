import { ProviderNotConfiguredError } from './errors';

/** Read an env var, treating empty/whitespace as absent. */
export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value : undefined;
}

/** True only if every named env var is present — used for readiness introspection. */
export function hasEnv(names: readonly string[]): boolean {
  return names.every((name) => readEnv(name) !== undefined);
}

/**
 * Collect the required env vars for a provider, or throw ProviderNotConfigured
 * listing exactly which are missing. Adapters call this in their factory so a
 * missing key surfaces as a clean 503 rather than a vendor SDK crash.
 */
export function requireEnv<const N extends readonly string[]>(
  capability: string,
  provider: string,
  names: N,
): Record<N[number], string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = readEnv(name);
    if (value === undefined) missing.push(name);
    else out[name] = value;
  }
  if (missing.length > 0) throw new ProviderNotConfiguredError(capability, provider, missing);
  // Known-key record: accessing a listed name yields `string`, not `string | undefined`.
  return out as Record<N[number], string>;
}
