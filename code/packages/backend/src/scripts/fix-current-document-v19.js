/**
 * Fix current document to match v19 (should have the dot)
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import DiffMatchPatch from 'diff-match-patch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const dmp = new DiffMatchPatch();

function applyDelta(content, delta) {
  let result = content;
  const sortedOps = [...delta.operations].sort((a, b) => a.position - b.position);
  let offset = 0;

  for (const op of sortedOps) {
    const adjustedPosition = op.position + offset;

    if (op.type === 'insert' && op.text) {
      result = result.slice(0, adjustedPosition) + op.text + result.slice(adjustedPosition);
      offset += op.text.length;
    } else if (op.type === 'delete' && op.length) {
      result = result.slice(0, adjustedPosition) + result.slice(adjustedPosition + op.length);
      offset -= op.length;
    } else if (op.type === 'replace' && op.text && op.length) {
      result = result.slice(0, adjustedPosition) + op.text + result.slice(adjustedPosition + op.length);
      offset += op.text.length - op.length;
    }
  }

  return result;
}

async function fixCurrentDocument() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔧 Fixing current document to match v19...\n');

  // Get v18 (base)
  const { data: v18 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 18)
    .single();

  // Get v19 (delta)
  const { data: v19 } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', 19)
    .single();

  if (!v18 || !v19) {
    console.log('Missing versions');
    return;
  }

  // Reconstruct v19 content
  const baseContent = v18.content_snapshot;
  const delta = typeof v19.content_delta === 'string' ? JSON.parse(v19.content_delta) : v19.content_delta;
  const v19Content = applyDelta(baseContent, delta);

  console.log('v19 should be:');
  console.log(v19Content.substring(0, 200));
  console.log(`\nHas "using.": ${v19Content.includes('using.')}`);

  // Update current document to match v19
  const { error } = await supabase
    .from('documents')
    .update({ content: v19Content })
    .eq('id', documentId);

  if (error) {
    console.error('❌ Failed to update:', error);
  } else {
    console.log('✅ Fixed current document to match v19 (with dot)');
  }
}

fixCurrentDocument().catch(console.error);

