/** @type {import('next').NextConfig} */
const path = require('path');
const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

/**
 * IMPORTANT:
 * In this repo we often run `next dev` while pre-push/CI runs `next build`.
 * Both commands write into Next's `distDir`. If they share the same folder,
 * `next build` can overwrite files while `next dev` is serving them, causing
 * missing chunk/module errors (404s for `_app.js`, `react-refresh.js`, etc.).
 *
 * So we split the output dirs:
 * - dev  -> `.next-dev`
 * - build -> `.next`
 */
module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    distDir: isDev ? '.next-dev' : '.next',
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
  return nextConfig;
};





