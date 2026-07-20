import { db } from '@bingoo/db';
import type { Prisma } from '@bingoo/db';

/**
 * A sensitive event to record in the audit trail (§7): auth (login/logout/reset),
 * role/status changes, org membership, guardianship/consent, class enrollment…
 */
export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  organizationId?: string | null;
  classId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/**
 * Append an audit record. Best-effort by design (§7): auditing must NEVER break
 * the primary flow, so a write failure is logged and swallowed, not thrown.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        actorUserId: entry.actorUserId ?? null,
        organizationId: entry.organizationId ?? null,
        classId: entry.classId ?? null,
        targetType: entry.targetType ?? null,
        targetId: entry.targetId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        ...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
      },
    });
  } catch (err) {
    console.error(
      `[audit] failed to record "${entry.action}":`,
      err instanceof Error ? err.message : err,
    );
  }
}

/** Filters for an audit lookup (§7). `organizationIds` scopes to an org subtree. */
export interface AuditQuery {
  action?: string;
  actorUserId?: string;
  organizationIds?: string[];
  from?: Date;
  to?: Date;
}

/** Query the audit trail, newest first, with a total for pagination. */
export async function queryAudit(
  filter: AuditQuery,
  skip: number,
  take: number,
): Promise<{ items: unknown[]; total: number }> {
  const createdAt: Prisma.DateTimeFilter = {};
  if (filter.from) createdAt.gte = filter.from;
  if (filter.to) createdAt.lte = filter.to;

  const where: Prisma.AuditLogWhereInput = {
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.actorUserId ? { actorUserId: filter.actorUserId } : {}),
    ...(filter.organizationIds ? { organizationId: { in: filter.organizationIds } } : {}),
    ...(filter.from || filter.to ? { createdAt } : {}),
  };

  const [items, total] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    db.auditLog.count({ where }),
  ]);
  return { items, total };
}
