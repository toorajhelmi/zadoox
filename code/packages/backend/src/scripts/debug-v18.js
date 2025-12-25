/**
 * Debug why v18 shows dot when it shouldn't
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function debugV18() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Debugging v18...\n');

  // Get v18 directly from database
  const { data: v18 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  if (!v18) {
    console.log('v18 not found');
    return;
  }

  console.log('v18 from database:');
  console.log(`  Is Snapshot: ${v18.is_snapshot}`);
  console.log(`  Has content_snapshot: ${!!v18.content_snapshot}`);
  console.log(`  Has content_delta: ${!!v18.content_delta}`);
  console.log(`  Snapshot Base Version: ${v18.snapshot_base_version || 'N/A'}`);

  if (v18.is_snapshot && v18.content_snapshot) {
    console.log('\n📄 Snapshot content:');
    console.log('-'.repeat(70));
    console.log(v18.content_snapshot);
    console.log('-'.repeat(70));
    
    const hasDot = v18.content_snapshot.includes('using.');
    console.log(`\nHas "using.": ${hasDot}`);
    
    if (hasDot) {
      console.log('⚠️  PROBLEM: v18 snapshot has "using." but it should NOT!');
      const match = v18.content_snapshot.match(/using[.\s]+\*\*Zadoox\*\*/);
      console.log(`Match: "${match ? match[0] : 'none'}"`);
    } else {
      console.log('✅ v18 snapshot correctly has NO dot');
    }
  }

  // Test what reconstructVersion would return
  console.log('\n\n🔍 Testing reconstruction...');
  
  // Import and use VersionService
  const { readFileSync } = await import('fs');
  const versionServicePath = join(__dirname, '../services/version-service.ts');
  
  // Actually, let's just manually test the logic
  if (v18.is_snapshot && v18.content_snapshot) {
    console.log('Since v18 is a snapshot, reconstructVersion should return:');
    console.log(v18.content_snapshot.substring(0, 200));
  }
}

debugV18().catch(console.error);

