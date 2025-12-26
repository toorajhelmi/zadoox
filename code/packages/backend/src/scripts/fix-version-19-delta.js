/**
 * Fix version 19 delta that incorrectly adds "." after "using"
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

async function fixVersion19Delta() {
  console.log('🔧 Fixing version 19 delta and current document...\n');

  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  // Get version 19
  const { data: v19 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 19)
    .single();

  if (!v19 || !v19.content_delta) {
    console.log('Version 19 not found or has no delta');
    return;
  }

  const delta = typeof v19.content_delta === 'string' ? JSON.parse(v19.content_delta) : v19.content_delta;
  
  console.log('Original delta operations:', delta.operations.length);
  
  // Check and fix operations that insert "using."
  let fixed = false;
  const fixedOperations = delta.operations.map(op => {
    if (op.type === 'insert' && op.text && op.text.includes('using.')) {
      console.log(`⚠️  Found operation inserting "using.": "${op.text}"`);
      const fixedText = op.text.replace(/using\.(\s|$)/g, 'using$1');
      if (fixedText !== op.text) {
        console.log(`✅ Fixing: "${op.text}" → "${fixedText}"`);
        fixed = true;
        return { ...op, text: fixedText };
      }
    }
    return op;
  });

  if (fixed) {
    // Update version 19 delta
    const { error: updateError } = await supabase
      .from('document_versions')
      .update({ content_delta: JSON.stringify({ ...delta, operations: fixedOperations }) })
      .eq('id', v19.id);

    if (updateError) {
      console.error('❌ Failed to update version 19:', updateError);
    } else {
      console.log('✅ Fixed version 19 delta');
    }
  }

  // Also fix the current document content
  const { data: doc } = await supabase
    .from('documents')
    .select('content')
    .eq('id', documentId)
    .single();

  if (doc && doc.content.includes('using.')) {
    const fixedContent = doc.content.replace(/using\.(\s|$)/g, 'using$1');
    
    if (fixedContent !== doc.content) {
      const { error: docError } = await supabase
        .from('documents')
        .update({ content: fixedContent })
        .eq('id', documentId);

      if (docError) {
        console.error('❌ Failed to update document:', docError);
      } else {
        console.log('✅ Fixed current document content');
        console.log('\nBefore:', doc.content.match(/using\.\s+\*\*/)?.[0] || 'using. **Zadoox**');
        console.log('After: ', fixedContent.match(/using\s+\*\*/)?.[0] || 'using **Zadoox**');
      }
    }
  }

  console.log('\n✅ Fix complete!');
}

fixVersion19Delta().catch(console.error);

