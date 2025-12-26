/**
 * Delete Specific Versions Script
 * Deletes versions 20-23 from the database
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../db/client.js';

async function deleteVersions() {
  console.log('Deleting versions 20-23...\n');

  try {
    const db = getSupabaseAdmin();

    // Step 1: Find all versions 20-23
    console.log('1. Finding versions 20-23...');
    const { data: versions, error: queryError } = await db
      .from('document_versions')
      .select('id, document_id, version_number')
      .gte('version_number', 20)
      .lte('version_number', 23)
      .order('version_number', { ascending: true });

    if (queryError) {
      console.error('❌ Failed to query versions:', queryError.message);
      return false;
    }

    if (!versions || versions.length === 0) {
      console.log('   ℹ️  No versions 20-23 found.');
      return true;
    }

    console.log(`   ✅ Found ${versions.length} versions to delete:`);
    versions.forEach((v) => {
      console.log(`      - Document ${v.document_id}, Version ${v.version_number}`);
    });
    console.log('');

    // Step 2: Delete the versions
    console.log('2. Deleting versions...');
    const { error: deleteError } = await db
      .from('document_versions')
      .delete()
      .gte('version_number', 20)
      .lte('version_number', 23);

    if (deleteError) {
      console.error('❌ Failed to delete versions:', deleteError.message);
      return false;
    }

    console.log(`   ✅ Deleted ${versions.length} versions\n`);

    // Step 3: Update version metadata for affected documents
    console.log('3. Updating version metadata...');
    const documentIds = [...new Set(versions.map((v) => v.document_id))];

    for (const documentId of documentIds) {
      // Get the current latest version for this document
      const { data: latestVersion, error: latestError } = await db
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (latestError && latestError.code !== 'PGRST116') {
        // PGRST116 is "not found" which is fine if no versions exist
        console.error(`   ⚠️  Failed to get latest version for document ${documentId}:`, latestError.message);
        continue;
      }

      // Count total versions
      const { count, error: countError } = await db
        .from('document_versions')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      if (countError) {
        console.error(`   ⚠️  Failed to count versions for document ${documentId}:`, countError.message);
        continue;
      }

      // Get last snapshot version
      const { data: lastSnapshot } = await db
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .eq('is_snapshot', true)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      const currentVersion = latestVersion?.version_number ?? 0;
      const lastSnapshotVersion = lastSnapshot?.version_number ?? 0;
      const totalVersions = count ?? 0;

      // Update metadata
      const { error: metadataError } = await db
        .from('document_version_metadata')
        .upsert({
          document_id: documentId,
          current_version: currentVersion,
          last_snapshot_version: lastSnapshotVersion,
          total_versions: totalVersions,
          updated_at: new Date().toISOString(),
        });

      if (metadataError) {
        console.error(`   ⚠️  Failed to update metadata for document ${documentId}:`, metadataError.message);
      } else {
        console.log(`   ✅ Updated metadata for document ${documentId} (current: ${currentVersion}, total: ${totalVersions})`);
      }
    }
    console.log('');

    // Step 4: Update documents table version field
    console.log('4. Updating documents table...');
    for (const documentId of documentIds) {
      const { data: latestVersion, error: latestError } = await db
        .from('document_versions')
        .select('version_number')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })
        .limit(1)
        .single();

      if (latestError && latestError.code !== 'PGRST116') {
        console.error(`   ⚠️  Failed to get latest version for document ${documentId}:`, latestError.message);
        continue;
      }

      const currentVersion = latestVersion?.version_number ?? 0;

      const { error: docError } = await db
        .from('documents')
        .update({ version: currentVersion })
        .eq('id', documentId);

      if (docError) {
        console.error(`   ⚠️  Failed to update document ${documentId}:`, docError.message);
      } else {
        console.log(`   ✅ Updated document ${documentId} to version ${currentVersion}`);
      }
    }
    console.log('');

    console.log('✅ Version deletion completed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return false;
  }
}

deleteVersions()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });

