/**
 * Check delta-based version 19 and reconstruct content to find the issue
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

async function checkDeltaVersion19() {
  console.log('🔍 Checking delta-based version 19...\n');

  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  // Get version 19
  const { data: v19 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 19)
    .single();

  if (!v19) {
    console.log('Version 19 not found');
    return;
  }

  console.log(`Version 19: snapshot_base_version=${v19.snapshot_base_version}, is_snapshot=${v19.is_snapshot}`);
  
  if (v19.snapshot_base_version) {
    // Get base snapshot
    const { data: baseSnapshot } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version_number', v19.snapshot_base_version)
      .single();

    if (baseSnapshot && baseSnapshot.content_snapshot) {
      console.log(`\nBase snapshot (v${v19.snapshot_base_version}) content preview:`);
      console.log(baseSnapshot.content_snapshot.substring(0, 500));
      
      // Check base for "using."
      if (baseSnapshot.content_snapshot.includes('using.')) {
        console.log('\n⚠️  Base snapshot has "using."!');
      }
    }

    // Get all versions from base to 19
    const { data: allVersions } = await supabase
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .gte('version_number', v19.snapshot_base_version)
      .lte('version_number', 19)
      .order('version_number', { ascending: true });

    console.log(`\nVersions from ${v19.snapshot_base_version} to 19: ${allVersions?.length || 0}`);
    
    // Check each delta
    for (const v of allVersions || []) {
      if (!v.is_snapshot && v.content_delta) {
        const delta = typeof v.content_delta === 'string' ? JSON.parse(v.content_delta) : v.content_delta;
        console.log(`\nVersion ${v.version_number} delta operations: ${delta.operations?.length || 0}`);
        
        // Check if any operation inserts "using."
        delta.operations?.forEach((op, idx) => {
          if (op.type === 'insert' && op.text && op.text.includes('using.')) {
            console.log(`⚠️  Operation ${idx} inserts "using.": "${op.text.substring(0, 50)}"`);
          }
        });
      }
    }
  }

  // Also check current document content
  const { data: doc } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .single();

  if (doc) {
    console.log('\n\nCurrent document content preview:');
    console.log(doc.content.substring(0, 500));
    
    if (doc.content.includes('using.')) {
      console.log('\n⚠️  Current document has "using."!');
      console.log('This means the issue is in the current content, not just version 19.');
    }
  }
}

checkDeltaVersion19().catch(console.error);

