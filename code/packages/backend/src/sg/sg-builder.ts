import { z } from 'zod';
import { createHash } from 'crypto';
import type { AIModel } from '../services/ai/ai-service.js';
import type { AIService } from '../services/ai/ai-service.js';
import type { SemanticEdge, SemanticNode, SemanticNodeType } from '@zadoox/shared';

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

const cosine = (a: number[], b: number[]) => {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom > 0 ? dot / denom : 0;
};

function stableAutoNodeId(params: { blockId: string; from?: number; to?: number; type: SemanticNodeType; text: string }): string {
  const { blockId, from, to, type, text } = params;
  const h = createHash('sha1').update(`${type}::${blockId}::${from ?? ''}::${to ?? ''}::${text}`, 'utf8').digest('hex').slice(0, 10);
  return `sg:auto:${blockId}:${from ?? ''}-${to ?? ''}:${type}:${h}`;
}

export async function buildSgNodesForBlocks(params: {
  service: AIService;
  blocks: SgBuildInputBlock[];
  model?: AIModel;
}): Promise<SemanticNode[]> {
  const { service, blocks, model } = params;

  const systemNodes = `You extract a Semantic Graph (SG) from document blocks.
Return ONLY JSON (no prose).`;
  const userNodes = `TASK: Extract semantic nodes from the provided blocks.

NODE TYPES (use exactly these): goal, claim, evidence, definition, gap

RULES:
- Create nodes only from meaningful content blocks (mostly paragraphs).
- A single block can yield multiple nodes.
- Each node MUST reference exactly one blockId (and optional span offsets) in bgRefs.
- Keep node.text concise (<= 280 chars).
- Return JSON: {"nodes":[{"blockId":"...","from":0,"to":12,"type":"claim|evidence|definition|goal|gap","text":"..."}]}
- "from"/"to" are optional character offsets within that block's source text.

BLOCKS_JSON:
${JSON.stringify(blocks, null, 2)}`;

  const rawNodes = await service.chatJson({ system: systemNodes, user: userNodes, temperature: 0.1 }, model);
  const parsedNodes = z
    .object({
      nodes: z.array(
        z.object({
          blockId: z.string().min(1),
          from: z.number().int().nonnegative().optional(),
          to: z.number().int().nonnegative().optional(),
          type: z.enum(['goal', 'claim', 'evidence', 'definition', 'gap']),
          text: z.string().min(1),
        })
      ),
    })
    .safeParse(rawNodes);

  const nodes = parsedNodes.success ? parsedNodes.data.nodes : [];
  const sgNodes: SemanticNode[] = nodes.map((n) => {
    const type = n.type as SemanticNodeType;
    const text = n.text.slice(0, 280);
    return {
      id: stableAutoNodeId({ blockId: n.blockId, from: n.from, to: n.to, type, text }),
      type,
      text,
      bgRefs: [{ blockId: n.blockId, from: n.from, to: n.to }],
    };
  });

  // De-dupe within this pass.
  const seen = new Set<string>();
  return sgNodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

export async function buildSgEdgesForNodes(params: {
  service: AIService;
  nodes: SemanticNode[];
  vectors?: number[][];
  model?: AIModel;
}): Promise<SemanticEdge[]> {
  const { service, nodes, vectors, model } = params;

  if (!nodes || nodes.length === 0) return [];

  // EV candidate selection (top‑K) for edges.
  const candidateMap: Record<string, string[]> = {};
  const vecs = vectors ?? (await service.embedTexts(nodes.map((n) => n.text), model));
  const topK = Math.max(6, Math.min(24, Math.ceil(nodes.length * 0.15)));
  for (let i = 0; i < nodes.length; i++) {
      const from = nodes[i]!.id;
      const scores: Array<{ id: string; s: number }> = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const s = cosine(vecs[i] ?? [], vecs[j] ?? []);
        scores.push({ id: nodes[j]!.id, s });
      }
      scores.sort((x, y) => y.s - x.s);
      candidateMap[from] = scores.slice(0, topK).map((x) => x.id);
  }

  const systemEdges = `You create directed edges for a Semantic Graph (SG).
Return ONLY JSON (no prose).`;
  const edges: SemanticEdge[] = [];

  // Batch "from" nodes to keep prompts bounded.
  const fromBatchSize = 25;
  for (let i = 0; i < nodes.length; i += fromBatchSize) {
    const fromBatch = nodes.slice(i, i + fromBatchSize);
    const fromIds = fromBatch.map((n) => n.id);

    const candidateIds = new Set<string>();
    for (const fromId of fromIds) {
      for (const toId of candidateMap[fromId] ?? []) candidateIds.add(toId);
    }

    const subsetIds = new Set<string>([...fromIds, ...candidateIds]);
    const subsetNodes = nodes.filter((n) => subsetIds.has(n.id));

    const candidateSubset: Record<string, string[]> = {};
    for (const fromId of fromIds) {
      candidateSubset[fromId] = (candidateMap[fromId] ?? []).filter((id) => subsetIds.has(id));
    }

    const userEdges = `TASK: Propose directed edges between nodes.

EDGE SEMANTICS:
- A -> B means "A impacts B / B depends on A"
- weight in [-1, 1]
  - > 0 => support strength
  - < 0 => contradiction strength

RULES:
- Prefer sparse edges (avoid connecting everything).
- Only create edges when there is a plausible relationship.
- Only propose edges FROM the provided FROM_NODE_IDS (below).
- Only propose edges to nodes in that from-node's candidate list (provided below).
- Return JSON: {"edges":[{"from":"<nodeId>","to":"<nodeId>","weight":0.3}]}

FROM_NODE_IDS_JSON:
${JSON.stringify(fromIds, null, 2)}

NODES_JSON:
${JSON.stringify(subsetNodes, null, 2)}

CANDIDATES_BY_FROM_NODE_ID_JSON:
${JSON.stringify(candidateSubset, null, 2)}`;

    const rawEdges = await service.chatJson({ system: systemEdges, user: userEdges, temperature: 0.2 }, model);
    const parsedEdges = z
      .object({
        edges: z.array(
          z.object({
            from: z.string().min(1),
            to: z.string().min(1),
            weight: z.number(),
          })
        ),
      })
      .safeParse(rawEdges);

    const batchEdges = parsedEdges.success
      ? parsedEdges.data.edges
          .filter((e) => e.from !== e.to)
          .filter((e) => fromIds.includes(e.from))
          .map((e) => ({ from: e.from, to: e.to, weight: clamp(e.weight) }))
      : [];

    edges.push(...batchEdges);
  }

  // De-dupe.
  const seen = new Set<string>();
  return edges.filter((e) => {
    const k = `${e.from}::${e.to}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export async function buildSemanticGraphForBlocks(params: {
  service: AIService;
  blocks: SgBuildInputBlock[];
  model?: AIModel;
}): Promise<SgBuildResult> {
  const { service, blocks, model } = params;
  const sgNodes = await buildSgNodesForBlocks({ service, blocks, model });
  const edges = await buildSgEdgesForNodes({ service, nodes: sgNodes, model });
  return {
    sg: {
      version: 1,
      nodes: sgNodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
  };
}


