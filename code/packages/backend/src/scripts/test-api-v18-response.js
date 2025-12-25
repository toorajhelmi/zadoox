/**
 * Test what the actual API returns for v18 reconstruction
 * This simulates what the API endpoint does
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Import VersionService - need to use the actual service
async function testAPIResponse() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';
  
  // Manually replicate what VersionService.reconstructVersion does
  console.log('🔍 Testing API response for v18...\n');
  
  // Get version 18
  const { data: versionData } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  if (!versionData) {
    console.log('v18 not found');
    return;
  }

  console.log('v18 from DB:');
  console.log(`  is_snapshot: ${versionData.is_snapshot}`);
  console.log(`  has content_snapshot: ${!!versionData.content_snapshot}`);

  // Map to DocumentVersion format (what the service does)
  const version = {
    id: versionData.id,
    documentId: versionData.document_id,
    versionNumber: versionData.version_number,
    contentSnapshot: versionData.content_snapshot,
    contentDelta: versionData.content_delta ? JSON.parse(versionData.content_delta) : undefined,
    isSnapshot: versionData.is_snapshot,
    snapshotBaseVersion: versionData.snapshot_base_version,
  };

  // Replicate reconstructVersion logic
  let content;
  if (version.isSnapshot && version.contentSnapshot) {
    console.log('\n✅ v18 is snapshot - returning snapshot directly');
    content = version.contentSnapshot;
  } else {
    console.log('\n⚠️  v18 is NOT a snapshot - this is wrong!');
    content = 'ERROR';
  }

  console.log('\n📄 Content that API would return:');
  console.log('-'.repeat(70));
  console.log(content);
  console.log('-'.repeat(70));
  
  const hasDot = content.includes('using.');
  console.log(`\nHas "using.": ${hasDot}`);
  
  if (hasDot) {
    console.log('⚠️  PROBLEM: API is returning content WITH dot for v18!');
    const match = content.match(/using[.\s]+\*\*Zadoox\*\*/);
    console.log(`Match: "${match ? match[0] : 'none'}"`);
  } else {
    console.log('✅ API would return correct content (no dot)');
    console.log('If you see dot in UI, check frontend code or browser console logs');
  }
}

testAPIResponse().catch(console.error);

