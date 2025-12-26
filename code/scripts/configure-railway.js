#!/usr/bin/env node

/**
 * Script to configure Railway service via GraphQL API
 * 
 * Usage:
 *   RAILWAY_TOKEN=your-token node configure-railway.js
 * 
 * This script attempts to configure Railway service settings:
 * - Root Directory: code/packages/backend
 * - Build Command: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/shared build && pnpm --filter backend build
 * - Start Command: node dist/server.js
 */

const RAILWAY_TOKEN = process.env.RAILWAY_TOKEN || '307b7fa1-689e-4fff-a7f0-85dbd684c8b6';
const RAILWAY_API_URL = 'https://backboard.railway.com/graphql/v2';

async function graphqlQuery(query, variables = {}) {
  const response = await fetch(RAILWAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RAILWAY_TOKEN}`,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(data.errors, null, 2)}`);
  }
  
  return data.data;
}

async function listProjects() {
  const query = `
    query {
      projects {
        edges {
          node {
            id
            name
            services {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        }
      }
    }
  `;
  
  try {
    const data = await graphqlQuery(query);
    return data;
  } catch (error) {
    console.error('Error listing projects:', error.message);
    throw error;
  }
}

async function updateService(serviceId, rootDirectory, buildCommand, startCommand) {
  // Note: Railway API mutations may vary - this is a placeholder
  // You may need to use different mutations based on Railway's API schema
  const mutation = `
    mutation UpdateService($id: ID!, $rootDirectory: String, $buildCommand: String, $startCommand: String) {
      serviceUpdate(id: $id, rootDirectory: $rootDirectory, buildCommand: $buildCommand, startCommand: $startCommand) {
        id
        rootDirectory
        buildCommand
        startCommand
      }
    }
  `;
  
  try {
    const data = await graphqlQuery(mutation, {
      id: serviceId,
      rootDirectory,
      buildCommand,
      startCommand,
    });
    return data;
  } catch (error) {
    console.error('Error updating service:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🔍 Attempting to connect to Railway API...\n');
  
  try {
    // First, try to list projects to verify authentication
    console.log('📋 Fetching projects...');
    const projectsData = await listProjects();
    console.log('✅ Successfully connected to Railway API!\n');
    console.log('Projects:', JSON.stringify(projectsData, null, 2));
    
    // TODO: Implement service configuration update once we know the correct mutation
    // For now, the settings are documented in railway.toml and RAILWAY_SETUP.md
    
    console.log('\n⚠️  Service configuration via API requires knowing the exact mutation schema.');
    console.log('The configuration is documented in:');
    console.log('  - code/packages/backend/railway.toml');
    console.log('  - code/implementation/RAILWAY_SETUP.md');
    console.log('\nRecommended: Configure via Railway Dashboard (Settings → Service)');
    
  } catch (error) {
    console.error('\n❌ Failed to configure Railway via API:', error.message);
    console.log('\n📝 Configuration needs to be done manually in Railway Dashboard:');
    console.log('\n1. Go to Railway Dashboard → Your Project → Backend Service → Settings');
    console.log('2. Set Root Directory: code/packages/backend');
    console.log('3. Set Build Command: cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @zadoox/shared build && pnpm --filter backend build');
    console.log('4. Set Start Command: node dist/server.js');
    console.log('\nSee code/implementation/RAILWAY_TROUBLESHOOTING.md for details.');
    process.exit(1);
  }
}

main();





