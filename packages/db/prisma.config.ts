// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer auto-loads .env. Load it here so CLI commands (migrate,
// studio, db push) can read DATABASE_URL locally; ignore when there is no .env
// file (e.g. CI/production, where the variable is injected into the environment).
try {
  process.loadEnvFile()
} catch {
  // no local .env — rely on the ambient environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Used only by Migrate/introspection CLI commands. The runtime PrismaClient
  // connects through the pg driver adapter (see src/client.ts), not this url.
  // Prefer the direct (unpooled) endpoint for migrations: on Neon, Migrate needs
  // a real session (advisory locks) that the PgBouncer pooler can't provide.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    // Shadow DB: nơi Migrate dựng lại lịch sử migration để so với schema. BẮT BUỘC phải là một CSDL
    // RIÊNG (Neon: một database khác trong cùng project) — Migrate XOÁ SẠCH nó mỗi lần chạy.
    // Không có nó thì không sinh được migration, và người ta lại rơi vào `db push` — tức là sửa
    // thẳng CSDL thật mà không để lại một dòng lịch sử nào.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
