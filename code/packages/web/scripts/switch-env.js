#!/usr/bin/env node

/**
 * Switch between local and dev environment configurations
 * Usage: node scripts/switch-env.js [local|dev|docker]
 * 
 * This script copies the appropriate .env template to .env.local
 */

const fs = require('fs');
const path = require('path');

const envType = process.argv[2] || 'local';

if (!['local', 'dev', 'docker'].includes(envType)) {
  console.error('❌ Invalid environment type. Use "local", "dev", or "docker"');
  console.error('Usage: node scripts/switch-env.js [local|dev|docker]');
  process.exit(1);
}

const webDir = path.join(__dirname, '..');
// NOTE: Some repos/tools block committing dot-env template files.
// We support both conventions:
// - `.env.<type>.template` (preferred if allowed)
// - `env.<type>.template`  (fallback, committed to repo)
const templateFileDot = path.join(webDir, `.env.${envType}.template`);
const templateFileFallback = path.join(webDir, `env.${envType}.template`);
const templateFile = fs.existsSync(templateFileDot) ? templateFileDot : templateFileFallback;
const targetFile = path.join(webDir, '.env.local');

if (!fs.existsSync(templateFile)) {
  console.error(`❌ Template file not found: ${templateFileDot}`);
  console.error(`   Fallback also missing: ${templateFileFallback}`);
  console.error('   Please create a template file first');
  process.exit(1);
}

try {
  const template = fs.readFileSync(templateFile, 'utf-8');
  fs.writeFileSync(targetFile, template, 'utf-8');
  
  console.log(`✅ Switched to ${envType} environment`);
  console.log(`   Copied ${path.basename(templateFile)} → .env.local`);
  
  // Show the API URL that will be used
  const apiUrlMatch = template.match(/NEXT_PUBLIC_API_URL=(.+)/);
  if (apiUrlMatch) {
    console.log(`   API URL: ${apiUrlMatch[1]}`);
  }
  
  console.log(`\n⚠️  Remember to update the values in .env.local with your actual credentials!`);
} catch (error) {
  console.error(`❌ Failed to switch environment:`, error.message);
  process.exit(1);
}



