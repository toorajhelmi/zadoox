/**
 * Check if v18 snapshot needs to be fixed (should NOT have dot)
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

async function checkAndFixV18() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Checking v18 snapshot...\n');

  const { data: v18 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  if (!v18 || !v18.content_snapshot) {
    console.log('v18 not found or has no snapshot');
    return;
  }

  const content = v18.content_snapshot;
  const hasDot = content.includes('using.');

  console.log('v18 snapshot content:');
  console.log(content.substring(0, 300));
  console.log(`\nHas "using.": ${hasDot}`);

  if (hasDot) {
    console.log('\n⚠️  v18 snapshot has dot but should NOT! Fixing...');
    
    // Remove the dot - v18 should be "using **Zadoox**"
    const fixedContent = content.replace(/using\.\s+\*\*/g, 'using **');
    
    if (fixedContent !== content) {
      const { error } = await supabase
        .from('document_versions')
        .update({ content_snapshot: fixedContent })
        .eq('id', v18.id);

      if (error) {
        console.error('❌ Failed to fix:', error);
      } else {
        console.log('✅ Fixed v18 snapshot (removed dot)');
        console.log('\nBefore:', content.match(/using[.\s]+\*\*Zadoox\*\*/)?.[0]);
        console.log('After: ', fixedContent.match(/using[.\s]+\*\*Zadoox\*\*/)?.[0]);
      }
    }
  } else {
    console.log('\n✅ v18 snapshot is correct (no dot)');
    console.log('The issue might be in the API or frontend display.');
  }
}

checkAndFixV18().catch(console.error);

