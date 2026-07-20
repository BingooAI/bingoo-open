import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * A single PrismaClient for the whole process. Cached on globalThis so a
 * hot-reloading dev server (tsx watch) doesn't leak a new connection pool on
 * every reload. SERVER-ONLY — never import this from a client bundle (R1).
 *
 * Prisma 7 connects through a driver adapter; the pg pool is lazy, so
 * constructing this without a reachable DATABASE_URL does NOT throw — the error
 * surfaces on the first query (handled as 503 by the API error middleware).
 */
const globalForPrisma = globalThis as unknown as { __bingooDb__?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
  });
}

export const db: PrismaClient = globalForPrisma.__bingooDb__ ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__bingooDb__ = db;
}
