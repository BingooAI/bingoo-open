import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../lib/context';
import { AppError } from '../lib/errors';
import { ok } from '../lib/response';
import { validate } from '../lib/validate';
import { requireAuth, requireCommunityRole } from '../auth';
import { writeAudit } from '../repos/audit.repo';
import { isGuardianOf } from '../repos/children.repo';
import {
  banMember,
  createCommunity,
  guardianApprove,
  joinCommunity,
  leaveCommunity,
  listDiscoverable,
  listMembers,
  moderatorApprove,
} from '../repos/community.repo';

const CreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, 'slug: 3–40 chars a–z, 0–9, hyphen'),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private']).optional(),
  joinPolicy: z.enum(['open', 'request', 'invite']).optional(),
});

const MINOR_TIERS = new Set(['CHILD', 'TEEN']);

/**
 * Communities (§5.1) — discoverable social collectives, separate from orgs.
 * Adults join freely per policy; a minor joins as pending until their guardian
 * approves. Moderation (approve / ban) is community-scoped via requireCommunityRole.
 */
export const communities = new Hono<AppEnv>()
  .get('/', requireAuth, async (c) => ok(c, await listDiscoverable()))
  .post('/', requireAuth, validate('json', CreateSchema), async (c) => {
    const user = c.get('user');
    if (!user) throw AppError.unauthorized();
    // Minors don't create communities (R5, §5.1).
    if (MINOR_TIERS.has(user.accountType ?? '')) {
      throw AppError.forbidden('Minors cannot create communities');
    }
    const body = c.req.valid('json');
    const community = await createCommunity({ creatorId: user.id, ...body });
    await writeAudit({
      action: 'community.created',
      actorUserId: user.id,
      targetType: 'community',
      targetId: community.id,
    });
    return ok(c, community, 201);
  })
  .get('/:communityId/members', requireCommunityRole('owner', 'moderator', 'member'), async (c) =>
    ok(c, await listMembers(c.req.param('communityId'))),
  )
  .post('/:communityId/join', requireAuth, async (c) => {
    const user = c.get('user');
    if (!user) throw AppError.unauthorized();
    const communityId = c.req.param('communityId');
    const member = await joinCommunity(user.id, communityId);
    await writeAudit({
      action: 'community.join',
      actorUserId: user.id,
      targetType: 'community',
      targetId: communityId,
      metadata: { status: member.status },
    });
    return ok(c, member, 201);
  })
  .post(
    '/:communityId/members/:userId/approve',
    requireCommunityRole('owner', 'moderator'),
    async (c) => {
      const actor = c.get('user');
      const communityId = c.req.param('communityId');
      const targetUserId = c.req.param('userId');
      const member = await moderatorApprove(communityId, targetUserId);
      await writeAudit({
        action: 'community.approved',
        actorUserId: actor?.id ?? null,
        targetType: 'user',
        targetId: targetUserId,
        metadata: { communityId, status: member.status },
      });
      return ok(c, member);
    },
  )
  .post('/:communityId/members/:userId/guardian-approve', requireAuth, async (c) => {
    const actor = c.get('user');
    if (!actor) throw AppError.unauthorized();
    const communityId = c.req.param('communityId');
    const targetUserId = c.req.param('userId');
    // Only the minor's guardian may approve their community membership (R5).
    if (!(await isGuardianOf(actor.id, targetUserId))) throw AppError.forbidden();

    const member = await guardianApprove(communityId, targetUserId);
    await writeAudit({
      action: 'community.guardian_approved',
      actorUserId: actor.id,
      targetType: 'user',
      targetId: targetUserId,
      metadata: { communityId, status: member.status },
    });
    return ok(c, member);
  })
  .post(
    '/:communityId/members/:userId/ban',
    requireCommunityRole('owner', 'moderator'),
    async (c) => {
      const actor = c.get('user');
      const communityId = c.req.param('communityId');
      const targetUserId = c.req.param('userId');
      await banMember(communityId, targetUserId);
      await writeAudit({
        action: 'community.banned',
        actorUserId: actor?.id ?? null,
        targetType: 'user',
        targetId: targetUserId,
        metadata: { communityId },
      });
      return ok(c, { ok: true });
    },
  )
  .post('/:communityId/leave', requireAuth, async (c) => {
    const user = c.get('user');
    if (!user) throw AppError.unauthorized();
    await leaveCommunity(user.id, c.req.param('communityId'));
    return ok(c, { ok: true });
  });
