import { db } from '@bingoo.ai/db'

/**
 * Lightweight DB connectivity probe. Uses a raw `SELECT 1` so it needs no domain
 * tables. Returns false (never throws) when the database is unreachable, so the
 * readiness endpoint can report "down" instead of surfacing a 500.
 */
export async function pingDatabase(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
