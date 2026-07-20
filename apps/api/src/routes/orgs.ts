import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '@bingoo/db';
import type { AppEnv } from '../lib/context';
import { AppError } from '../lib/errors';
import { ok, paginated } from '../lib/response';
import { validate } from '../lib/validate';
import { paginationMeta, paginationQuerySchema, toSkipTake } from '../lib/pagination';
import { requireAuth, requireOrgAccess } from '../auth';
import { queryAudit, writeAudit } from '../repos/audit.repo';
import {
  addOrgMember,
  createOrg,
  createTeam,
  getOrg,
  getOrgTree,
  listOrgMembers,
  listTeams,
  resolveOrgRole,
  setInheritAdmin,
  subtreeOrgIds,
} from '../repos/org.repo';

const CreateOrgSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(['GROUP', 'COMPANY', 'SCHOOL', 'CENTER']).optional(),
  parentId: z.string().optional(),
});

const AddMemberSchema = z
  .object({
    publicId: z.string().optional(),
    userId: z.string().optional(),
    role: z.enum(['owner', 'admin', 'member']),
  })
  .refine((b) => Boolean(b.publicId) || Boolean(b.userId), 'provide publicId or userId');

const InheritSchema = z.object({ inheritAdmin: z.boolean() });

const CreateTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentTeamId: z.string().optional(),
});

/**
 * Organization hierarchy, delegation, nested teams and scoped audit (§5, §6).
 * Access is explicit + opt-in-inherited via requireOrgAccess; a plain org role
 * never becomes a platform role, and delegation is deliberate + audited.
 */
export const orgs = new Hono<AppEnv>()
  .post('/', requireAuth, validate('json', CreateOrgSchema), async (c) => {
    const user = c.get('user');
    if (!user) throw AppError.unauthorized();
    const body = c.req.valid('json');

    // A sub-org may be created only by an admin/owner of its parent (§6).
    if (body.parentId) {
      const role = await resolveOrgRole(user.id, body.parentId);
      if (role !== 'owner' && role !== 'admin') {
        throw AppError.forbidden('Not an admin of the parent organization');
      }
    }

    const org = await createOrg({
      creatorId: user.id,
      name: body.name,
      type: body.type ?? null,
      parentId: body.parentId ?? null,
    });
    await writeAudit({
      action: 'org.created',
      actorUserId: user.id,
      organizationId: org.id,
      targetType: 'organization',
      targetId: org.id,
      metadata: { parentId: body.parentId ?? null, type: org.type },
    });
    return ok(c, org, 201);
  })
  .get('/:orgId', requireOrgAccess('owner', 'admin', 'member'), async (c) => {
    const org = await getOrg(c.req.param('orgId'));
    if (!org) throw AppError.notFound();
    return ok(c, org);
  })
  .get('/:orgId/tree', requireOrgAccess('owner', 'admin'), async (c) =>
    ok(c, await getOrgTree(c.req.param('orgId'))),
  )
  .get('/:orgId/members', requireOrgAccess('owner', 'admin', 'member'), async (c) =>
    ok(c, await listOrgMembers(c.req.param('orgId'))),
  )
  .post(
    '/:orgId/members',
    requireOrgAccess('owner', 'admin'),
    validate('json', AddMemberSchema),
    async (c) => {
      const actor = c.get('user');
      if (!actor) throw AppError.unauthorized();
      const orgId = c.req.param('orgId');
      const body = c.req.valid('json');

      // Only an owner may appoint another owner — an admin can't self-escalate (§6).
      if (body.role === 'owner' && (await resolveOrgRole(actor.id, orgId)) !== 'owner') {
        throw AppError.forbidden('Only an owner can appoint an owner');
      }

      const target = await db.user.findFirst({
        where: body.publicId ? { publicId: body.publicId } : { id: body.userId },
        select: { id: true },
      });
      if (!target) throw AppError.notFound('User not found');

      await addOrgMember(orgId, target.id, body.role);
      await writeAudit({
        action: 'org.delegated',
        actorUserId: actor.id,
        organizationId: orgId,
        targetType: 'user',
        targetId: target.id,
        metadata: { role: body.role },
      });
      return ok(c, { organizationId: orgId, userId: target.id, role: body.role }, 201);
    },
  )
  .patch(
    '/:orgId/inherit-admin',
    requireOrgAccess('owner'),
    validate('json', InheritSchema),
    async (c) => {
      const actor = c.get('user');
      if (!actor) throw AppError.unauthorized();
      const orgId = c.req.param('orgId');
      const { inheritAdmin } = c.req.valid('json');

      const result = await setInheritAdmin(orgId, inheritAdmin);
      await writeAudit({
        action: 'org.inherit_admin_changed',
        actorUserId: actor.id,
        organizationId: orgId,
        targetType: 'organization',
        targetId: orgId,
        metadata: { inheritAdmin },
      });
      return ok(c, result);
    },
  )
  .post(
    '/:orgId/teams',
    requireOrgAccess('owner', 'admin'),
    validate('json', CreateTeamSchema),
    async (c) => {
      const actor = c.get('user');
      if (!actor) throw AppError.unauthorized();
      const orgId = c.req.param('orgId');
      const body = c.req.valid('json');

      if (body.parentTeamId) {
        const parent = await db.team.findUnique({
          where: { id: body.parentTeamId },
          select: { organizationId: true },
        });
        if (!parent || parent.organizationId !== orgId) {
          throw AppError.badRequest('Parent team is not in this organization');
        }
      }

      const team = await createTeam(orgId, body.name, body.parentTeamId ?? null);
      await writeAudit({
        action: 'team.created',
        actorUserId: actor.id,
        organizationId: orgId,
        targetType: 'team',
        targetId: team.id,
      });
      return ok(c, team, 201);
    },
  )
  .get('/:orgId/teams', requireOrgAccess('owner', 'admin', 'member'), async (c) =>
    ok(c, await listTeams(c.req.param('orgId'))),
  )
  .get(
    '/:orgId/audit',
    requireOrgAccess('owner', 'admin'),
    validate('query', paginationQuerySchema),
    async (c) => {
      const orgId = c.req.param('orgId');
      const params = c.req.valid('query');
      const organizationIds = await subtreeOrgIds(orgId);
      const { skip, take } = toSkipTake(params);
      const { items, total } = await queryAudit({ organizationIds }, skip, take);
      return paginated(c, items, paginationMeta(params, total));
    },
  );
