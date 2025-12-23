#!/usr/bin/env node
/**
 * Validate required environment variables at build time
 * This script runs before the Next.js build to catch missing env vars early
 * Only fails in production, warns in other environments
 * Skips validation when running via Vercel CLI (vercel deploy) since Vercel provides env vars during build
 */

// Skip validation if running via Vercel CLI - Vercel will provide env vars during their build process
const skipValidation = process.env.SKIP_ENV_VALIDATION === '1' || process.env.VERCEL === '1' || process.env.VERCEL_ENV;
if (skipValidation && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log('⏭️  Skipping env validation (running via Vercel CLI - env vars will be provided by Vercel)');
  process.exit(0);
}

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const missingVars = requiredEnvVars.filter((varName) => {
  const value = process.env[varName];
  return !value || value.includes('placeholder') || value.includes('your-project') || value.includes('your-anon');
});

if (missingVars.length > 0) {
  if (isProduction) {
    console.error('❌ Missing or invalid required environment variables:');
    missingVars.forEach((varName) => {
      console.error(`   - ${varName}`);
    });
    console.error('\nPlease set these in Vercel project settings → Environment Variables');
    process.exit(1);
  } else {
    console.warn('⚠️  Missing or invalid environment variables (non-production build):');
    missingVars.forEach((varName) => {
      console.warn(`   - ${varName}`);
    });
    console.warn('   Build will continue, but app may fail at runtime if these are not set.');
    process.exit(0);
  }
}

console.log('✅ All required environment variables are set');
process.exit(0);

