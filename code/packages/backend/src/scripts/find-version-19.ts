/**
 * Script to find documents with version 19 and check their content
 */

import 'dotenv/config';
import { getSupabaseAdmin } from '../db/client.js';

async function findVersion19() {
  console.log('Searching for documents with version 19...\n');

  try {
    const db = getSupabaseAdmin();
    
    // Find all documents that have version 19
    const { data: versions, error } = await db
      .from('document_versions')
      .select('document_id, version_number, is_snapshot, content_snapshot, content_delta, change_type, created_at')
      .eq('version_number', 19)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching versions:', error.message);
      return;
    }
    
    if (!versions || versions.length === 0) {
      console.log('No documents found with version 19');
      return;
    }
    
    console.log(`Found ${versions.length} document(s) with version 19:\n`);
    
    for (const version of versions) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Document ID: ${version.document_id}`);
      console.log(`Version: ${version.version_number}`);
      console.log(`Is Snapshot: ${version.is_snapshot}`);
      console.log(`Change Type: ${version.change_type}`);
      console.log(`Created At: ${version.created_at}`);
      
      // Get document info
      const { data: doc } = await db
        .from('documents')
        .select('title, version')
        .eq('id', version.document_id)
        .single();
      
      if (doc) {
        console.log(`Document Title: ${doc.title}`);
        console.log(`Current Document Version: ${doc.version}`);
      }
      
      // Check content
      if (version.is_snapshot && version.content_snapshot) {
        console.log('\n--- SNAPSHOT CONTENT (first 500 chars) ---');
        const content = version.content_snapshot;
        console.log(content.substring(0, 500));
        
        // Check for "using." issue
        if (content.includes('using.')) {
          console.log('\n⚠️  FOUND "using." in content!');
          const lines = content.split('\n');
          lines.forEach((line: string, idx: number) => {
            if (line.includes('using.')) {
              const match = line.match(/(.{0,30}using\.{0,30})/);
              console.log(`Line ${idx + 1}: ${match ? match[0] : line.substring(0, 60)}`);
            }
          });
        }
      } else if (version.content_delta) {
        console.log('\n--- DELTA (not a snapshot) ---');
        console.log('This version uses deltas. Need to reconstruct from base snapshot.');
      } else {
        console.log('\n⚠️  No content found');
      }
      
      console.log(`${'='.repeat(60)}\n`);
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

findVersion19()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

