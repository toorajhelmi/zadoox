-- Phase 17: Document Storage (LaTeX bundle + imports)
-- Add a dedicated JSONB column for LaTeX storage manifest/reference.

ALTER TABLE documents
ADD COLUMN IF NOT EXISTS latex jsonb;


