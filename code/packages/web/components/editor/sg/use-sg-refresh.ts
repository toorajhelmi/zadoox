'use client';

import { useEffect, useRef } from 'react';
import type { DocumentNode, IrDelta, SemanticGraph } from '@zadoox/shared';
import { getSgDocTypeProfile } from '@zadoox/shared';
import { extractBlockGraphFromIr } from './bg-extract';
import { api } from '@/lib/api/client';

export function useSgRefresh(params: {
  documentId: string;
  ir: DocumentNode | null;
  delta: IrDelta | null;
  semanticGraph: SemanticGraph | null;
  saveSemanticGraphPatch: (sg: SemanticGraph, changeType?: 'auto-save' | 'ai-action') => void;
  documentStyle?: 'academic' | 'whitepaper' | 'technical-docs' | 'blog' | 'other';
  enabled?: boolean;
}) {
  const { documentId, ir, delta, semanticGraph, saveSemanticGraphPatch, documentStyle, enabled = true } = params;

  const lastRunAtRef = useRef<number>(0);
  const runsInWindowRef = useRef<{ windowStartMs: number; count: number }>({ windowStartMs: 0, count: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastErrorLogAtRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    if (!ir) return;

    // Basic budget/rate limiting: max 10 refreshes / minute and min 1500ms between runs.
    const now = Date.now();
    const windowMs = 60_000;
    const minIntervalMs = 1500;
    const budget = runsInWindowRef.current;
    if (now - budget.windowStartMs > windowMs) {
      budget.windowStartMs = now;
      budget.count = 0;
    }

    const schedule = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const t = Date.now();
        if (t - lastRunAtRef.current < minIntervalMs) return;
        if (budget.count >= 10) return;

        // Major edit heuristic: lots of adds/removes/changes => rebuild.
        const changeCount = delta ? delta.added.length + delta.removed.length + delta.changed.length : 999;
        const major = changeCount >= 25;

        const bg = extractBlockGraphFromIr(ir);
        const prev = semanticGraph ?? undefined;
        // If there's an existing non-auto SG, do not overwrite it (v1 safety).
        if (prev && !prev.nodes.every((n) => n.id.startsWith('sg:auto:'))) return;

        // Prefer LLM builder (SG is always built; backend may no-op if AI is unavailable).
        const profile = getSgDocTypeProfile(documentStyle);

        const buildWithLlm = async (): Promise<SemanticGraph | null> => {
          // If SG doesn't exist yet, bootstrap is responsible (backend job). Don't do incremental refresh.
          if (!semanticGraph) return null;
          // Build a bounded working slice centered around the first changed node id we see.
          const changed = delta ? [...delta.added, ...delta.changed] : [];
          const anchorId = changed.find((id) => bg.blocks.some((b) => b.id === id)) ?? bg.blocks[0]?.id;
          if (!anchorId) return null;

          const idx = bg.blocks.findIndex((b) => b.id === anchorId);
          const half = Math.max(4, Math.floor(profile.maxBlocksPerSection / 2));
          const from = Math.max(0, idx - half);
          const to = Math.min(bg.blocks.length, idx + half);
          const slice = bg.blocks.slice(from, to);

          // Ask backend to build SG for this slice.
          const res = await api.sg.build({
            documentId,
            blocks: slice.map((b) => ({ id: b.id, type: b.type, text: b.text })),
          });
          const sliceSg = (res as any)?.sg as SemanticGraph | null;
          if (!sliceSg) return null;

          // Incremental merge: replace nodes/edges that belong to slice blockIds.
          const sliceBlockIds = new Set(slice.map((b) => b.id));
          const base: SemanticGraph = prev ?? { version: 1, nodes: [], edges: [], updatedAt: new Date().toISOString() };

          const keptNodes = base.nodes.filter(
            (n) => !(n.id.startsWith('sg:auto:') && n.bgRefs?.some((r) => sliceBlockIds.has(r.blockId)))
          );
          const keptNodeIds = new Set(keptNodes.map((n) => n.id));
          const incomingSliceNodeIds = new Set((sliceSg.nodes ?? []).map((n) => n.id));

          const keptEdges = (base.edges ?? []).filter(
            (e) => !incomingSliceNodeIds.has(e.from) && !incomingSliceNodeIds.has(e.to)
          );

          const merged: SemanticGraph = {
            version: 1,
            nodes: [...keptNodes, ...(sliceSg.nodes ?? [])],
            edges: [...keptEdges, ...(sliceSg.edges ?? [])].filter((e) => keptNodeIds.has(e.from) || incomingSliceNodeIds.has(e.from)),
            provenance: sliceSg.provenance ?? base.provenance,
            updatedAt: new Date().toISOString(),
          };

          return merged;
        };

        const run = async () => {
          let next: SemanticGraph | null = null;
          try {
            next = await buildWithLlm();
          } catch (err: unknown) {
            // Don't spam logs; but do surface *something* so we can debug why SG isn't showing up.
            const now = Date.now();
            if (now - lastErrorLogAtRef.current > 10_000) {
              lastErrorLogAtRef.current = now;
              // eslint-disable-next-line no-console
              console.warn('[SG] build failed:', err);
            }
          }

          // LLM-only: if SG builder isn't available, do nothing.
          if (!next) return;
          budget.count += 1;
          lastRunAtRef.current = t;
          saveSemanticGraphPatch(next, 'auto-save');
        };

        void run();
      }, 1000);
    };

    schedule();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    };
  }, [enabled, documentId, ir, delta, semanticGraph, saveSemanticGraphPatch, documentStyle]);
}


