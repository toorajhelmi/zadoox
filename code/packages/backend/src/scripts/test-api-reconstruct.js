/**
 * Test what the actual API endpoint returns for v19
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { VersionService } from '../services/version-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function testAPIReconstruct() {
  const documentId = '041fe925-a2d9-4a32-ac08-28270f988f7e';
  const versionService = new VersionService(supabase);

  console.log('🔍 Testing API reconstructVersion for v19...\n');

  try {
    const content = await versionService.reconstructVersion(documentId, 19);
    
    console.log('API returned content:');
    console.log('-'.repeat(70));
    console.log(content);
    console.log('-'.repeat(70));
    
    const hasDot = content.includes('using.');
    console.log(`\nHas "using.": ${hasDot}`);
    
    if (hasDot) {
      const match = content.match(/using\.\s+\*\*Zadoox\*\*/);
      console.log(`Match: "${match ? match[0] : 'none'}"`);
    } else {
      const match = content.match(/using\s+\*\*Zadoox\*\*/);
      console.log(`Match: "${match ? match[0] : 'none'}"`);
      console.log('\n⚠️  PROBLEM: v19 should have "using." but API returned content without it!');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPIReconstruct().catch(console.error);

