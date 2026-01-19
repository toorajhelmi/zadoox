'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { SemanticGraph } from '@zadoox/shared';
import { SG_METADATA_KEY } from './semantic-graph-keys';

export function useSemanticGraph(params: {
  documentMetadata: Record<string, any>;
  saveMetadataPatch: (patch: Record<string, any>, changeType?: 'auto-save' | 'ai-action') => void;
  enabled?: boolean;
}) {
  const { documentMetadata, saveMetadataPatch, enabled = true } = params;

  const loaded = useMemo(() => {
    const sg = (documentMetadata as any)?.[SG_METADATA_KEY] as SemanticGraph | undefined;
    return sg ?? null;
  }, [documentMetadata]);

  // Use a ref to avoid triggering rerenders on every metadata change (important for editor history stability).
  const sgRef = useRef<SemanticGraph | null>(null);

  // Keep in-memory SG in sync with persisted metadata.
  useEffect(() => {
    if (!enabled) return;
    sgRef.current = loaded;
  }, [enabled, loaded]);

  const persist = useCallback(
    (next: SemanticGraph, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (!enabled) return;
      saveMetadataPatch({ [SG_METADATA_KEY]: next }, changeType);
    },
    [enabled, saveMetadataPatch]
  );

  const setAndPersist = useCallback(
    (next: SemanticGraph, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (!enabled) return;
      sgRef.current = next;
      persist(next, changeType);
    },
    [enabled, persist]
  );

  const get = useCallback(() => sgRef.current, []);

  return { get, persist, setAndPersist };
}


