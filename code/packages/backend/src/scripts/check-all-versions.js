/**
 * Check all versions to see which ones have the dot
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

async function checkAllVersions() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Checking all versions for "using." pattern...\n');

  const { data: versions } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: true });

  if (!versions) {
    console.log('No versions found');
    return;
  }

  for (const v of versions) {
    let hasUsingDot = false;
    let content = '';

    if (v.is_snapshot && v.content_snapshot) {
      content = v.content_snapshot;
      hasUsingDot = content.includes('using.');
    } else if (v.content_delta) {
      const delta = typeof v.content_delta === 'string' ? JSON.parse(v.content_delta) : v.content_delta;
      // Check if any delta operation inserts "using."
      hasUsingDot = delta.operations?.some(op => 
        op.type === 'insert' && op.text && op.text.includes('using.')
      ) || false;
      content = 'DELTA';
    }

    const status = hasUsingDot ? '⚠️  HAS "using."' : '✅ No "using."';
    console.log(`v${v.version_number} (${v.is_snapshot ? 'snapshot' : 'delta'}): ${status}`);
    
    if (v.is_snapshot && content) {
      const match = content.match(/using[.\s]+\*\*Zadoox\*\*/);
      if (match) {
        console.log(`  Content: "${match[0]}"`);
      }
    }
  }
}

checkAllVersions().catch(console.error);

