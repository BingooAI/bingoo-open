import { db } from '@bingoo/db'
import { writeAudit } from './audit.repo'
import { getRemoteConfig } from './config.repo'

/** Remote-config key for the max concurrent devices (0 / unset = unlimited). */
export const MAX_DEVICES_KEY = 'max_devices'

/**
 * Enforce a max number of concurrent devices per user (§ session policy). After a
 * new login, if the user has more than `max_devices` active sessions, revoke the
 * OLDEST ones (keeping the newest `max`, which includes this fresh login). The
 * limit is server-controlled via remote config; best-effort + audited.
 */
export async function enforceDeviceLimit(userId: string): Promise<void> {
  const max = await getRemoteConfig<number>(MAX_DEVICES_KEY, 0)
  if (!max || max <= 0) return

  const sessions = await db.session.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })
  if (sessions.length <= max) return

  const revoke = sessions.slice(max).map((s) => s.id)
  await db.session.deleteMany({ where: { id: { in: revoke } } })
  await writeAudit({
    action: 'session.device_limit_revoked',
    actorUserId: userId,
    targetType: 'user',
    targetId: userId,
    metadata: { revoked: revoke.length, max },
  })
}
