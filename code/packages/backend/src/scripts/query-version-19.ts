/**
 * Query database for version 19 to check for "using." issue
 * This script directly queries Supabase to find and inspect version 19
 */

import 'dotenv/config';

// Check if we have the required environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Please set these environment variables');
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function queryVersion19() {
  console.log('🔍 Searching for documents with version 19...\n');

  try {
    // Find all version 19 records
    const { data: versions, error } = await supabase
      .from('document_versions')
      .select(`
        id,
        document_id,
        version_number,
        is_snapshot,
        content_snapshot,
        content_delta,
        change_type,
        created_at,
        documents!inner(title, version)
      `)
      .eq('version_number', 19)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!versions || versions.length === 0) {
      console.log('No version 19 found');
      return;
    }

    console.log(`Found ${versions.length} version(s) with number 19\n`);

    for (const version of versions) {
      console.log('='.repeat(70));
      console.log(`Document ID: ${version.document_id}`);
      const docData = Array.isArray(version.documents) ? version.documents[0] : version.documents;
      console.log(`Document Title: ${docData?.title || 'N/A'}`);
      console.log(`Current Doc Version: ${docData?.version || 'N/A'}`);
      console.log(`Version Number: ${version.version_number}`);
      console.log(`Is Snapshot: ${version.is_snapshot}`);
      console.log(`Change Type: ${version.change_type}`);
      console.log(`Created: ${version.created_at}`);

      if (version.is_snapshot && version.content_snapshot) {
        const content = version.content_snapshot;
        console.log('\n📄 SNAPSHOT CONTENT (first 1000 chars):');
        console.log('-'.repeat(70));
        console.log(content.substring(0, 1000));
        console.log('-'.repeat(70));

        // Check for "using." issue
        if (content.includes('using.')) {
          console.log('\n⚠️  FOUND "using." in content!');
          const lines = content.split('\n');
          let found = false;
          lines.forEach((line: string, idx: number) => {
            if (line.includes('using.')) {
              found = true;
              // Show context around the line
              const start = Math.max(0, idx - 2);
              const end = Math.min(lines.length, idx + 3);
              console.log(`\nLines ${start + 1}-${end}:`);
              for (let i = start; i < end; i++) {
                const marker = i === idx ? '>>> ' : '    ';
                console.log(`${marker}${i + 1}: ${lines[i]}`);
              }
            }
          });
          if (!found) {
            console.log('(but not found when splitting by lines - might be in a long line)');
          }
        } else {
          console.log('\n✅ No "using." found in snapshot');
        }
      } else if (version.content_delta) {
        console.log('\n📊 DELTA (not snapshot)');
        console.log('This version uses deltas - would need to reconstruct');
        console.log('Delta operations:', JSON.stringify(version.content_delta, null, 2).substring(0, 500));
      } else {
        console.log('\n⚠️  No content found');
      }

      console.log('='.repeat(70));
      console.log('');
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

queryVersion19()
  .then(() => {
    console.log('\n✅ Query complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

