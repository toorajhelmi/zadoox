-- Add a dedicated column for Semantic Graph (SG) to avoid mixing large SG payloads
-- into the general-purpose documents.metadata JSON.

ALTER TABLE public.documents
ADD COLUMN IF NOT EXISTS semantic_graph jsonb;

-- Backfill: move any previously-stored SG from metadata into the dedicated column.
UPDATE public.documents
SET semantic_graph = COALESCE(semantic_graph, metadata -> 'semanticGraph')
WHERE semantic_graph IS NULL
  AND metadata ? 'semanticGraph';

-- Clean up metadata to avoid mixing SG with other metadata going forward.
UPDATE public.documents
SET metadata = metadata - 'semanticGraph'
WHERE metadata ? 'semanticGraph';


