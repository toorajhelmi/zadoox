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
  // Ensure build fails on errors
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
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





