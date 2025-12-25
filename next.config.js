/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // Turbopack configuration for Next.js 16+
  turbopack: {
    resolveAlias: {
      '@yaacovcr/transform': '@yaacovcr/transform',
      'utf-8-validate': 'utf-8-validate',
      'bufferutil': 'bufferutil',
    },
  },
  // Webpack configuration for compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Fix Apollo Server bundling issues
      config.externals = config.externals || [];
      config.externals.push({
        '@yaacovcr/transform': '@yaacovcr/transform',
        'utf-8-validate': 'utf-8-validate',
        'bufferutil': 'bufferutil',
      });
    }
    return config;
  },
};

module.exports = nextConfig;
