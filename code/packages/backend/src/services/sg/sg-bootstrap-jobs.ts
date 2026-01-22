import type { AIModel } from '../ai/ai-service.js';
import type { AIService } from '../ai/ai-service.js';
import type { SemanticGraph, SemanticNode } from '@zadoox/shared';
import { generateId } from '@zadoox/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DocumentService } from '../document-service.js';
import { buildSgConsistentGraphFromMiniGraphs, buildSgMiniGraphForBlocksOneShot } from './sg-builder.js';
import { ensureNodeEmbeddings } from './sg-embeddings-store.js';

export type SgBootstrapStage = 'nodes' | 'edges' | 'persist' | 'done' | 'error';

export interface SgBootstrapJobStatus {
  jobId: string;
  documentId: string;
  stage: SgBootstrapStage;
  doneBlocks: number;
  totalBlocks: number;
  nodeCount?: number;
  edgeCount?: number;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

type JobInternal = {
  status: SgBootstrapJobStatus;
  cancelled?: boolean;
};

const JOBS = new Map<string, JobInternal>();

function estTokens(text: string): number {
  // Approximate OpenAI tokenization (~4 chars/token) for chunk budgeting.
  const t = String(text ?? '');
  return Math.max(1, Math.ceil(t.length / 4));
}

function chunkBlocksByTokenBudget(params: {
  blocks: Array<{ id: string; type: string; text: string }>;
  targetTokens: number;
  overlapTokens: number;
}): Array<{ chunkId: string; start: number; end: number; blocks: Array<{ id: string; type: string; text: string }> }> {
  const { blocks, targetTokens, overlapTokens } = params;
  const out: Array<{ chunkId: string; start: number; end: number; blocks: Array<{ id: string; type: string; text: string }> }> = [];
  if (!blocks || blocks.length === 0) return out;

  let i = 0;
  let chunkIdx = 0;
  while (i < blocks.length) {
    let sum = 0;
    let end = i;
    while (end < blocks.length) {
      const b = blocks[end]!;
      const cost = estTokens(b.text) + 8; // small overhead per block
      if (end > i && sum + cost > targetTokens) break;
      sum += cost;
      end++;
    }
    if (end === i) end = Math.min(blocks.length, i + 1);

    const slice = blocks.slice(i, end);
    out.push({ chunkId: `c${chunkIdx}`, start: i, end, blocks: slice });

    // Determine overlap blocks (walk backwards from end).
    let overlap = 0;
    let overlapSum = 0;
    for (let k = end - 1; k >= i; k--) {
      const b = blocks[k]!;
      overlapSum += estTokens(b.text) + 8;
      if (overlapSum > overlapTokens) break;
      overlap++;
    }

    // Ensure progress.
    const chunkLen = end - i;
    if (overlap >= chunkLen) overlap = Math.max(0, chunkLen - 1);

    i = end - overlap;
    chunkIdx++;
  }

  return out;
}

export function getSgBootstrapJob(jobId: string): SgBootstrapJobStatus | null {
  return JOBS.get(jobId)?.status ?? null;
}

export function startSgBootstrapJob(params: {
  documentId: string;
  blocks: Array<{ id: string; type: string; text: string }>;
  service: AIService;
  supabase: SupabaseClient;
  userId: string;
  model?: AIModel;
}): { jobId: string } {
  const { documentId, blocks, service, supabase, userId, model } = params;

  const jobId = generateId();
  const now = new Date().toISOString();
  const internal: JobInternal = {
    status: {
      jobId,
      documentId,
      stage: 'nodes',
      doneBlocks: 0,
      totalBlocks: blocks.length,
      startedAt: now,
      updatedAt: now,
    },
  };
  JOBS.set(jobId, internal);

  const bump = (patch: Partial<SgBootstrapJobStatus>) => {
    const cur = internal.status;
    internal.status = {
      ...cur,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  };

  // Run async in the background.
  void (async () => {
    try {
      bump({ stage: 'nodes' });
      const miniNodes: SemanticNode[] = [];
      const miniEdges: Array<{ from: string; to: string; weight: number }> = [];

      // P1: chunk by token budget (avoid splitting blocks; include overlap).
      const targetTokens = Number(process.env.SG_CHUNK_TARGET_TOKENS || 1000);
      const overlapTokens = Number(process.env.SG_CHUNK_OVERLAP_TOKENS || 150);
      const chunks = chunkBlocksByTokenBudget({ blocks, targetTokens, overlapTokens });

      let doneBlocks = 0;
      for (const ch of chunks) {
        const mini = await buildSgMiniGraphForBlocksOneShot({
          service,
          chunkId: `${documentId}:${ch.chunkId}`,
          blocks: ch.blocks,
          model,
        });
        miniNodes.push(...mini.nodes);
        miniEdges.push(...mini.edges);
        doneBlocks = Math.max(doneBlocks, ch.end);
        bump({
          doneBlocks: Math.min(blocks.length, doneBlocks),
          nodeCount: miniNodes.length,
          edgeCount: miniEdges.length,
        });
      }

      // P2: global canonicalization/merge pass (also produces final edges).
      bump({ stage: 'edges' });
      const built = await buildSgConsistentGraphFromMiniGraphs({ service, miniNodes, miniEdges, model });
      bump({ nodeCount: built.sg.nodes.length, edgeCount: built.sg.edges.length });

      // Cache embeddings for canonical nodes (used later for incremental/queries).
      await ensureNodeEmbeddings({ supabase, service, docId: documentId, nodes: built.sg.nodes, model });

      bump({ stage: 'persist' });
      const sg: SemanticGraph = built.sg;

      const documentService = new DocumentService(supabase);
      await documentService.updateDocument(
        documentId,
        { semanticGraph: sg },
        userId,
        'ai-action',
        'SG bootstrap'
      );

      bump({ stage: 'done' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SG bootstrap failed';
      bump({ stage: 'error', error: msg });
    }
  })();

  return { jobId };
}


