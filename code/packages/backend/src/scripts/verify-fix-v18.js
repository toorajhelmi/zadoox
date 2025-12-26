/**
 * Verify and fix v18 if it has the dot
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

async function verifyFixV18() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  const { data: v18 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  if (!v18 || !v18.content_snapshot) {
    console.log('v18 not found');
    return;
  }

  const content = v18.content_snapshot;
  const hasDot = content.includes('using.');

  console.log(`v18 has "using.": ${hasDot}`);

  if (hasDot) {
    console.log('⚠️  Fixing v18 snapshot...');
    const fixed = content.replace(/using\.\s+\*\*/g, 'using **');
    
    const { error } = await supabase
      .from('document_versions')
      .update({ content_snapshot: fixed })
      .eq('id', v18.id);

    if (error) {
      console.error('❌ Error:', error);
    } else {
      console.log('✅ Fixed v18 snapshot (removed dot)');
    }
  } else {
    console.log('✅ v18 is correct (no dot)');
    console.log('The issue might be browser caching. Try:');
    console.log('1. Hard refresh (Cmd+Shift+R)');
    console.log('2. Clear browser cache');
    console.log('3. Check browser console for API response');
  }
}

verifyFixV18().catch(console.error);

