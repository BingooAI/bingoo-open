import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: [
    '@bingoo/tokens',
    '@bingoo/core',
    '@bingoo/i18n',
    '@bingoo/learning-experience',
    '@bingoo/experiences',
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
  // Proxy Better Auth through this origin so the session cookie is same-origin
  // (bingoo.ai, not api.bingoo.ai) — letting the Next server read + validate the
  // session for server-side route gating. The API stays the real AAA boundary.
  async rewrites() {
    return [{ source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` }];
  },
};

export default withNextIntl(nextConfig);
