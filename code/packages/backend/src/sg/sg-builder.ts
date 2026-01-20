import { z } from 'zod';
import type { AIModel } from '../services/ai/ai-service.js';
import type { AIService } from '../services/ai/ai-service.js';

// Minimal SG v1 payload shape produced by the builder.
export type SgBuildInputBlock = { id: string; type: string; text: string };

export type SgBuildResult = {
  sg: {
    version: 1;
    nodes: Array<{ id: string; type: 'goal' | 'claim' | 'evidence' | 'definition' | 'gap'; text: string; bgRefs?: Array<{ blockId: string }> }>;
    edges: Array<{ from: string; to: string; weight: number }>;
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

export async function buildSemanticGraphForBlocks(params: {
  service: AIService;
  blocks: SgBuildInputBlock[];
  model?: AIModel;
}): Promise<SgBuildResult> {
  const { service, blocks, model } = params;

  const systemNodes = `You extract a Semantic Graph (SG) from document blocks.
Return ONLY JSON (no prose).`;
  const userNodes = `TASK: Extract semantic nodes from the provided blocks.

NODE TYPES (use exactly these): goal, claim, evidence, definition, gap

RULES:
- Create nodes only from meaningful content blocks (mostly paragraphs).
- Each node MUST reference exactly one blockId in bgRefs (v1).
- Keep node.text concise (<= 280 chars).
- Return JSON: {"nodes":[{"blockId":"...","type":"claim|evidence|definition|goal|gap","text":"..."}]}

BLOCKS_JSON:
${JSON.stringify(blocks, null, 2)}`;

  const rawNodes = await service.chatJson({ system: systemNodes, user: userNodes, temperature: 0.1 }, model);
  const parsedNodes = z
    .object({
      nodes: z.array(
        z.object({
          blockId: z.string().min(1),
          type: z.enum(['goal', 'claim', 'evidence', 'definition', 'gap']),
          text: z.string().min(1),
        })
      ),
    })
    .safeParse(rawNodes);

  const nodes = parsedNodes.success ? parsedNodes.data.nodes : [];
  const sgNodes = nodes.map((n) => ({
    id: `bg:${n.blockId}`,
    type: n.type,
    text: n.text.slice(0, 280),
    bgRefs: [{ blockId: n.blockId }],
  }));

  // EV candidate selection (top‑K) for edges.
  const candidateMap: Record<string, string[]> = {};
  try {
    const vecs = await service.embedTexts(sgNodes.map((n) => n.text), model);
    const topK = Math.max(5, Math.min(30, Math.ceil(sgNodes.length * 0.2)));
    for (let i = 0; i < sgNodes.length; i++) {
      const from = sgNodes[i]!.id;
      const scores: Array<{ id: string; s: number }> = [];
      for (let j = 0; j < sgNodes.length; j++) {
        if (i === j) continue;
        const s = cosine(vecs[i] ?? [], vecs[j] ?? []);
        scores.push({ id: sgNodes[j]!.id, s });
      }
      scores.sort((x, y) => y.s - x.s);
      candidateMap[from] = scores.slice(0, topK).map((x) => x.id);
    }
  } catch {
    for (const n of sgNodes) {
      candidateMap[n.id] = sgNodes.filter((m) => m.id !== n.id).map((m) => m.id);
    }
  }

  const systemEdges = `You create directed edges for a Semantic Graph (SG).
Return ONLY JSON (no prose).`;
  const userEdges = `TASK: Propose directed edges between nodes.

EDGE SEMANTICS:
- A -> B means "A impacts B / B depends on A"
- weight in [-1, 1]
  - > 0 => support strength
  - < 0 => contradiction strength

RULES:
- Prefer sparse edges (avoid connecting everything).
- Only create edges when there is a plausible relationship.
- Only propose edges from a node to its candidate list (provided below).
- Return JSON: {"edges":[{"from":"<nodeId>","to":"<nodeId>","weight":0.3}]}

NODES_JSON:
${JSON.stringify(sgNodes, null, 2)}

CANDIDATES_BY_FROM_NODE_ID_JSON:
${JSON.stringify(candidateMap, null, 2)}`;

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

  const edges = parsedEdges.success
    ? parsedEdges.data.edges
        .filter((e) => e.from !== e.to)
        .map((e) => ({ from: e.from, to: e.to, weight: clamp(e.weight) }))
    : [];

  return {
    sg: {
      version: 1,
      nodes: sgNodes,
      edges,
      updatedAt: new Date().toISOString(),
    },
  };
}


