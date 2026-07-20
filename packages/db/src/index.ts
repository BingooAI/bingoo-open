/**
 * @bingoo/db — server-only data access (Prisma). NEVER import from web / mobile
 * or any client bundle: it carries DB credentials and the query engine (R1, R2).
 * Domain repositories live in the consuming server app (apps/api → repos).
 */
export { db } from './client';
// Re-export the generated client surface: PrismaClient, the `Prisma` namespace
// (error classes, input types), enums and model types.
export * from '../generated/prisma/client';
