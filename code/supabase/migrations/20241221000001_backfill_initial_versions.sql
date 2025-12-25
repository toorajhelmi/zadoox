-- Backfill Initial Versions for Existing Documents
-- Migration: backfill_initial_versions
-- Description: Ensures ALL existing documents have initial versions and metadata (STRICT RULE compliance)
-- This fixes existing data directly in the database rather than adding workarounds to code

-- ============================================
-- Step 1: Ensure all documents have version metadata
-- ============================================
INSERT INTO document_version_metadata (
  document_id,
  current_version,
  last_snapshot_version,
  total_versions,
  last_modified_at,
  last_modified_by,
  updated_at
)
SELECT 
  id,
  version,
  version, -- Initial version is always a snapshot
  1,
  updated_at,
  author_id,
  NOW()
FROM documents
WHERE id NOT IN (SELECT document_id FROM document_version_metadata)
ON CONFLICT (document_id) DO NOTHING;

-- ============================================
-- Step 2: Create initial version for documents missing them
-- ============================================
INSERT INTO document_versions (
  document_id,
  version_number,
  content_snapshot,
  is_snapshot,
  author_id,
  change_type,
  change_description,
  created_at,
  metadata
)
SELECT 
  d.id,
  d.version,
  COALESCE(d.content, ''), -- Always create version, even if content is empty (STRICT RULE)
  true, -- Initial version is always a snapshot
  d.author_id,
  'milestone',
  'Initial document version (backfilled)',
  d.created_at,
  jsonb_build_object(
    'wordCount', CASE 
      WHEN trim(COALESCE(d.content, '')) = '' THEN 0
      ELSE array_length(string_to_array(trim(d.content), ' '), 1)
    END,
    'characterCount', length(COALESCE(d.content, ''))
  )
FROM documents d
WHERE d.id NOT IN (
  SELECT DISTINCT document_id 
  FROM document_versions
)
ON CONFLICT (document_id, version_number) DO NOTHING;

