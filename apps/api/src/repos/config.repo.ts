import { db } from '@bingoo/db';
import type { Prisma } from '@bingoo/db';
import { DEFAULT_CONSENT_CONFIG, type ConsentAgeConfig } from '@bingoo/core';
import { getCache } from '../providers';

/**
 * Server-controlled runtime config (§R6): a generic key → JSON store, read
 * through a short-lived cache and always backed by an in-code fallback. Changing
 * a value takes effect without a release. Reused beyond age-of-consent for
 * future feature flags, seasonal themes and entitlements.
 *
 * The cache (getCache → Redis) is best-effort: if it's unavailable we read
 * straight from the DB, so config keeps working without Redis in dev.
 */

const CONFIG_TTL_SECONDS = 60;
const cacheKey = (key: string) => `config:${key}`;

export async function getRemoteConfig<T>(key: string, fallback: T): Promise<T> {
  try {
    const cached = await getCache().getJson<T>(cacheKey(key));
    if (cached !== null) return cached;
  } catch {
    // cache unavailable — read through to the database
  }

  const row = await db.remoteConfig.findUnique({ where: { key } });
  const value = row ? (row.value as unknown as T) : fallback;

  try {
    await getCache().setJson(cacheKey(key), value, CONFIG_TTL_SECONDS);
  } catch {
    // caching is optional
  }
  return value;
}

export async function setRemoteConfig(
  key: string,
  value: Prisma.InputJsonValue,
  updatedBy?: string | null,
): Promise<void> {
  await db.remoteConfig.upsert({
    where: { key },
    create: { key, value, updatedBy: updatedBy ?? null },
    update: { value, updatedBy: updatedBy ?? null },
  });
  try {
    await getCache().delete(cacheKey(key));
  } catch {
    // cache eviction is best-effort; the TTL will refresh it otherwise
  }
}

/** Remove a runtime override so the in-code fallback applies again. */
export async function deleteRemoteConfig(key: string): Promise<void> {
  await db.remoteConfig.deleteMany({ where: { key } });
  try {
    await getCache().delete(cacheKey(key));
  } catch {
    // cache eviction is best-effort
  }
}

/** True when a runtime override row exists for `key` (reads through the DB). */
export async function hasRemoteConfig(key: string): Promise<boolean> {
  return (await db.remoteConfig.findUnique({ where: { key }, select: { key: true } })) !== null;
}

/** Config key holding the age-of-consent table (§3.7). */
export const CONSENT_CONFIG_KEY = 'age_of_consent';

/** The active age-of-consent thresholds — remote config with in-code fallback. */
export function resolveConsentConfig(): Promise<ConsentAgeConfig> {
  return getRemoteConfig<ConsentAgeConfig>(CONSENT_CONFIG_KEY, DEFAULT_CONSENT_CONFIG);
}
