/**
 * Check what's actually stored for version 18
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

async function checkVersion18() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Checking version 18...\n');

  // Get version 18
  const { data: v18 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  if (!v18) {
    console.log('Version 18 not found');
    return;
  }

  console.log(`Version 18:`);
  console.log(`  Is Snapshot: ${v18.is_snapshot}`);
  console.log(`  Change Type: ${v18.change_type}`);
  console.log(`  Created At: ${v18.created_at}`);

  if (v18.is_snapshot && v18.content_snapshot) {
    console.log(`\n📄 SNAPSHOT CONTENT:`);
    console.log('-'.repeat(70));
    const content = v18.content_snapshot;
    console.log(content);
    console.log('-'.repeat(70));
    
    // Check for "using"
    const match = content.match(/using[.\s]+\*\*Zadoox\*\*/);
    if (match) {
      console.log(`\nFound: "${match[0]}"`);
      console.log(`Has "using.": ${content.includes('using.')}`);
      console.log(`Has "using **": ${content.includes('using **')}`);
    }
  } else if (v18.content_delta) {
    console.log(`\n📊 DELTA (not snapshot)`);
    console.log(JSON.stringify(v18.content_delta, null, 2));
  }

  // Also check what the API would return when reconstructing
  console.log(`\n\n🔍 Testing reconstruction via API logic...`);
  
  // Simulate what reconstructVersion does
  if (v18.is_snapshot && v18.content_snapshot) {
    console.log('Version 18 is a snapshot, so reconstruction should return:');
    console.log(v18.content_snapshot.substring(0, 500));
  }
}

checkVersion18().catch(console.error);

