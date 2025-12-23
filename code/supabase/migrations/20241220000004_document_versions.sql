-- Document Versioning System
-- Migration: document_versions
-- Description: Creates tables for delta-based document versioning

-- ============================================
-- Document Versions Table
-- ============================================
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot TEXT, -- Full content if this is a snapshot version
  content_delta JSONB, -- Delta operations if this is a delta version
  is_snapshot BOOLEAN NOT NULL DEFAULT false, -- true if full snapshot, false if delta
  snapshot_base_version INTEGER, -- version number this delta is based on (if delta)
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_description TEXT, -- Optional description of changes
  change_type TEXT NOT NULL DEFAULT 'auto-save' CHECK (
    change_type IN ('manual-save', 'auto-save', 'ai-action', 'milestone', 'rollback')
  ),
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional metadata (word count, etc.)
  
  -- Ensure version numbers are unique per document
  CONSTRAINT document_versions_unique_version UNIQUE (document_id, version_number)
);

-- Enable Row Level Security
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Indexes for document_versions
CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_document_versions_version_number ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_is_snapshot ON document_versions(document_id, is_snapshot) WHERE is_snapshot = true;

-- ============================================
-- Document Version Metadata Table (for quick queries)
-- ============================================
CREATE TABLE IF NOT EXISTS document_version_metadata (
  document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
  current_version INTEGER NOT NULL DEFAULT 1,
  last_snapshot_version INTEGER, -- Last version that was a full snapshot
  total_versions INTEGER NOT NULL DEFAULT 1,
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE document_version_metadata ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for document_versions
-- ============================================
-- Users can view versions of documents they have access to
CREATE POLICY "Users can view versions of their documents"
  ON document_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
      AND d.author_id = auth.uid()
    )
  );

-- Users can create versions for their documents
CREATE POLICY "Users can create versions of their documents"
  ON document_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_versions.document_id
      AND d.author_id = auth.uid()
    )
    AND author_id = auth.uid()
  );

-- ============================================
-- RLS Policies for document_version_metadata
-- ============================================
-- Users can view metadata for documents they have access to
CREATE POLICY "Users can view version metadata of their documents"
  ON document_version_metadata
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_version_metadata.document_id
      AND d.author_id = auth.uid()
    )
  );

-- Users can update metadata for their documents
CREATE POLICY "Users can update version metadata of their documents"
  ON document_version_metadata
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM documents d
      WHERE d.id = document_version_metadata.document_id
      AND d.author_id = auth.uid()
    )
  );

-- ============================================
-- Function to initialize version metadata for existing documents
-- ============================================
CREATE OR REPLACE FUNCTION initialize_document_version_metadata()
RETURNS void AS $$
BEGIN
  -- Create metadata entries for all existing documents
  INSERT INTO document_version_metadata (document_id, current_version, last_snapshot_version, total_versions, last_modified_at, last_modified_by)
  SELECT 
    id,
    version,
    version, -- Use current version as initial snapshot
    1,
    updated_at,
    author_id
  FROM documents
  ON CONFLICT (document_id) DO NOTHING;
  
  -- Create initial version snapshot for all existing documents
  INSERT INTO document_versions (document_id, version_number, content_snapshot, is_snapshot, author_id, change_type, created_at)
  SELECT 
    id,
    version,
    content,
    true,
    author_id,
    'milestone',
    created_at
  FROM documents
  ON CONFLICT (document_id, version_number) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Run initialization
SELECT initialize_document_version_metadata();

-- ============================================
-- Trigger to update version metadata when new version is created
-- ============================================
CREATE OR REPLACE FUNCTION update_version_metadata()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_version_metadata (
    document_id,
    current_version,
    last_snapshot_version,
    total_versions,
    last_modified_at,
    last_modified_by,
    updated_at
  )
  VALUES (
    NEW.document_id,
    NEW.version_number,
    CASE WHEN NEW.is_snapshot THEN NEW.version_number ELSE NULL END,
    1,
    NEW.created_at,
    NEW.author_id,
    NOW()
  )
  ON CONFLICT (document_id) DO UPDATE SET
    current_version = NEW.version_number,
    last_snapshot_version = CASE 
      WHEN NEW.is_snapshot THEN NEW.version_number 
      ELSE document_version_metadata.last_snapshot_version 
    END,
    total_versions = document_version_metadata.total_versions + 1,
    last_modified_at = NEW.created_at,
    last_modified_by = NEW.author_id,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_version_metadata_on_insert
  AFTER INSERT ON document_versions
  FOR EACH ROW
  EXECUTE FUNCTION update_version_metadata();

