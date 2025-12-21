/**
 * Test Database Connection Script
 * Run this to verify Supabase connection is working
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../db/client.js';

async function testConnection() {
  console.log('Testing Supabase database connection...\n');

  try {
    const db = getSupabaseAdmin();
    
    // Test 1: Check if we can connect
    console.log('1. Testing basic connection...');
    const { data, error } = await db.from('projects').select('count').limit(0);
    
    if (error) {
      console.error('❌ Connection failed:', error.message);
      return false;
    }
    
    console.log('✅ Basic connection successful\n');

    // Test 2: Check if tables exist
    console.log('2. Checking tables...');
    const tables = ['user_profiles', 'projects', 'documents'];
    
    for (const table of tables) {
      const { error: tableError } = await db
        .from(table)
        .select('*')
        .limit(0);
      
      if (tableError) {
        console.error(`❌ Table "${table}" not found or inaccessible:`, tableError.message);
        return false;
      }
      
      console.log(`   ✅ Table "${table}" exists`);
    }
    
    console.log('\n✅ All tables are accessible\n');

    // Test 3: Check RLS is enabled
    console.log('3. Row Level Security status:');
    console.log('   ℹ️  RLS status should be checked in Supabase dashboard');
    console.log('   Go to: Table Editor → Select table → Check RLS badge\n');

    console.log('✅ Database connection test completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the test
testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


