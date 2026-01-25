import { z } from 'zod';
import { createHash } from 'crypto';
import type { AIModel } from '../ai/ai-service.js';
import type { AIService } from '../ai/ai-service.js';
import type { SemanticEdge, SemanticNode } from '@zadoox/shared';

// Minimal SG v1 payload shape produced by the builder.
export type SgBuildInputBlock = { id: string; type: string; text: string };

export type SgBuildResult = {
  sg: {
    version: 1;
    nodes: SemanticNode[];
    edges: SemanticEdge[];
    updatedAt: string;
  };
};

const clamp = (w: number) => Math.max(-1, Math.min(1, w));

export type SgMiniGraph = {
  nodes: SemanticNode[];
  edges: SemanticEdge[];
};

function sgDebugEnabled(): boolean {
  return String(process.env.SG_DEBUG || '').toLowerCase() === 'true';
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function stableChunkNodeId(params: { chunkId: string; localId: string }): string {
  const { chunkId, localId } = params;
  const h = createHash('sha1').update(`${chunkId}::${localId}`, 'utf8').digest('hex').slice(0, 12);
  return `sg:chunk:${chunkId}:${h}`;
}

function stableCanonicalNodeId(params: { type: string; key: string }): string {
  const { type, key } = params;
  const h = createHash('sha1').update(`${type}::${key}`, 'utf8').digest('hex').slice(0, 12);
  return `sg:canon:${type}:${h}`;
}

/**
 * P1 (one-shot per chunk): build nodes + edges for a bounded block chunk.
 * Nodes MUST include BG span refs (blockId/from/to) so we can map back to IR ranges.
 *
 * This intentionally returns "chunk-stable" node IDs (sg:chunk:...) which will be canonicalized in P2.
 */
export async function buildSgMiniGraphForBlocksOneShot(params: {
  service: AIService;
  chunkId: string;
  blocks: SgBuildInputBlock[];
  model?: AIModel;
}): Promise<SgMiniGraph> {
  const { service, chunkId, blocks, model } = params;
  if (!blocks || blocks.length === 0) return { nodes: [], edges: [] };

  const system = `You extract a Semantic Graph (SG) from document blocks.
Return ONLY JSON (no prose).`;

  const user = `From the provided blocks, extract:
1) nodes: claims, gaps, goals, evidences, definitions
2) edges: a directed graph mapping node->node with weight in [-1,1] (positive=support, negative=contradiction).

Return ONLY valid JSON in this exact shape:
{
  "nodes":[{"localId":"N1","blockId":"...","from":0,"to":12,"type":"goal|claim|evidence|definition|gap","text":"..."}],
  "edges":[{"from":"N1","to":"N2","weight":0.4}]
}

Rules:
- Be comprehensive (prefer missing fewer over missing more), but avoid duplicates.
- Node text must be self-contained and concise (<= 280 chars).
- Each node MUST reference exactly one blockId, with optional from/to offsets within that block.
- Edges should capture meaningful dependency/impact; typical 1–4 edges per node if applicable.
- Use consistent direction patterns when relevant: evidence->claim, definition->claim, gap->goal/claim.

BLOCKS_JSON:
${JSON.stringify(blocks, null, 2)}`;

  const temp = clamp01(envFloat('SG_CHUNK_GRAPH_TEMPERATURE', 0.05));
  const raw = await service.chatJson({ system, user, temperature: temp }, model);
  const parsed = z
    .object({
      nodes: z.array(
        z.object({
          localId: z.string().min(1),
          blockId: z.string().min(1),
          from: z.number().int().nonnegative().optional(),
          to: z.number().int().nonnegative().optional(),
          type: z.enum(['goal', 'claim', 'evidence', 'definition', 'gap']),
          text: z.string().min(1),
        })
      ),
      edges: z
        .array(
          z.object({
            from: z.string().min(1),
            to: z.string().min(1),
            weight: z.number(),
          })
        )
        .optional(),
    })
    .safeParse(raw);

  if (!parsed.success) {
    if (sgDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.log(`[SG][chunk][parse-fail] chunkId=${chunkId}`);
      // eslint-disable-next-line no-console
      console.log(parsed.error?.issues ?? parsed.error);
      // eslint-disable-next-line no-console
      console.log(`[SG][chunk][raw] ${JSON.stringify(raw).slice(0, 4000)}`);
    }
    throw new Error(`SG chunk graph parse failed (chunkId=${chunkId}). Enable SG_DEBUG=true for details.`);
  }

  const nodesIn = parsed.data.nodes;
  const edgesIn = parsed.data.edges ?? [];

  const localToId = new Map<string, string>();
  const nodes: SemanticNode[] = [];
  for (const n of nodesIn) {
    const id = stableChunkNodeId({ chunkId, localId: n.localId });
    localToId.set(n.localId, id);
    const type = String(n.type);
    const text = n.text.slice(0, 280);
    nodes.push({
      id,
      type,
      text,
      bgRefs: [{ blockId: n.blockId, from: n.from, to: n.to }],
    });
  }

  const edges: SemanticEdge[] = [];
  const seen = new Set<string>();
  for (const e of edgesIn) {
    const from = localToId.get(e.from);
    const to = localToId.get(e.to);
    if (!from || !to || from === to) continue;
    const k = `${from}::${to}`;
    if (seen.has(k)) continue;
    seen.add(k);
    edges.push({ from, to, weight: clamp(e.weight) });
  }

  // De-dupe nodes by id (LLM may repeat localIds or duplicate semantics).
  const nodeSeen = new Set<string>();
  const dedupedNodes = nodes.filter((n) => {
    if (nodeSeen.has(n.id)) return false;
    nodeSeen.add(n.id);
    return true;
  });

  return { nodes: dedupedNodes, edges };
}

/**
 * P2 (global consistency): merge duplicates/synonyms/coreference across mini-graphs,
 * assign canonical keys, rewrite node text to be self-contained, and output a unified SG.
 *
 * IMPORTANT: provenance is preserved by UNION-ing bgRefs from all member nodes.
 */
export async function buildSgConsistentGraphFromMiniGraphs(params: {
  service: AIService;
  miniNodes: SemanticNode[];
  miniEdges: SemanticEdge[];
  model?: AIModel;
}): Promise<SgBuildResult> {
  const { service, miniNodes, miniEdges, model } = params;
  if (!miniNodes || miniNodes.length === 0) {
    return { sg: { version: 1, nodes: [], edges: [], updatedAt: new Date().toISOString() } };
  }

  const system = `You canonicalize and merge Semantic Graph nodes across chunks.
Return ONLY JSON (no prose).`;

  const user = `Unify the mini-graphs into one consistent document graph.

Do:
- Merge duplicates / synonyms / coreference ONLY when they truly mean the same thing (be conservative: avoid over-merging).
- Rewrite node text to be self-contained (resolve "this/it/the method" by naming the referent).
- Assign a canonical key per node (stable, machine-friendly).
- Produce a consistent canonical edge list with weights in [-1,1].

Return ONLY valid JSON in this exact shape:
{
  "canonicalNodes":[{"key":"...","type":"goal|claim|evidence|definition|gap","text":"...","memberIds":["..."]}],
  "canonicalEdges":[{"fromKey":"...","toKey":"...","weight":0.4}]
}

Rules:
- Keep canonical node text concise (<= 280 chars).
- Do NOT drop nodes unless they are exact duplicates after merging.
- Avoid duplicates and self-loops in edges.

MINI_NODES_JSON:
${JSON.stringify(miniNodes, null, 2)}

MINI_EDGES_JSON:
${JSON.stringify(miniEdges, null, 2)}`;

  const temp = clamp01(envFloat('SG_CANONICALIZE_TEMPERATURE', 0.05));
  const raw = await service.chatJson({ system, user, temperature: temp }, model);
  const parsed = z
    .object({
      canonicalNodes: z.array(
        z.object({
          key: z.string().min(1),
          type: z.enum(['goal', 'claim', 'evidence', 'definition', 'gap']),
          text: z.string().min(1),
          memberIds: z.array(z.string().min(1)).min(1),
        })
      ),
      canonicalEdges: z
        .array(
          z.object({
            fromKey: z.string().min(1),
            toKey: z.string().min(1),
            weight: z.number(),
          })
        )
        .optional(),
    })
    .safeParse(raw);

  if (!parsed.success) {
    if (sgDebugEnabled()) {
      // eslint-disable-next-line no-console
      console.log('[SG][canon][parse-fail]');
      // eslint-disable-next-line no-console
      console.log(parsed.error?.issues ?? parsed.error);
      // eslint-disable-next-line no-console
      console.log(`[SG][canon][raw] ${JSON.stringify(raw).slice(0, 4000)}`);
    }
    throw new Error('SG canonicalization parse failed. Enable SG_DEBUG=true for details.');
  }

  const canonNodesIn = parsed.data.canonicalNodes;
  const canonEdgesIn = parsed.data.canonicalEdges ?? [];

  const miniById = new Map(miniNodes.map((n) => [n.id, n]));

  const keyToId = new Map<string, string>();
  const nodes: SemanticNode[] = canonNodesIn.map((n) => {
    const type = String(n.type);
    const key = n.key.trim();
    const id = stableCanonicalNodeId({ type, key });
    keyToId.set(key, id);

    // UNION provenance (bgRefs) across member nodes.
    const refs: Array<{ blockId: string; from?: number; to?: number }> = [];
    const refSeen = new Set<string>();
    for (const mid of n.memberIds) {
      const mn = miniById.get(mid);
      for (const r of mn?.bgRefs ?? []) {
        const k = `${r.blockId}::${r.from ?? ''}::${r.to ?? ''}`;
        if (refSeen.has(k)) continue;
        refSeen.add(k);
        refs.push({ blockId: r.blockId, from: r.from, to: r.to });
      }
    }

    return {
      id,
      type,
      text: n.text.slice(0, 280),
      bgRefs: refs.length > 0 ? refs : undefined,
    };
  });

  const edges: SemanticEdge[] = [];
  const edgeSeen = new Set<string>();
  for (const e of canonEdgesIn) {
    const from = keyToId.get(e.fromKey.trim());
    const to = keyToId.get(e.toKey.trim());
    if (!from || !to || from === to) continue;
    const k = `${from}::${to}`;
    if (edgeSeen.has(k)) continue;
    edgeSeen.add(k);
    edges.push({ from, to, weight: clamp(e.weight) });
  }

  return {
    sg: {
      version: 1,
      nodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
  };
}


