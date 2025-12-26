/**
 * Cleanup Versions Script
 * Deletes all versions except the first snapshot for each document
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../db/client.js';

async function cleanupVersions() {
  console.log('Cleaning up versions...\n');

  try {
    const db = getSupabaseAdmin();

    // Step 1: Get first snapshot for each document
    console.log('1. Finding first snapshot for each document...');
    
    // Get all snapshots ordered by version number
    const { data: snapshots, error: queryError } = await db
      .from('document_versions')
      .select('id, document_id, version_number')
      .eq('is_snapshot', true)
      .order('version_number', { ascending: true });

    if (queryError) {
      console.error('❌ Failed to query snapshots:', queryError.message);
      return false;
    }

    // Group by document_id and get the first one for each
    const firstSnapshotMap = new Map<string, { id: string; versionNumber: number }>();
    for (const snapshot of snapshots || []) {
      if (!firstSnapshotMap.has(snapshot.document_id)) {
        firstSnapshotMap.set(snapshot.document_id, {
          id: snapshot.id,
          versionNumber: snapshot.version_number,
        });
      }
    }

    console.log(`   ✅ Found ${firstSnapshotMap.size} first snapshots\n`);

    // Step 2: Delete all versions except first snapshots
    console.log('2. Deleting all versions except first snapshots...');
    
    // Delete versions that are NOT in the keep list
    // We need to delete in batches or use a different approach
    // Since Supabase doesn't support NOT IN easily, we'll delete by document_id and then restore first snapshots
    
    // Get all document IDs
    const documentIds = Array.from(firstSnapshotMap.keys());
    let deletedCount = 0;
    
    for (const documentId of documentIds) {
      const keepId = firstSnapshotMap.get(documentId)!.id;
      
      // Get all versions for this document
      const { data: allVersions, error: versionsError } = await db
        .from('document_versions')
        .select('id')
        .eq('document_id', documentId);
      
      if (versionsError) {
        console.error(`   ⚠️  Failed to get versions for document ${documentId}`);
        continue;
      }
      
      // Delete versions that are not the first snapshot
      const idsToDelete = (allVersions || [])
        .map(v => v.id)
        .filter(id => id !== keepId);
      
      if (idsToDelete.length > 0) {
        // Delete in batches (Supabase has limits)
        for (let i = 0; i < idsToDelete.length; i += 100) {
          const batch = idsToDelete.slice(i, i + 100);
          const { error: deleteError } = await db
            .from('document_versions')
            .delete()
            .in('id', batch);
          
          if (deleteError) {
            console.error(`   ⚠️  Failed to delete batch for document ${documentId}:`, deleteError.message);
          } else {
            deletedCount += batch.length;
          }
        }
      }
    }

    console.log(`   ✅ Deleted ${deletedCount} versions\n`);

    // Step 3: Update version metadata
    console.log('3. Updating version metadata...');
    for (const [documentId, snapshot] of firstSnapshotMap.entries()) {
      const { error: metadataError } = await db
        .from('document_version_metadata')
        .upsert({
          document_id: documentId,
          current_version: snapshot.versionNumber,
          last_snapshot_version: snapshot.versionNumber,
          total_versions: 1,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'document_id',
        });

      if (metadataError) {
        console.error(`   ⚠️  Failed to update metadata for document ${documentId}:`, metadataError.message);
      }
    }

    console.log('   ✅ Updated version metadata\n');

    // Step 4: Update documents table version field
    console.log('4. Updating documents table...');
    for (const [documentId, snapshot] of firstSnapshotMap.entries()) {
      const { error: docError } = await db
        .from('documents')
        .update({ version: snapshot.versionNumber })
        .eq('id', documentId);

      if (docError) {
        console.error(`   ⚠️  Failed to update document ${documentId}:`, docError.message);
      }
    }

    console.log('   ✅ Updated documents table\n');
    console.log('✅ Version cleanup completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

// Run the cleanup
cleanupVersions()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

