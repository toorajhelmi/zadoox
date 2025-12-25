/**
 * Check v19 delta and what it should produce
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

async function checkV19() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Checking v19 delta...\n');

  // Get v18 (base snapshot)
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

  const baseContent = v18.content_snapshot;
  console.log('v18 (base) content:');
  console.log(baseContent);
  console.log('\n');

  const delta = typeof v19.content_delta === 'string' ? JSON.parse(v19.content_delta) : v19.content_delta;
  console.log('v19 delta operations:');
  console.log(JSON.stringify(delta.operations, null, 2));
  console.log('\n');

  // Apply delta to base
  const reconstructed = applyDelta(baseContent, delta);
  console.log('Reconstructed v19 content:');
  console.log(reconstructed);
  console.log('\n');

  // Check for dot
  const hasDot = reconstructed.includes('using.');
  console.log(`Has "using.": ${hasDot}`);
  
  if (hasDot) {
    const match = reconstructed.match(/using\.\s+\*\*Zadoox\*\*/);
    console.log(`Match: "${match ? match[0] : 'none'}"`);
  } else {
    const match = reconstructed.match(/using\s+\*\*Zadoox\*\*/);
    console.log(`Match: "${match ? match[0] : 'none'}"`);
  }

  // What should v19 be? It should add a dot after "using"
  const expectedContent = baseContent.replace(/using\s+\*\*/g, 'using. **');
  console.log('\nExpected v19 content (with dot):');
  console.log(expectedContent);
  console.log(`\nReconstructed matches expected: ${reconstructed === expectedContent}`);
}

checkV19().catch(console.error);

