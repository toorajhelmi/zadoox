'use client';

import type { ConceptionChatTurn, ConceptionProvenanceRef, ConceptionState } from '@zadoox/shared';
import { api } from '@/lib/api/client';
import { BeliefPolicyV0 } from './strategy/belief-policy-v0';
import { TwoStageV0 } from './strategy/two-stage-v0';
import type { ConceptionStrategy } from './strategy/types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function provTurn(id: string): ConceptionProvenanceRef {
  return { kind: 'chat_turn', id };
}

function keepProvRef(ref: ConceptionProvenanceRef, keepTurnIds: Set<string>): boolean {
  if (ref.kind === 'chat_turn') return keepTurnIds.has(ref.id);
  if (ref.kind === 'chat_turn_range') return keepTurnIds.has(ref.fromId) && keepTurnIds.has(ref.toId);
  return false;
}

function pruneIdeaGraphByTurns(conception: ConceptionState, keepTurnIds: Set<string>): void {
  const ig = conception.ideaGraph;
  if (!ig) return;

  const keepNode = (n: any): boolean => {
    const prov = Array.isArray(n?.provenance) ? (n.provenance as ConceptionProvenanceRef[]) : null;
    if (!prov || prov.length === 0) return true;
    return prov.some((r) => keepProvRef(r, keepTurnIds));
  };

  const keptNodes = (ig.nodes ?? []).filter(keepNode);
  const keptNodeIds = new Set(keptNodes.map((n) => n.id));

  const cleanProv = (prov: unknown): ConceptionProvenanceRef[] | undefined => {
    const arr = Array.isArray(prov) ? (prov as ConceptionProvenanceRef[]) : [];
    const next = arr.filter((r) => keepProvRef(r, keepTurnIds));
    return next.length > 0 ? next : undefined;
  };

  for (const n of keptNodes) {
    n.provenance = cleanProv((n as any).provenance);
  }

  const keptEdges = (ig.edges ?? [])
    .filter((e) => keptNodeIds.has(e.src) && keptNodeIds.has(e.dst))
    .filter((e: any) => {
      const prov = Array.isArray(e?.provenance) ? (e.provenance as ConceptionProvenanceRef[]) : null;
      if (!prov || prov.length === 0) return true;
      return prov.some((r) => keepProvRef(r, keepTurnIds));
    });

  for (const e of keptEdges as any[]) {
    e.provenance = cleanProv(e.provenance);
  }

  conception.ideaGraph = { ...ig, nodes: keptNodes, edges: keptEdges };
}

export function deleteTurnsFrom(conception: ConceptionState, fromTurnId: string): ConceptionState {
  const turns = conception.turns ?? [];
  const idx = turns.findIndex((t) => t.id === fromTurnId);
  if (idx < 0) return conception;
  const keptTurns = turns.slice(0, idx);
  const keepTurnIds = new Set(keptTurns.map((t) => t.id));
  const next: ConceptionState = {
    ...conception,
    turns: keptTurns,
    updatedAt: new Date().toISOString(),
  };
  pruneIdeaGraphByTurns(next, keepTurnIds);
  return next;
}

function normalizeLabel(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]+/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function mergeExtractedIg(next: ConceptionState, userTurnId: string, extracted: { nodes: unknown[]; edges: unknown[] }) {
  const ig = next.ideaGraph ?? { nodes: [], edges: [] };
  ig.nodes = ig.nodes ?? [];
  ig.edges = ig.edges ?? [];

  const existingByNorm = new Map<string, { id: string; idx: number }>();
  for (let i = 0; i < ig.nodes.length; i++) {
    const n = ig.nodes[i]!;
    existingByNorm.set(normalizeLabel(n.label), { id: n.id, idx: i });
  }

  const addedOrMatchedIds: string[] = [];

  const nodes = Array.isArray(extracted.nodes) ? extracted.nodes : [];
  for (const raw of nodes) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const label = String(obj.label ?? '').trim();
    const norm = normalizeLabel(label);
    if (!norm || norm.length < 4) continue;
    // Filter obvious “junk” labels defensively.
    if (/^(lets|let us|discussion|thoughts|question|help|idea)$/.test(norm)) continue;

    const state = (String(obj.state ?? 'topic') as any) as 'topic' | 'question' | 'constraint' | 'assumption' | 'hypothesis' | 'requirement' | 'example';
    const confidence = clamp01(Number(obj.confidence ?? 0.6));
    const facets = Array.isArray(obj.facets) ? obj.facets.map((x) => String(x)).filter(Boolean).slice(0, 6) : [];

    const status: 'accepted' | 'proposed' =
      confidence >= 0.65 ? 'accepted' : 'proposed';

    const existing = existingByNorm.get(norm);
    if (existing) {
      const n = ig.nodes[existing.idx]!;
      n.weight = clamp01(Number(n.weight ?? 0.5) + 0.08);
      n.confidence = clamp01(Math.max(Number(n.confidence ?? 0), confidence));
      n.status = n.status ?? status;
      if (state && !n.state) n.state = state;
      if (facets.length > 0) n.facets = Array.from(new Set([...(n.facets ?? []), ...facets]));
      n.provenance = [...(n.provenance ?? []), { kind: 'chat_turn', id: userTurnId }];
      addedOrMatchedIds.push(n.id);
      continue;
    }

    const id = `i-${generateId()}`;
    ig.nodes.push({
      id,
      label,
      weight: clamp01(0.45 + confidence * 0.35),
      status,
      confidence,
      state,
      ...(facets.length > 0 ? { facets } : {}),
      provenance: [{ kind: 'chat_turn', id: userTurnId }],
    });
    existingByNorm.set(norm, { id, idx: ig.nodes.length - 1 });
    addedOrMatchedIds.push(id);
  }

  const edges = Array.isArray(extracted.edges) ? extracted.edges : [];
  for (const raw of edges) {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const srcLabel = String(obj.srcLabel ?? '').trim();
    const dstLabel = String(obj.dstLabel ?? '').trim();
    const src = existingByNorm.get(normalizeLabel(srcLabel))?.id ?? null;
    const dst = existingByNorm.get(normalizeLabel(dstLabel))?.id ?? null;
    if (!src || !dst || src === dst) continue;
    const confidence = clamp01(Number(obj.confidence ?? 0.55));
    const status: 'accepted' | 'proposed' = confidence >= 0.65 ? 'accepted' : 'proposed';

    const existing = ig.edges.find((e) => e.src === src && e.dst === dst);
    if (existing) {
      existing.weight = clamp01(Number(existing.weight ?? 0.35) + 0.05);
      existing.confidence = clamp01(Math.max(Number(existing.confidence ?? 0), confidence));
      existing.status = existing.status ?? status;
      existing.provenance = [...(existing.provenance ?? []), { kind: 'chat_turn', id: userTurnId }];
      continue;
    }

    ig.edges.push({
      src,
      dst,
      weight: clamp01(0.25 + confidence * 0.35),
      confidence,
      status,
      provenance: [{ kind: 'chat_turn', id: userTurnId }],
    });
  }

  next.ideaGraph = ig;
}

function mergeTwoStageKps(
  next: ConceptionState,
  latestUserTurnId: string,
  kps: unknown
): void {
  const obj = (kps ?? {}) as Record<string, unknown>;
  const add = Array.isArray(obj.add) ? (obj.add as unknown[]) : [];
  const strengthen = Array.isArray(obj.strengthen) ? (obj.strengthen as unknown[]) : [];
  const supersede = Array.isArray(obj.supersede) ? (obj.supersede as unknown[]) : [];
  const edges = Array.isArray(obj.edges) ? (obj.edges as unknown[]) : [];

  const ig = next.ideaGraph ?? { nodes: [], edges: [] };
  ig.nodes = ig.nodes ?? [];
  ig.edges = ig.edges ?? [];

  const byNorm = new Map<string, { id: string; idx: number }>();
  for (let i = 0; i < ig.nodes.length; i++) {
    const n = ig.nodes[i]!;
    byNorm.set(normalizeLabel(n.label), { id: n.id, idx: i });
  }

  const upsert = (label: string, attrs: Partial<{
    kpType: string;
    status: 'accepted' | 'proposed';
    confidence: number;
    facets: string[];
    state: any;
    evidenceTurnIds: string[];
  }>) => {
    const norm = normalizeLabel(label);
    if (!norm || norm.length < 3) return null;
    const existing = byNorm.get(norm);
    const evidenceTurnIds = Array.isArray(attrs.evidenceTurnIds) ? attrs.evidenceTurnIds.filter(Boolean) : [];
    if (existing) {
      const n = ig.nodes[existing.idx]!;
      if (typeof attrs.confidence === 'number') n.confidence = clamp01(Math.max(Number(n.confidence ?? 0), attrs.confidence));
      if (attrs.status) n.status = n.status ?? attrs.status;
      if (attrs.state && !n.state) n.state = attrs.state;
      if (attrs.kpType) n.facets = Array.from(new Set([...(n.facets ?? []), `KP:${attrs.kpType}`]));
      if (Array.isArray(attrs.facets) && attrs.facets.length > 0) n.facets = Array.from(new Set([...(n.facets ?? []), ...attrs.facets]));
      n.weight = clamp01(Number(n.weight ?? 0.5) + 0.06);
      n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
      return n.id;
    }
    const id = `i-${generateId()}`;
    const facets = [
      ...(attrs.kpType ? [`KP:${attrs.kpType}`] : []),
      ...(Array.isArray(attrs.facets) ? attrs.facets : []),
    ].filter(Boolean);
    const confidence = clamp01(typeof attrs.confidence === 'number' ? attrs.confidence : 0.55);
    ig.nodes.push({
      id,
      label: label.trim(),
      weight: clamp01(0.4 + confidence * 0.35),
      status: attrs.status ?? (confidence >= 0.7 ? 'accepted' : 'proposed'),
      confidence,
      ...(attrs.state ? { state: attrs.state } : {}),
      ...(facets.length > 0 ? { facets } : {}),
      provenance: [...evidenceTurnIds.map(provTurn), provTurn(latestUserTurnId)],
    });
    byNorm.set(norm, { id, idx: ig.nodes.length - 1 });
    return id;
  };

  // supersede: mark old as deprecated by flipping status; create new node
  for (const raw of supersede) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const oldLabel = String(s.oldLabel ?? '').trim();
    const newLabel = String(s.newLabel ?? '').trim();
    const evidenceTurnIds = Array.isArray(s.evidenceTurnIds) ? (s.evidenceTurnIds as unknown[]).map(String) : [];
    const old = byNorm.get(normalizeLabel(oldLabel));
    if (old) {
      const n = ig.nodes[old.idx]!;
      n.status = 'deprecated';
      n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
    }
    if (newLabel) upsert(newLabel, { confidence: 0.65, status: 'accepted', evidenceTurnIds });
  }

  for (const raw of add) {
    const a = (raw ?? {}) as Record<string, unknown>;
    const label = String(a.label ?? '').trim();
    const kpType = String(a.kpType ?? '').trim();
    const status = (String(a.status ?? '') === 'accepted' ? 'accepted' : 'proposed') as 'accepted' | 'proposed';
    const confidence = clamp01(Number(a.confidence ?? 0.55));
    const evidenceTurnIds = Array.isArray(a.evidenceTurnIds) ? (a.evidenceTurnIds as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];

    // Normalize facets and ensure exactly one src facet exists.
    // Sometimes the model omits/whitespace-mangles facets; we infer from evidenceTurnIds (e.g., t-assistant-latest).
    const facetsRaw = Array.isArray(a.facets) ? (a.facets as unknown[]).map(String).map((s) => s.trim()).filter(Boolean) : [];
    const hasSrcUser = facetsRaw.includes('src:user');
    const hasSrcAssistant = facetsRaw.includes('src:assistant');
    const inferredSrc =
      evidenceTurnIds.some((id) => id === 't-assistant-latest' || id.startsWith('t-assistant')) ? 'src:assistant' : 'src:user';
    const facets = Array.from(
      new Set([
        ...facetsRaw.filter((f) => f !== 'src:user' && f !== 'src:assistant'),
        hasSrcAssistant ? 'src:assistant' : hasSrcUser ? 'src:user' : inferredSrc,
      ])
    );
    const state =
      kpType.toLowerCase() === 'question'
        ? 'question'
        : kpType.toLowerCase() === 'constraint'
          ? 'constraint'
          : kpType.toLowerCase() === 'example'
            ? 'example'
            : 'topic';
    upsert(label, { kpType, status, confidence, facets, evidenceTurnIds, state });
  }

  for (const raw of strengthen) {
    const st = (raw ?? {}) as Record<string, unknown>;
    const label = String(st.label ?? '').trim();
    const delta = Number(st.confidenceDelta ?? 0.08);
    const evidenceTurnIds = Array.isArray(st.evidenceTurnIds) ? (st.evidenceTurnIds as unknown[]).map(String).filter(Boolean) : [];
    const existing = byNorm.get(normalizeLabel(label));
    if (!existing) continue;
    const n = ig.nodes[existing.idx]!;
    n.confidence = clamp01(Number(n.confidence ?? 0.5) + delta);
    n.status = n.confidence >= 0.7 ? 'accepted' : n.status;
    n.weight = clamp01(Number(n.weight ?? 0.5) + 0.05);
    n.provenance = [...(n.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
  }

  for (const raw of edges) {
    const e = (raw ?? {}) as Record<string, unknown>;
    const srcLabel = String(e.srcLabel ?? '').trim();
    const dstLabel = String(e.dstLabel ?? '').trim();
    const rel = String(e.rel ?? 'elaborates').trim();
    const status = (String(e.status ?? '') === 'accepted' ? 'accepted' : 'proposed') as 'accepted' | 'proposed';
    const confidence = clamp01(Number(e.confidence ?? 0.55));
    const evidenceTurnIds = Array.isArray(e.evidenceTurnIds) ? (e.evidenceTurnIds as unknown[]).map(String).filter(Boolean) : [];
    const src = byNorm.get(normalizeLabel(srcLabel))?.id ?? null;
    const dst = byNorm.get(normalizeLabel(dstLabel))?.id ?? null;
    if (!src || !dst || src === dst) continue;
    const existing = ig.edges.find((x) => x.src === src && x.dst === dst && String((x as any).rel ?? '') === rel);
    if (existing) {
      existing.confidence = clamp01(Math.max(Number(existing.confidence ?? 0), confidence));
      existing.status = existing.status ?? status;
      existing.weight = clamp01(Number(existing.weight ?? 0.35) + 0.05);
      existing.provenance = [...(existing.provenance ?? []), ...evidenceTurnIds.map(provTurn)];
      continue;
    }
    ig.edges.push({
      src,
      dst,
      weight: clamp01(0.25 + confidence * 0.35),
      confidence,
      status,
      facets: rel ? [`REL:${rel}`] : [],
      provenance: [...evidenceTurnIds.map(provTurn), provTurn(latestUserTurnId)],
    } as any);
  }

  next.ideaGraph = ig;
}

export async function generateSimulatedUserMessage(conception: ConceptionState): Promise<string> {
  const turns = conception.turns ?? [];
  if (turns.length === 0) {
    return 'I want to write about how ideas are turned into tangible assets';
  }

  // LLM-backed simulator (no hardcoded branching beyond the first message).
  const dr = buildConceptionDR(conception);
  const out = await api.ai.conception.simulateUser({ dr, model: 'auto' });
  return String(out.message ?? '').trim();
}

function buildConceptionDR(
  conception: ConceptionState,
  opts?: { uiPinnedKps?: Array<{ id: string; label: string }> }
): unknown {
  const turns = conception.turns ?? [];
  const lastTurns = turns.slice(Math.max(0, turns.length - 12)).map((t) => ({
    id: t.id,
    role: t.role,
    content: t.content,
    createdAt: t.createdAt,
  }));
  const turnCount = turns.length;

  const ig = conception.ideaGraph ?? { nodes: [], edges: [] };
  // Include accepted nodes, plus high-confidence proposed nodes (so early “main topic” doesn't disappear).
  const includeNodeIds = new Set(
    (ig.nodes ?? [])
      .filter((n) => {
        if (n.status === 'deprecated') return false;
        if (n.status === 'proposed') return clamp01(Number(n.confidence ?? 0)) >= 0.4;
        return true;
      })
      .map((n) => n.id)
  );
  const igCompact = {
    nodes: (ig.nodes ?? [])
      .filter((n) => includeNodeIds.has(n.id))
      .slice()
      .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
      .slice(0, 25)
      .map((n) => ({
        id: n.id,
        label: n.label,
        state: n.state,
        weight: n.weight,
        confidence: n.confidence,
        status: n.status,
        facets: n.facets,
      })),
    edges: (ig.edges ?? [])
      .filter(
        (e) =>
          includeNodeIds.has(e.src) &&
          includeNodeIds.has(e.dst) &&
          e.status !== 'deprecated' &&
          (e.status !== 'proposed' || clamp01(Number(e.confidence ?? 0)) >= 0.4)
      )
      .slice(0, 40)
      .map((e) => ({
        src: e.src,
        dst: e.dst,
        weight: e.weight,
        confidence: e.confidence,
        status: e.status,
        facets: e.facets,
      })),
  };

  return {
    phase: conception.phase,
    turnCount,
    dm: conception.dm ?? {},
    goalHypotheses: conception.goalHypotheses ?? [],
    docPlan: conception.docPlan ?? {},
    ideaGraph: igCompact,
    lastTurns,
    ...(opts?.uiPinnedKps && opts.uiPinnedKps.length > 0 ? { uiPinnedKps: opts.uiPinnedKps } : {}),
  };
}

export async function sendConceptionMessage(args: {
  conception: ConceptionState;
  message: string;
  onSaveConception: (next: ConceptionState, changeType?: 'auto-save' | 'ai-action') => void;
  uiPinnedKps?: Array<{ id: string; label: string }>;
}): Promise<void> {
  const { conception, message, onSaveConception } = args;
  const msg = String(message ?? '').trim();
  if (!msg) return;

  const userTurn: ConceptionChatTurn = { id: `t-${generateId()}`, role: 'user', content: msg, createdAt: new Date().toISOString() };

  const pickStrategy = (s: ConceptionState): ConceptionStrategy => {
    // v0: lookup by strategyId; default to two-stage.
    if (s.strategyId === 'belief_policy:v0') return BeliefPolicyV0;
    if (s.strategyId === 'two_stage:v0') return TwoStageV0;
    return TwoStageV0;
  };

  const strat = pickStrategy(conception);
  const out = await strat.step({ conception, userTurn });
  const dr = buildConceptionDR(out.next, { uiPinnedKps: args.uiPinnedKps ?? [] });

  // Optimistic save: persist + render the user turn immediately (before the LLM responds).
  // This avoids the UX where the user's message only appears after the assistant reply.
  onSaveConception(
    {
      ...out.next,
      updatedAt: new Date().toISOString(),
    },
    'auto-save'
  );

  // Two-stage strategy: single backend call yields both assistant text and KP/IG deltas.
  if (out.next.strategyId === 'two_stage:v0') {
    const step = await api.ai.conception.twoStageStep({ message: msg, dr, model: 'auto' });
    (out.next as any).dm = {
      ...(out.next as any).dm,
      stage: step.stage,
      convergenceScore: step.convergenceScore,
    };
    mergeTwoStageKps(out.next, userTurn.id, step.kps);
    const assistantTurn: ConceptionChatTurn = {
      id: `t-${generateId()}`,
      role: 'assistant',
      content: step.assistantText,
      createdAt: new Date().toISOString(),
    };

    const final: ConceptionState = {
      ...out.next,
      turns: [...(out.next.turns ?? []), assistantTurn],
      updatedAt: new Date().toISOString(),
    };

    onSaveConception(final, 'auto-save');
    return;
  }

  // Legacy fallback: extract-ig + chat.
  try {
    const extracted = await api.ai.conception.extractIg({ message: msg, dr, model: 'auto' });
    mergeExtractedIg(out.next, userTurn.id, extracted);
  } catch {
    // ignore
  }

  const llm = await api.ai.conception.chat({ message: msg, action: out.action, dr: buildConceptionDR(out.next), model: 'auto' });
  const assistantTurn: ConceptionChatTurn = {
    id: `t-${generateId()}`,
    role: 'assistant',
    content: llm.assistantText,
    createdAt: new Date().toISOString(),
  };

  const final: ConceptionState = {
    ...out.next,
    turns: [...(out.next.turns ?? []), assistantTurn],
    updatedAt: new Date().toISOString(),
  };

  onSaveConception(final, 'auto-save');
}


