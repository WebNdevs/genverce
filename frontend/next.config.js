/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: true,
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
  async rewrites() {
    const backend =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:4000';
    return [
      { source: '/graphql', destination: `${backend}/graphql` },
      { source: '/graphql/:path*', destination: `${backend}/graphql/:path*` },
      { source: '/upload', destination: `${backend}/upload` },
      { source: '/upload/:path*', destination: `${backend}/upload/:path*` },
      { source: '/uploads/:path*', destination: `${backend}/uploads/:path*` },
      { source: '/webhooks/:path*', destination: `${backend}/webhooks/:path*` },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days image cache
    remotePatterns: [
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
      { protocol: 'https', hostname: '*.webndevs.com' },
      { protocol: 'https', hostname: 'genverce.webndevs.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },
  transpilePackages: ['@apollo/client'],
  experimental: {
    serverComponentsExternalPackages: [],
    optimizePackageImports: [
      'lucide-react',
      '@apollo/client',
      'framer-motion',
      'date-fns',
      'recharts',
      'clsx',
      'tailwind-merge',
    ],
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Prevent ChunkLoadError timeouts during heavy initial compilation on Windows
      config.output = config.output || {};
      config.output.chunkLoadTimeout = 300000;
    }
    return config;
  },
};

module.exports = nextConfig;

