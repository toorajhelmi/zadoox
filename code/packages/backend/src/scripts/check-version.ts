/**
 * Script to check version content in database
 * Usage: pnpm tsx src/scripts/check-version.ts <documentId> <versionNumber>
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../db/client.js';

async function checkVersion(documentId: string, versionNumber: number) {
  console.log(`Checking version ${versionNumber} for document ${documentId}...\n`);

  try {
    const db = getSupabaseAdmin();
    
    // Get the version
    const { data: version, error } = await db
      .from('document_versions')
      .select('*')
      .eq('document_id', documentId)
      .eq('version_number', versionNumber)
      .single();
    
    if (error || !version) {
      console.error('❌ Error fetching version:', error?.message || 'Version not found');
      return;
    }
    
    console.log('Version found:');
    console.log(`  ID: ${version.id}`);
    console.log(`  Version Number: ${version.version_number}`);
    console.log(`  Is Snapshot: ${version.is_snapshot}`);
    console.log(`  Change Type: ${version.change_type}`);
    console.log(`  Created At: ${version.created_at}`);
    console.log(`  Snapshot Base Version: ${version.snapshot_base_version || 'N/A'}`);
    console.log('\nContent:');
    
    if (version.is_snapshot && version.content_snapshot) {
      console.log('--- SNAPSHOT CONTENT ---');
      console.log(version.content_snapshot);
      console.log('--- END SNAPSHOT ---');
      
      // Check for the specific issue
      if (version.content_snapshot.includes('using.')) {
        console.log('\n⚠️  Found "using." in content - checking context...');
        const lines = version.content_snapshot.split('\n');
        lines.forEach((line: string, idx: number) => {
          if (line.includes('using.')) {
            console.log(`Line ${idx + 1}: ${line}`);
          }
        });
      }
    } else if (version.content_delta) {
      console.log('--- DELTA CONTENT ---');
      console.log(JSON.stringify(version.content_delta, null, 2));
      console.log('--- END DELTA ---');
    } else {
      console.log('⚠️  No content found (neither snapshot nor delta)');
    }
    
    // Also check the current document content
    const { data: doc } = await db
      .from('documents')
      .select('content, version')
      .eq('id', documentId)
      .single();
    
    if (doc) {
      console.log(`\nCurrent document version: ${doc.version}`);
      console.log('Current document content (first 200 chars):');
      console.log(doc.content.substring(0, 200));
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Get command line arguments
const documentId = process.argv[2];
const versionNumber = parseInt(process.argv[3], 10);

if (!documentId || !versionNumber) {
  console.error('Usage: pnpm tsx src/scripts/check-version.ts <documentId> <versionNumber>');
  process.exit(1);
}

checkVersion(documentId, versionNumber)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

