/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  transpilePackages: ['@zadoox/shared'],
  eslint: {
    // Disable ESLint during builds (we run it in CI)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type checking is done in CI
    ignoreBuildErrors: false,
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, '.'),
    };
    return config;
  },
};

module.exports = nextConfig;





