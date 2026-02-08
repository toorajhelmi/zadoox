import type {
  ConceptionChatTurn,
  ConceptionGoalHypothesis,
  ConceptionState,
  DocPlan,
  IdeaGraph,
  IdeaGraphNode,
} from '@zadoox/shared';
import type { ConceptionActionSpec, ConceptionStrategy, ConceptionStrategyStepInput, ConceptionStrategyStepOutput } from './types';

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeLabel(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ensureIg(state: ConceptionState): IdeaGraph {
  return state.ideaGraph ?? { nodes: [], edges: [] };
}

function ensureEdge(ig: IdeaGraph, src: string | null, dst: string | null, provenanceTurnId?: string) {
  if (!src || !dst) return;
  if (src === dst) return;
  ig.edges = ig.edges ?? [];
  const existing = ig.edges.find((e) => e.src === src && e.dst === dst);
  if (existing) {
    existing.weight = clamp01(Number(existing.weight ?? 0.35) + 0.05);
    existing.status = existing.status ?? 'accepted';
    existing.confidence = clamp01(Number(existing.confidence ?? 0.6) + 0.05);
    if (provenanceTurnId) {
      existing.provenance = existing.provenance ?? [];
      existing.provenance.push({ kind: 'chat_turn', id: provenanceTurnId });
    }
    return;
  }
  ig.edges.push({
    src,
    dst,
    weight: 0.35,
    status: 'accepted',
    confidence: 0.6,
    ...(provenanceTurnId ? { provenance: [{ kind: 'chat_turn', id: provenanceTurnId }] } : {}),
  });
}

function upsertIdeaNode(
  ig: IdeaGraph,
  label: string,
  opts: { state?: IdeaGraphNode['state']; provenanceTurnId?: string }
): string | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  const existing = ig.nodes.find((n) => normalizeLabel(n.label) === norm);
  if (existing) {
    existing.weight = clamp01((existing.weight ?? 0) + 0.08);
    if (opts.state && !existing.state) existing.state = opts.state;
    if (opts.provenanceTurnId) {
      existing.provenance = existing.provenance ?? [];
      existing.provenance.push({ kind: 'chat_turn', id: opts.provenanceTurnId });
    }
    return existing.id;
  }
  const id = `i-${generateId()}`;
  ig.nodes.push({
    id,
    label: label.trim(),
    weight: 0.55,
    ...(opts.state ? { state: opts.state } : null),
    ...(opts.provenanceTurnId ? { provenance: [{ kind: 'chat_turn', id: opts.provenanceTurnId }] } : null),
  });
  return id;
}

function inferDocTypeHypotheses(message: string): ConceptionGoalHypothesis[] {
  const m = String(message ?? '').toLowerCase();
  const scores: Record<NonNullable<DocPlan['docType']>, number> = {
    unknown: 0.1,
    academic_paper: 0,
    novel: 0,
    blog: 0,
    spec: 0,
    proposal: 0,
    notes: 0,
    mixed: 0,
  };
  const evidence: Record<NonNullable<DocPlan['docType']>, string[]> = {
    unknown: [],
    academic_paper: [],
    novel: [],
    blog: [],
    spec: [],
    proposal: [],
    notes: [],
    mixed: [],
  };

  const bump = (k: NonNullable<DocPlan['docType']>, inc: number, why: string) => {
    scores[k] += inc;
    evidence[k].push(why);
  };

  if (/\bpaper\b|\barxiv\b|\bconference\b|\bmethod\b|\bresults?\b|\bexperiment\b|\brelated work\b/.test(m)) bump('academic_paper', 0.6, 'mentions paper/research terms');
  if (/\bspec\b|\brfc\b|\bapi\b|\brequirements?\b|\bdesign\b|\barchitecture\b/.test(m)) bump('spec', 0.6, 'mentions spec/design terms');
  if (/\bproposal\b|\bpitch\b|\bfunding\b|\bgrant\b/.test(m)) bump('proposal', 0.6, 'mentions proposal terms');
  if (/\bblog\b|\bpost\b|\bnewsletter\b/.test(m)) bump('blog', 0.55, 'mentions blog/post');
  if (/\bnovel\b|\bcharacter\b|\bplot\b|\bscene\b|\bfiction\b|\bstory\b/.test(m)) bump('novel', 0.55, 'mentions fiction terms');
  if (/\bnotes\b|\bscratch\b|\bbrain dump\b/.test(m)) bump('notes', 0.4, 'mentions notes');
  if (/\bpaper\b/.test(m) && /\bblog\b/.test(m)) bump('mixed', 0.4, 'mentions multiple formats');

  // Normalize into hypotheses.
  const entries = Object.entries(scores) as Array<[NonNullable<DocPlan['docType']>, number]>;
  const sum = entries.reduce((acc, [, v]) => acc + Math.max(0, v), 0) || 1;
  const out: ConceptionGoalHypothesis[] = entries
    .map(([docType, v]) => ({
      docType,
      score: clamp01(Math.max(0, v) / sum),
      evidence: evidence[docType],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Ensure unknown exists if everything is weak.
  if (!out.some((h) => h.docType === 'unknown')) out.push({ docType: 'unknown', score: 0.2, evidence: [] });
  return out;
}

function gistFromUserMessage(message: string): string {
  // Deterministic “gist” extraction (no LLM):
  // - strip common lead-ins
  // - prefer text after "about"
  // - truncate to a short phrase
  const raw = String(message ?? '').trim();
  if (!raw) return '';
  let s = raw
    .replace(/^some key ideas to cover are:\s*/i, '')
    .replace(/^i want to write about\s+/i, '')
    .replace(/^i want to write\s+/i, '')
    .replace(/^i'm writing about\s+/i, '')
    .replace(/^we should write about\s+/i, '')
    .replace(/^this is about\s+/i, '')
    .trim();

  // If the remaining text still contains "about", prefer what's after it.
  const m = /\babout\b\s+(.+)$/i.exec(s);
  if (m && m[1]) s = m[1].trim();

  // Take the first sentence-ish chunk.
  s = s.split(/\n+/)[0] ?? s;
  s = s.split(/[.?!]\s/)[0] ?? s;

  // Remove trailing “can we…” style clauses (often meta, not gist).
  s = s.replace(/\bcan we\b[\s\S]*$/i, '').trim();

  // Normalize whitespace and strip surrounding quotes.
  s = s.replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim();

  // Truncate to a short phrase.
  const words = s.split(' ').filter(Boolean);
  const maxWords = 10;
  const out = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? `${out}…` : out;
}

function detectFacetTags(message: string): string[] {
  const m = String(message ?? '').toLowerCase();
  const tags = new Set<string>();
  // Matches ideation.md academic aspects but stays generic strings for other future lenses.
  if (/\bdefine\b|\bmeans\b|\bby .* i mean\b|\bclarif/i.test(m)) tags.add('Clarification');
  if (/\bexplore\b|\balternative\b|\bangle\b|\bbranch\b/.test(m)) tags.add('Exploration');
  if (/\bconstraint\b|\bassumption\b|\bscope\b|\bmust\b|\bcan'?t\b/.test(m)) tags.add('Conception');
  if (/\bdifferent\b|\bdistinguish\b|\bnovel\b|\bvs\b|\bcontrast\b/.test(m)) tags.add('Distinction');
  if (/\bquestion\b|\bunknown\b|\bhypothesis\b|\?$/.test(m)) tags.add('Question');
  if (/\bapproach\b|\bmethod\b|\bevaluate\b|\bexperiment\b|\bplan\b/.test(m)) tags.add('Approach');
  return Array.from(tags);
}

function isAmbiguousForIgGist(gist: string): boolean {
  const g = String(gist ?? '').trim().toLowerCase();
  if (!g) return true;
  // Too generic => don't “commit” strongly yet.
  if (g.length < 8) return true;
  if (/^(idea|topic|something|stuff|this|that|it|framework|system|process)\b/.test(g)) return true;
  return false;
}

function shouldAskClarifierEarly(turnCount: number, message: string, gist: string): boolean {
  // Per ideation.md: listen-first early is a guideline, not a hard turn-based rule.
  // Ask only when:
  // - the user explicitly asked a question, OR
  // - ambiguity is high enough that we'd otherwise capture nonsense, OR
  // - later in the chat we need one small calibration question to avoid drift.
  const msg = String(message ?? '').trim();
  if (/\?\s*$/.test(msg)) return true;
  const g = String(gist ?? '').trim();
  if (g.length === 0) return true;
  if (isAmbiguousForIgGist(gist)) return turnCount >= 3; // give user room to elaborate early
  // Later: occasional calibration is OK (still at most one question).
  return turnCount >= 6;
}

function detectExplicitDocTypeAnswer(message: string): NonNullable<DocPlan['docType']> | null {
  const m = String(message ?? '').toLowerCase();
  // Strong explicit preference statements should override weak/conflicting keyword evidence.
  if (/\bcloser to (a |an )?spec\b|\bmore like (a |an )?spec\b|\bspec\s*\/\s*framework\b/.test(m)) return 'spec';
  if (/\bcloser to (a |an )?paper\b|\bmore like (a |an )?paper\b/.test(m)) return 'academic_paper';
  if (/\bcloser to (a |an )?blog\b|\bmore like (a |an )?blog\b/.test(m)) return 'blog';
  if (/\bcloser to (a |an )?story\b|\bmore like (a |an )?story\b|\bfiction\b/.test(m)) return 'novel';
  if (/\bcloser to (a |an )?proposal\b|\bmore like (a |an )?proposal\b|\bpitch\b/.test(m)) return 'proposal';
  if (/\bcloser to notes\b|\bmore like notes\b/.test(m)) return 'notes';
  return null;
}

function shouldUserGetSuggestions(message: string): boolean {
  const m = String(message ?? '').toLowerCase();
  return /\boutline\b|\bstructure\b|\bplan\b|\bsections\b|\brecommend\b|\bsuggest\b|\bwhat should i\b/.test(m);
}

export const BeliefPolicyV0: ConceptionStrategy = {
  id: 'belief_policy:v0',
  step(input: ConceptionStrategyStepInput): ConceptionStrategyStepOutput {
    const { conception, userTurn } = input;
    const msg = userTurn.content;

    // Update state (DM). NOTE: We do NOT upsert IdeaGraph nodes here.
    // IdeaGraph updates should be conservative and content-aware; they are extracted separately
    // (LLM JSON extraction) to avoid “junk nodes” from naive gist heuristics.
    const next: ConceptionState = {
      ...conception,
      strategyId: 'belief_policy:v0',
      phase: conception.phase ?? 'ideation',
      turns: [...(conception.turns ?? []), userTurn],
      updatedAt: new Date().toISOString(),
    };

    // Update goal hypotheses (doc_type only for v0).
    const explicitDocType = detectExplicitDocTypeAnswer(msg);
    const inferred = explicitDocType
      ? ([
          { docType: explicitDocType, score: 0.9, evidence: ['explicit user preference'] },
          { docType: 'unknown', score: 0.1, evidence: [] },
        ] as ConceptionGoalHypothesis[])
      : inferDocTypeHypotheses(msg);
    next.goalHypotheses = inferred;

    // Keep DocPlan present; update docType only when reasonably confident.
    const dp: DocPlan = next.docPlan ?? { sections: [], docType: 'unknown' };
    const top = inferred[0];
    if (explicitDocType) {
      dp.docType = explicitDocType;
    } else if (top && top.docType !== 'unknown' && top.score >= 0.65) {
      dp.docType = top.docType;
    }
    next.docPlan = dp;

    // Response policy:
    // - DM selects the minimal next action; LLM always realizes the final text.
    const askedSlots = new Set(next.dm?.askedSlots ?? []);
    const answeredSlots = new Set(next.dm?.answeredSlots ?? []);
    if (explicitDocType) answeredSlots.add('docType');
    // Keep DM slot bookkeeping minimal; do not force conversational moves.
    // We only record that the user gave an explicit docType (slot answered).
    next.dm = {
      ...(next.dm ?? {}),
      askedSlots: Array.from(askedSlots),
      answeredSlots: Array.from(answeredSlots),
      lastAskedSlot: next.dm?.lastAskedSlot ?? null,
    };

    // Conversation flow is handled by the LLM under overall guidelines.
    const action: ConceptionActionSpec = {
      kind: 'auto',
      constraints: {
        maxQuestions: 1,
        avoidChecklistTone: true,
        avoidEchoingUser: true,
        listenFirst: true,
      },
    };

    return { next, action };
  },
};


