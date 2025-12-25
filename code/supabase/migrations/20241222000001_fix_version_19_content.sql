-- Migration to check and fix version 19 content issues
-- This finds version 19 records and checks for "using." issues

-- First, let's see what we have
DO $$
DECLARE
  v_record RECORD;
  v_content TEXT;
  v_fixed_content TEXT;
BEGIN
  -- Find all version 19 records
  FOR v_record IN 
    SELECT 
      dv.id,
      dv.document_id,
      dv.version_number,
      dv.is_snapshot,
      dv.content_snapshot,
      d.title as document_title
    FROM document_versions dv
    JOIN documents d ON d.id = dv.document_id
    WHERE dv.version_number = 19
    ORDER BY dv.created_at DESC
    LIMIT 10
  LOOP
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Document: % (ID: %)', v_record.document_title, v_record.document_id;
    RAISE NOTICE 'Version: %', v_record.version_number;
    RAISE NOTICE 'Is Snapshot: %', v_record.is_snapshot;
    
    IF v_record.is_snapshot AND v_record.content_snapshot IS NOT NULL THEN
      v_content := v_record.content_snapshot;
      
      -- Check for "using." issue
      IF v_content LIKE '%using.%' THEN
        RAISE NOTICE '⚠️  FOUND "using." in content!';
        
        -- Fix: Replace "using." with "using" (but be careful - only if it's not part of a larger word)
        -- This regex replaces "using." when it's followed by whitespace or end of line
        v_fixed_content := regexp_replace(
          v_content,
          'using\.(\s|$)',
          'using\1',
          'g'
        );
        
        -- Only update if content actually changed
        IF v_fixed_content != v_content THEN
          UPDATE document_versions
          SET content_snapshot = v_fixed_content
          WHERE id = v_record.id;
          
          RAISE NOTICE '✅ Fixed: Removed "." after "using"';
        ELSE
          RAISE NOTICE '⚠️  Pattern found but fix did not change content';
        END IF;
      ELSE
        RAISE NOTICE '✅ No "using." found';
      END IF;
    ELSE
      RAISE NOTICE 'ℹ️  Not a snapshot or no content';
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Check complete';
END $$;

