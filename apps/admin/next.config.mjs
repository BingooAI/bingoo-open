import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@bingoo/tokens',
    '@bingoo/core',
    '@bingoo/i18n',
    '@bingoo/ui-web',
    '@bingoo/explainer',
    '@bingoo/manipulatives',
    '@bingoo/explainer-web',
  ],
  // Lint is a dedicated gate (`pnpm lint`) + enforced on commit; keep builds fast.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  // Proxy the API through THIS origin so:
  //  1. the Better Auth session cookie is same-origin (admin.bingoo.ai) — the
  //     Next server can read + validate it for server-side route gating, and
  //  2. browser data calls to `/api/media|prompts/*` are same-origin (no CORS),
  //     with the cookie forwarded to the API. The API stays the real AAA/RBAC
  //     boundary — it re-checks every request. Uploads go direct-to-storage via
  //     presigned URLs the API mints (those bypass this proxy by design).
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` },
      { source: '/api/media/:path*', destination: `${API_URL}/media/:path*` },
      { source: '/api/prompts/:path*', destination: `${API_URL}/prompts/:path*` },
      { source: '/api/authoring/:path*', destination: `${API_URL}/authoring/:path*` },
      // Without this, /api/explainer/* fell through to Next's own router and
      // came back as a plain 404 "Not Found" — which the import page faithfully
      // reported per-image, so it LOOKED like "the media library has nothing".
      // It had never reached the library at all.
      { source: '/api/explainer/:path*', destination: `${API_URL}/explainer/:path*` },
    ]
  },
}

export default withNextIntl(nextConfig)
