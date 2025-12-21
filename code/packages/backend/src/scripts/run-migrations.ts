/**
 * Database Migration Runner
 * Runs SQL migrations using direct database connection via connection string
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const { Client } = pg;

interface MigrationFile {
  name: string;
  path: string;
  timestamp: string;
}

/**
 * Get all migration files sorted by timestamp
 */
async function getMigrationFiles(): Promise<MigrationFile[]> {
  const migrationsDir = join(__dirname, '../../../supabase/migrations');
  const files = await readdir(migrationsDir);
  
  const migrations: MigrationFile[] = files
    .filter(file => file.endsWith('.sql'))
    .map(file => ({
      name: file,
      path: join(migrationsDir, file),
      timestamp: file.split('_')[0],
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  
  return migrations;
}

/**
 * Execute SQL migration using direct database connection
 */
async function runMigration(client: pg.Client, filePath: string, fileName: string): Promise<void> {
  try {
    // Read the migration file
    const sql = await readFile(filePath, 'utf-8');
    
    // Execute the SQL
    await client.query(sql);
    
    console.log(`✅ Migration executed: ${fileName}`);
  } catch (error: any) {
    // Check if it's a "already exists" error (idempotent operations)
    if (error.message && (
      error.message.includes('already exists') ||
      error.message.includes('duplicate') ||
      error.message.includes('IF NOT EXISTS')
    )) {
      console.log(`⚠️  Migration skipped (already applied): ${fileName}`);
      return;
    }
    throw new Error(`Migration failed: ${fileName}\n${error.message}`);
  }
}

/**
 * Main migration runner
 */
async function runMigrations() {
  console.log('Starting database migrations...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get all migration files
    const migrations = await getMigrationFiles();
    console.log(`Found ${migrations.length} migration file(s)\n`);
    
    // Run each migration
    for (const migration of migrations) {
      console.log(`Running migration: ${migration.name}...`);
      await runMigration(client, migration.path, migration.name);
    }
    
    console.log('\n✅ All migrations completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await client.end();
  }
}

// Run migrations
runMigrations()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
