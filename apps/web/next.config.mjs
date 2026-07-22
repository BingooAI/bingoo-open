// SPDX-FileCopyrightText: 2026 Bingoo.ai
// SPDX-License-Identifier: Apache-2.0
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** @type {import('next').NextConfig} */

/**
 * Dev and production builds get separate output directories.
 *
 * They shared `.next` by default, and the failure that causes is confusing out of all
 * proportion to its cause: run `pnpm build` while `pnpm dev` is up — or start dev after a
 * build — and the running server reads chunks from the other mode. It reports
 * `Cannot find module './vendor-chunks/…'` or `__webpack_modules__[moduleId] is not a
 * function`, neither of which points at the real problem.
 *
 * Splitting the directories removes the interaction rather than documenting it.
 */
const distDir = process.env.NODE_ENV === 'development' ? '.next-dev' : '.next'

const nextConfig = {
  distDir,
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@bingoo.ai/tokens',
    '@bingoo.ai/core',
    '@bingoo.ai/i18n',
    '@bingoo.ai/learning-experience',
    '@bingoo.ai/experiences',
    '@bingoo.ai/ui-web',
    '@bingoo.ai/explainer',
    '@bingoo.ai/manipulatives',
    '@bingoo.ai/explainer-web',
  ],
  // Lint is a dedicated gate (`pnpm lint`) + enforced on commit; keep builds fast.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Proxy Better Auth through this origin so the session cookie is same-origin
  // (bingoo.ai, not api.bingoo.ai) — letting the Next server read + validate the
  // session for server-side route gating. The API stays the real AAA boundary.
  async rewrites() {
    return [{ source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` }]
  },
}

export default withNextIntl(nextConfig)
