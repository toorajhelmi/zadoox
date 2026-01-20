-- SG node embeddings cache (separate from documents.semantic_graph to avoid huge JSON bloat)
-- Stores embeddings keyed by (doc_id, node_id, text_hash). If node text changes, text_hash changes.

CREATE TABLE IF NOT EXISTS public.sg_node_embeddings (
  doc_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  text_hash text NOT NULL,
  vector jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, node_id, text_hash)
);

-- Optional index for lookups by doc+node
CREATE INDEX IF NOT EXISTS idx_sg_node_embeddings_doc_node
  ON public.sg_node_embeddings (doc_id, node_id);


