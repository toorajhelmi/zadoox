/**
 * Test what the API actually returns when reconstructing version 18
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

async function reconstructVersion(documentId, versionNumber) {
  const { data: version } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', versionNumber)
    .single();

  if (!version) return null;

  if (version.is_snapshot && version.content_snapshot) {
    return version.content_snapshot;
  }

  if (!version.snapshot_base_version || !version.content_delta) {
    return null;
  }

  const baseContent = await reconstructVersion(documentId, version.snapshot_base_version);
  if (!baseContent) return null;

  const { data: allVersions } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .gte('version_number', version.snapshot_base_version)
    .lte('version_number', versionNumber)
    .order('version_number', { ascending: true });

  let content = baseContent;
  for (const v of allVersions || []) {
    if (!v.is_snapshot && v.content_delta) {
      const delta = typeof v.content_delta === 'string' ? JSON.parse(v.content_delta) : v.content_delta;
      content = applyDelta(content, delta);
    }
  }

  return content;
}

async function testReconstruct() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  console.log('🔍 Testing reconstruction of version 18...\n');

  const reconstructed = await reconstructVersion(documentId, 18);

  if (!reconstructed) {
    console.log('❌ Could not reconstruct version 18');
    return;
  }

  console.log('Reconstructed content:');
  console.log('-'.repeat(70));
  console.log(reconstructed);
  console.log('-'.repeat(70));

  const match = reconstructed.match(/using[.\s]+\*\*Zadoox\*\*/);
  if (match) {
    console.log(`\nFound: "${match[0]}"`);
    console.log(`Has "using.": ${reconstructed.includes('using.')}`);
    console.log(`Has "using **": ${reconstructed.includes('using **')}`);
  }
}

testReconstruct().catch(console.error);

