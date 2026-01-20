import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { AIModel } from '../services/ai/ai-service.js';
import type { AIService } from '../services/ai/ai-service.js';
import type { SemanticNode } from '@zadoox/shared';

type Row = {
  doc_id: string;
  node_id: string;
  text_hash: string;
  vector: number[];
};

export function hashText(text: string): string {
  return createHash('sha256').update(String(text ?? ''), 'utf8').digest('hex');
}

async function fetchRows(params: {
  supabase: SupabaseClient;
  docId: string;
  nodeIds: string[];
}): Promise<Array<Pick<Row, 'node_id' | 'text_hash' | 'vector'>>> {
  const { supabase, docId, nodeIds } = params;
  if (nodeIds.length === 0) return [];

  // Supabase IN() can have practical size limits; batch.
  const batchSize = 200;
  const out: Array<Pick<Row, 'node_id' | 'text_hash' | 'vector'>> = [];
  for (let i = 0; i < nodeIds.length; i += batchSize) {
    const batch = nodeIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('sg_node_embeddings')
      .select('node_id,text_hash,vector')
      .eq('doc_id', docId)
      .in('node_id', batch);
    if (error) throw new Error(`Failed to load SG embeddings: ${error.message}`);
    out.push(...(((data as unknown) as Array<Pick<Row, 'node_id' | 'text_hash' | 'vector'>>) ?? []));
  }
  return out;
}

export async function ensureNodeEmbeddings(params: {
  supabase: SupabaseClient;
  service: AIService;
  docId: string;
  nodes: SemanticNode[];
  model?: AIModel;
}): Promise<number[][]> {
  const { supabase, service, docId, nodes, model } = params;
  const nodeIds = nodes.map((n) => n.id);
  const wantHashById = new Map<string, string>();
  for (const n of nodes) wantHashById.set(n.id, hashText(n.text));

  const existing = await fetchRows({ supabase, docId, nodeIds });
  const existingById = new Map<string, { textHash: string; vector: number[] }>();
  for (const r of existing) {
    if (!r?.node_id || !r?.text_hash || !Array.isArray(r?.vector)) continue;
    existingById.set(String(r.node_id), { textHash: String(r.text_hash), vector: r.vector as number[] });
  }

  const missing: Array<{ id: string; text: string; textHash: string }> = [];
  for (const n of nodes) {
    const want = wantHashById.get(n.id) ?? '';
    const hit = existingById.get(n.id);
    if (hit && hit.textHash === want) continue;
    missing.push({ id: n.id, text: n.text, textHash: want });
  }

  if (missing.length > 0) {
    const vectors = await service.embedTexts(
      missing.map((m) => m.text),
      model
    );
    const rows: Row[] = missing.map((m, idx) => ({
      doc_id: docId,
      node_id: m.id,
      text_hash: m.textHash,
      vector: (vectors[idx] ?? []) as number[],
    }));

    const { error } = await supabase
      .from('sg_node_embeddings')
      .upsert(rows, { onConflict: 'doc_id,node_id,text_hash' });
    if (error) throw new Error(`Failed to store SG embeddings: ${error.message}`);

    for (const r of rows) {
      existingById.set(r.node_id, { textHash: r.text_hash, vector: r.vector });
    }
  }

  // Return vectors aligned with `nodes` order.
  return nodes.map((n) => existingById.get(n.id)?.vector ?? []);
}


