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

function edgeDebugEnabled(): boolean {
  return String(process.env.SG_EDGE_DEBUG || '').toLowerCase() === 'true';
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

function clip(s: string, max = 90): string {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function fmtNode(n: SemanticNode | undefined): string {
  if (!n) return '(missing node)';
  return `${n.id} (${n.type}) "${clip(n.text, 90)}"`;
}

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

DEFINITIONS + EXAMPLES:
- goal: an intended objective, question to investigate, or directive.
  Example: "Investigate how the observer effect challenges traditional views of reality."
- claim: an assertion presented as true (a thesis, conclusion, or strong statement).
  Example: "Measurement influences the state of a quantum system."
- evidence: an observation, datum, citation-like support, or result backing a claim.
  Example: "Table shows accuracy of 0.91 and latency of 120 ms."
- definition: a term explanation or a concept being defined/clarified.
  Example: "The observation paradox is where measurement appears to influence a quantum system."
- gap: an explicit uncertainty, open question, contradiction, or missing explanation.
  Example: "This raises questions about the fabric of the universe."

RULES:
- Create nodes from meaningful content blocks, including: paragraph, heading, list, table, figure, grid, math, code.
- Ignore purely presentational blocks (doc_title/doc_author/doc_date/raw) unless they contain an explicit goal/claim.
- A single block can yield multiple nodes. Prefer 1–3 nodes per meaningful block when possible.
- A block may yield zero nodes if it contains no meaningful semantic content.
- If a block contains multiple distinct semantics (e.g., a claim + definition + gap), you may emit multiple nodes for that one block.
- Each node MUST reference exactly one blockId (and optional span offsets) in bgRefs.
- Keep node.text concise (<= 280 chars).
- Node text MUST be self-contained: avoid ambiguous pronouns ("this", "that", "it", "they") unless you include the referent.
  Bad: "This phenomenon challenges our understanding of reality."
  Good: "The observation paradox challenges our conventional understanding of reality."
- For tables: prefer concise evidence nodes grounded in specific rows/metrics.
- For figures: use caption/alt text as evidence or claim when meaningful; skip single-letter captions unless supported by surrounding text in the same block.
- For grids: if the grid caption provides meaning and child figures are terse, create nodes from the grid caption (goal/claim/evidence) and/or from meaningful figure captions.
- Do NOT ignore non-English text: extract nodes from it the same way (you may keep node.text in the same language as the source block).
- Return JSON: {"nodes":[{"blockId":"...","from":0,"to":12,"type":"claim|evidence|definition|goal|gap","text":"..."}]}
- "from"/"to" are optional character offsets within that block's source text.

BLOCKS_JSON:
${JSON.stringify(blocks, null, 2)}`;

  // SG stability: default to low temperature (override via SG_NODES_TEMPERATURE env).
  const nodesTemp = clamp01(envFloat('SG_NODES_TEMPERATURE', 0.05));
  const rawNodes = await service.chatJson({ system: systemNodes, user: userNodes, temperature: nodesTemp }, model);
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

  const debug = edgeDebugEnabled();
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

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

    if (debug) {
      const maxCandidatesToPrint = 12;
      // eslint-disable-next-line no-console
      console.log(
        `[SG][edges] batch from=${fromIds.length} nodes=${subsetNodes.length} candidatesTopK=${topK}`
      );
      for (const fromId of fromIds) {
        const cands = candidateSubset[fromId] ?? [];
        // eslint-disable-next-line no-console
        console.log(`[SG][edges] FROM: ${fmtNode(nodeById.get(fromId))}`);
        // eslint-disable-next-line no-console
        console.log(
          `[SG][edges]   candidates(${cands.length}): ${cands
            .slice(0, maxCandidatesToPrint)
            .map((id) => fmtNode(nodeById.get(id)))
            .join(' | ')}${cands.length > maxCandidatesToPrint ? ' | …' : ''}`
        );
      }
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
- Hard cap: max 2 edges per FROM node (pick the strongest / most important relationships).
- Use consistent direction with these patterns:
  - evidence -> claim (claim depends on evidence)
  - definition -> claim (claim depends on definition/meaning)
  - gap -> goal (goal depends on gap/open question)
  - claim -> goal only if the goal is a direct consequence of the claim
- Only propose edges FROM the provided FROM_NODE_IDS (below).
- Only propose edges to nodes in that from-node's candidate list (provided below).
- Return JSON: {"edges":[{"from":"<nodeId>","to":"<nodeId>","weight":0.3}]}

FROM_NODE_IDS_JSON:
${JSON.stringify(fromIds, null, 2)}

NODES_JSON:
${JSON.stringify(subsetNodes, null, 2)}

CANDIDATES_BY_FROM_NODE_ID_JSON:
${JSON.stringify(candidateSubset, null, 2)}`;

    // SG stability: default to low temperature (override via SG_EDGES_TEMPERATURE env).
    const edgesTemp = clamp01(envFloat('SG_EDGES_TEMPERATURE', 0.05));
    const rawEdges = await service.chatJson({ system: systemEdges, user: userEdges, temperature: edgesTemp }, model);
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

    if (debug) {
      // eslint-disable-next-line no-console
      console.log(`[SG][edges] returnedEdges=${batchEdges.length}`);
      for (const e of batchEdges) {
        // eslint-disable-next-line no-console
        console.log(`[SG][edges]   ${fmtNode(nodeById.get(e.from))} -> ${fmtNode(nodeById.get(e.to))} (w=${e.weight})`);
      }
    }

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


