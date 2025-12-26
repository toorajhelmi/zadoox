#!/usr/bin/env node

/**
 * Switch between local and dev environment configurations
 * Usage: node scripts/switch-env.js [local|dev]
 * 
 * This script copies the appropriate .env template to .env.local
 */

const fs = require('fs');
const path = require('path');

const envType = process.argv[2] || 'local';

if (!['local', 'dev'].includes(envType)) {
  console.error('❌ Invalid environment type. Use "local" or "dev"');
  console.error('Usage: node scripts/switch-env.js [local|dev]');
  process.exit(1);
}

const webDir = path.join(__dirname, '..');
const templateFile = path.join(webDir, `.env.${envType}.template`);
const targetFile = path.join(webDir, '.env.local');

if (!fs.existsSync(templateFile)) {
  console.error(`❌ Template file not found: ${templateFile}`);
  console.error('   Please create the template file first');
  process.exit(1);
}

try {
  const template = fs.readFileSync(templateFile, 'utf-8');
  fs.writeFileSync(targetFile, template, 'utf-8');
  
  console.log(`✅ Switched to ${envType} environment`);
  console.log(`   Copied .env.${envType}.template → .env.local`);
  
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

