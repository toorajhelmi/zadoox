/**
 * Direct script to query and fix version 19 content
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from backend directory
config({ path: join(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function fixVersion19() {
  console.log('🔍 Searching for version 19 with "using." issue...\n');

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
        change_type,
        created_at,
        documents!inner(title, version)
      `)
      .eq('version_number', 19)
      .order('created_at', { ascending: false })
      .limit(10);

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
      console.log(`Document: ${version.documents?.title || 'N/A'} (ID: ${version.document_id})`);
      console.log(`Current Doc Version: ${version.documents?.version || 'N/A'}`);
      console.log(`Version: ${version.version_number}`);
      console.log(`Is Snapshot: ${version.is_snapshot}`);
      console.log(`Change Type: ${version.change_type}`);

      if (version.is_snapshot && version.content_snapshot) {
        const content = version.content_snapshot;
        
        // Check for "using." issue
        if (content.includes('using.')) {
          console.log('\n⚠️  FOUND "using." in content!');
          
          // Fix: Replace "using." with "using" (when followed by whitespace or end)
          const fixedContent = content.replace(/using\.(\s|$)/g, 'using$1');
          
          if (fixedContent !== content) {
            // Update the database
            const { error: updateError } = await supabase
              .from('document_versions')
              .update({ content_snapshot: fixedContent })
              .eq('id', version.id);
            
            if (updateError) {
              console.error('❌ Failed to update:', updateError);
            } else {
              console.log('✅ FIXED: Removed "." after "using"');
              
              // Show the fixed line
              const lines = fixedContent.split('\n');
              lines.forEach((line, idx) => {
                if (line.includes('using') && !line.includes('using.')) {
                  const originalLine = content.split('\n')[idx];
                  if (originalLine.includes('using.')) {
                    console.log(`\nFixed line ${idx + 1}:`);
                    console.log(`  Before: ${originalLine.substring(0, 80)}`);
                    console.log(`  After:  ${line.substring(0, 80)}`);
                  }
                }
              });
            }
          } else {
            console.log('⚠️  Pattern found but fix did not change content');
          }
        } else {
          console.log('✅ No "using." found');
        }
      } else {
        console.log('ℹ️  Not a snapshot or no content');
      }

      console.log('='.repeat(70));
      console.log('');
    }
    
    console.log('✅ Check and fix complete');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    throw error;
  }
}

fixVersion19()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });

