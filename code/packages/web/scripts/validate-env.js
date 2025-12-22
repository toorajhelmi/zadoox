#!/usr/bin/env node
/**
 * Validate required environment variables at build time
 * This script runs before the Next.js build to catch missing env vars early
 * Only fails in production, warns in other environments
 */

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

