#!/usr/bin/env node
/**
 * Validate required environment variables at build time
 * This script runs before the Next.js build to catch missing env vars early
 */

const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

const missingVars = requiredEnvVars.filter((varName) => {
  const value = process.env[varName];
  return !value || value.includes('placeholder') || value.includes('your-project') || value.includes('your-anon');
});

if (missingVars.length > 0) {
  console.error('❌ Missing or invalid required environment variables:');
  missingVars.forEach((varName) => {
    console.error(`   - ${varName}`);
  });
  console.error('\nPlease set these in Vercel project settings → Environment Variables');
  process.exit(1);
}

console.log('✅ All required environment variables are set');
process.exit(0);

