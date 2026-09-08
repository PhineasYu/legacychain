/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Preserved originals are served from /api/files/<sha256>; the optimiser
  // would rewrite them, and a certificate must show the exact bytes.
  images: { unoptimized: true },
  experimental: {
    // Server-only SDKs. Keeping them external avoids bundling their
    // optional Node dependencies.
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', '@neondatabase/serverless'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Optional native accelerators for `ws`, pulled in by the Neon driver's
      // WebSocket transport. This app uses its HTTP transport, and `ws` falls
      // back to pure JS when they are absent.
      config.externals.push('bufferutil', 'utf-8-validate');
    }
    return config;
  },
};

module.exports = nextConfig;
