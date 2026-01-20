import type { AIModel } from '../services/ai/ai-service.js';
import type { AIService } from '../services/ai/ai-service.js';
import type { SemanticGraph, SemanticNode } from '@zadoox/shared';
import { generateId } from '@zadoox/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DocumentService } from '../services/document-service.js';
import { buildSgEdgesForNodes, buildSgNodesForBlocks } from './sg-builder.js';
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
      const allNodes: SemanticNode[] = [];

      // Fixed chunk size lives in SG builder (not doc type).
      const nodesChunkSize = 40;
      for (let i = 0; i < blocks.length; i += nodesChunkSize) {
        const chunk = blocks.slice(i, i + nodesChunkSize);
        const nodes = await buildSgNodesForBlocks({ service, blocks: chunk, model });
        allNodes.push(...nodes);
        // Atomic with node creation: compute+cache embeddings for newly created nodes.
        await ensureNodeEmbeddings({ supabase, service, docId: documentId, nodes, model });
        bump({ doneBlocks: Math.min(blocks.length, i + chunk.length), nodeCount: allNodes.length });
      }

      bump({ stage: 'edges' });
      const vectors = await ensureNodeEmbeddings({ supabase, service, docId: documentId, nodes: allNodes, model });
      const edges = await buildSgEdgesForNodes({ service, nodes: allNodes, vectors, model });
      bump({ edgeCount: edges.length });

      bump({ stage: 'persist' });
      const sg: SemanticGraph = {
        version: 1,
        nodes: allNodes,
        edges,
        updatedAt: new Date().toISOString(),
      };

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


