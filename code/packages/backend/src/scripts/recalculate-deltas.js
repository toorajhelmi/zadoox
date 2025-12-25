/**
 * Recalculate all delta-based versions to fix the position bug
 * This fixes the bug where insert positions used newPosition instead of oldPosition
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

/**
 * Calculate delta with correct position logic (using oldPosition for inserts)
 */
function calculateDeltaFixed(oldContent, newContent) {
  const diffs = dmp.diff_main(oldContent, newContent);
  dmp.diff_cleanupSemantic(diffs);

  const operations = [];
  let oldPosition = 0;
  let newPosition = 0;

  for (const [operation, text] of diffs) {
    if (operation === 0) {
      oldPosition += text.length;
      newPosition += text.length;
    } else if (operation === -1) {
      operations.push({
        type: 'delete',
        position: oldPosition,
        length: text.length,
      });
      oldPosition += text.length;
    } else if (operation === 1) {
      // FIX: Use oldPosition, not newPosition
      operations.push({
        type: 'insert',
        position: oldPosition,
        text,
      });
      newPosition += text.length;
    }
  }

  return { operations, baseVersion: 0 };
}

/**
 * Reconstruct version content
 */
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

  // Get base content
  const baseContent = await reconstructVersion(documentId, version.snapshot_base_version);
  if (!baseContent) return null;

  // Get all versions from base to target
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

/**
 * Apply delta operations
 */
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

async function recalculateDeltas() {
  console.log('🔧 Recalculating deltas to fix position bug...\n');

  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';

  // Get all delta-based versions
  const { data: versions } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('is_snapshot', false)
    .order('version_number', { ascending: true });

  if (!versions || versions.length === 0) {
    console.log('No delta-based versions found');
    return;
  }

  console.log(`Found ${versions.length} delta-based version(s) to fix\n`);

  for (const version of versions) {
    if (!version.snapshot_base_version || !version.content_delta) continue;

    console.log(`Fixing version ${version.version_number}...`);

    // Get the previous version's content (what it should be after applying previous deltas)
    const previousVersionNumber = version.version_number - 1;
    const previousContent = await reconstructVersion(documentId, previousVersionNumber);

    if (!previousContent) {
      console.log(`  ⚠️  Could not reconstruct previous version ${previousVersionNumber}`);
      continue;
    }

    // Get what this version should be (reconstruct it)
    const targetContent = await reconstructVersion(documentId, version.version_number);

    if (!targetContent) {
      console.log(`  ⚠️  Could not reconstruct target version ${version.version_number}`);
      continue;
    }

    // Recalculate delta with correct logic
    const fixedDelta = calculateDeltaFixed(previousContent, targetContent);

    // Update the version with fixed delta
    const { error } = await supabase
      .from('document_versions')
      .update({ content_delta: JSON.stringify(fixedDelta) })
      .eq('id', version.id);

    if (error) {
      console.error(`  ❌ Failed to update: ${error.message}`);
    } else {
      console.log(`  ✅ Fixed version ${version.version_number} (${fixedDelta.operations.length} operations)`);
    }
  }

  console.log('\n✅ Delta recalculation complete!');
}

recalculateDeltas().catch(console.error);

