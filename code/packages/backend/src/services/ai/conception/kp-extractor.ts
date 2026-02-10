import type { AIService, AIModel } from '../ai-service.js';
import { ConceptionKpDelta } from './types.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export async function extractConceptionKps(args: {
  service: AIService;
  dr: unknown;
  model?: AIModel;
  phase: 'ideation' | 'formalization';
  assistantText: string;
  allowIgUpdates: boolean;
}): Promise<ReturnType<typeof ConceptionKpDelta.parse>> {
  const { service, model, phase } = args;
  const assistantText = String(args.assistantText ?? '').trim();
  if (!assistantText) throw new Error('assistantText is required for KP extraction');

  if (!args.allowIgUpdates) {
    // Enforced: no IdeaGraph updates in planning turns.
    return ConceptionKpDelta.parse({ add: [], strengthen: [], supersede: [], edges: [] });
  }

  const drAny: Record<string, unknown> = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const kpTurns = [...lastTurns, { id: 't-assistant-latest', role: 'assistant', content: assistantText }];

  const kpSystem = `You are a Key Point extractor for an ideation + planning chat.

Extract Key Points (KPs) from the dialogue turns. You MUST be phase-aware.

Current phase (from DM): ${phase}

Phase-aware rule (IMPORTANT):
- If current phase is "formalization" AND the latest user message is answering DocPlan/planning questions (e.g., doc type choice, scope, section tweaks) WITHOUT introducing new substantive ideas,
  then DO NOT add new IdeaGraph nodes/edges. Return empty add/edges (and usually empty strengthen/supersede too).
- If current phase is "formalization" BUT the user clearly ideates again (introduces new topics/claims/questions/constraints), then extract KPs normally.

Rules:
- Labels should be meaningful short sentences/claims/questions when possible (aim 6–14 words). Avoid tiny fragments unless the input is tiny.
- Prefer capturing: core topic(s), goals, constraints, questions, approaches, and concrete proposed angles.
- If a turn contains multiple distinct concrete items (examples, named methods/tech, enumerations), split them into multiple KPs rather than one generic KP.
- Tag provenance with facets:
  - User-origin KPs MUST include "src:user"
  - Assistant-origin KPs MUST include "src:assistant"
- Mark user-origin KPs as "accepted" only when the user clearly asserts/adopts them; otherwise "proposed".
- Assistant-origin KPs should usually be "proposed" (unless the user explicitly adopts them later).
- Every KP and edge MUST include evidenceTurnIds. Use the most relevant turn id(s) from the provided turns.
- Output multiple KPs when the turns contain multiple clear signals (typically 2–6).
- RELATIONS: when a new KP clearly relates to existing KPs, add edges to connect them using rel in:
  supports | depends_on | contrasts_with | elaborates
  If the user responds *about* a prior KP, add an edge from the new KP to that prior KP (usually elaborates/supports).
- Edge confidence: if you emit an edge, set confidence in [0.55, 0.85] depending on how explicit the relation is.

Hard requirements:
- If you output 2+ KPs in add, you MUST emit at least 1 edge in edges linking two KPs (use the most obvious relation).
- Use srcLabel/dstLabel that match the exact label text of KPs (either from EXISTING KP LABELS or from your add list). Do not invent new labels only for edges.
- If the provided turns include an assistant turn with substantive content, you MUST include at least 1 "src:assistant" proposed KP derived from it.
- If the latest assistant turn is substantive and contains 2+ distinct concrete details (e.g., "AI", "big data analytics", "collaborative platforms", examples, specific mechanisms),
  you MUST output at least 2 assistant-origin KPs (src:assistant) capturing those distinct details (not one generic umbrella).
 - Content-driven granularity (IMPORTANT): Create ONE assistant-origin KP per distinct concrete item/mechanism/example mentioned in the latest assistant turn.
   - If the assistant mentions multiple tools/technologies (e.g., AI, data analytics, collaboration platforms), each should become its own KP (unless two are truly inseparable in the text).
   - If the assistant gives an explicit mechanism ("by providing insights into consumer behavior"), extract that mechanism as its own KP.
   - Do NOT collapse multiple distinct items into an umbrella label like "Research on X" when the paragraph contains multiple concrete claims.
 - Avoid generic prefixes in labels (unless the text is actually generic): do NOT start every assistant KP with "Research on" / "Exploring" / "Analyzing". Prefer the actual claim.
 - Evidence IDs: Any KP derived from the latest assistant turn MUST include "t-assistant-latest" in evidenceTurnIds.

Example (illustrative only — do not copy text verbatim):
Assistant says: "AI and data analytics can spark new ideas by identifying market trends. Open innovation platforms enable collaboration and idea sharing."
Expected assistant KPs reflect each distinct concrete item/mechanism, e.g.:
- "AI can inspire ideas by surfacing emerging market trends"
- "Data analytics reveals consumer behavior to guide ideation"
- "Open innovation platforms enable collaboration and idea sharing"
and at least one edge connecting them (often elaborates/supports).

Return ONLY JSON with this exact shape:
{
  "add": [{ "label": string, "kpType": string, "status": "accepted"|"proposed", "confidence": number, "facets": string[], "evidenceTurnIds": string[] }],
  "strengthen": [{ "label": string, "confidenceDelta": number, "evidenceTurnIds": string[] }],
  "supersede": [{ "oldLabel": string, "newLabel": string, "evidenceTurnIds": string[] }],
  "edges": [{ "srcLabel": string, "dstLabel": string, "rel": "supports"|"depends_on"|"contrasts_with"|"elaborates", "status": "accepted"|"proposed", "confidence": number, "evidenceTurnIds": string[], "facets": string[] }]
}`;

  const ideaGraph = isRecord(drAny.ideaGraph) ? drAny.ideaGraph : null;
  const ideaNodes = ideaGraph && Array.isArray(ideaGraph.nodes) ? ideaGraph.nodes : [];
  const existingLabels = ideaNodes.map((n) => (isRecord(n) ? String(n.label ?? '').trim() : '')).filter(Boolean);

  const uiPinnedKps = Array.isArray(drAny.uiPinnedKps)
    ? drAny.uiPinnedKps
        .map((x) => ({
          id: isRecord(x) ? String(x.id ?? '').trim() : '',
          label: isRecord(x) ? String(x.label ?? '').trim() : '',
        }))
        .filter((x) => x.id && x.label)
        .slice(0, 6)
    : [];

  const kpUser = `EXISTING KP LABELS (if any):
${JSON.stringify(existingLabels.slice(0, 60), null, 2)}

UI PINNED KPs (explicit references from the chat composer, if any):
${JSON.stringify(uiPinnedKps, null, 2)}

CONTEXT GROUP (if present): when the user selected 2+ KPs in the IdeaGraph UI, we create a group id for this message.
If provided, you MUST create a synthetic GROUP node and attach new KPs under it.
${JSON.stringify(isRecord(drAny.contextGroup) ? drAny.contextGroup : null, null, 2)}

TURNS (most recent last):
${JSON.stringify(kpTurns, null, 2)}

NOTE: The DR may include uiPinnedKps (explicit user-selected references). If present, treat those as the intended targets of "this/that/the selected item",
and prefer emitting edges that connect new KPs to those pinned KPs when relevant.
When uiPinnedKps is present and the latest user turn is discussing that referenced KP, DO NOT create a brand-new unrelated root topic.
Instead, add 1–3 child KPs that elaborate the pinned KP and connect them with rel="elaborates" (or supports/depends_on if more precise).
Hard requirement for pinned KPs:
- If UI PINNED KPs is non-empty and you add any new KPs that are responses (e.g., research, examples, details), you MUST emit at least one rel="elaborates" edge
  from a pinned parent label to each such child (parent -> child). Use exact labels.
Multi-pinned shared-parent rule:
- If UI PINNED KPs contains 2+ items, interpret whether the latest user message is asking a SHARED question across the selected items (e.g., "across these", "compare", "common themes", "tradeoffs", "how do these relate", "intersection", "both/all").
  - If SHARED: every newly added child KP that answers the question MUST have an incoming rel="elaborates" edge from EACH pinned parent label (multiple parents allowed).
  - If NOT shared (the question clearly applies to one pinned item only): attach new child KPs only to the most relevant pinned parent (do NOT force multiple parents).
Comparison-specific extraction:
- If the user asks to "compare" / "contrast" / "commonalities" / "differences" across 2+ pinned KPs, prefer emitting KPs that explicitly encode:
  - 1+ shared/common theme(s), and/or
  - 1+ key difference(s) in mechanism/strengths/risks.
  Avoid outputting only a rephrasing of a single pinned parent (that is not a comparison).

Context Group (generic multi-anchor intent):
- If CONTEXT GROUP is present (non-null) and has:
  - id: string (group id like "g-...")
  - anchorKps: [{id,label}...] with length >= 2
  then you MUST:
  1) Add EXACTLY ONE synthetic GROUP node in "add":
     - label: a short title that reflects the user's intent over these anchors (e.g. "Compare: A ↔ B", "Synthesize: A + B", "Research: A & B", etc.)
     - kpType: "group"
     - status: "accepted"
     - confidence: 0.85
     - facets MUST include: "GROUP:context", "ctx:group:<id>", and "groupType:<inferred>" (e.g. groupType:compare|synthesize|research|plan|critique|decide|other)
     - evidenceTurnIds MUST include the latest user turn id (from CONTEXT GROUP.latestUserTurnId if present; otherwise use the most relevant user turn id)
  2) Add anchor -> group edges (one per anchor) in "edges":
     - srcLabel = anchor label (must match an EXISTING KP label)
     - dstLabel = group label (must match the group label you added)
     - rel = "elaborates" (anchor -> group is a structural/context edge)
     - facets MUST include: "ctx:group:<id>" and "REL:anchors"
  3) For every NEW KP you add that responds to this message, you MUST:
     - include facets: "ctx:group:<id>" and optionally "side:<anchorId>" when clearly about one anchor only
     - add an edge group -> newKP with rel="elaborates" and facets include "ctx:group:<id>" and "REL:in_group"
  4) Precedence rule (IMPORTANT): If CONTEXT GROUP is present, it overrides the multi-pinned shared-parent rule.
     - Do NOT emit anchor -> child edges for newly added KPs (except anchor -> group).
     - All newly added KPs should be children of the group via group -> child edges.
     - You MAY optionally add anchor -> child edges ONLY if the user explicitly asks for per-anchor expansions *outside* the shared context (rare).
  5) Do NOT scatter children under individual anchors when CONTEXT GROUP is present; group is the primary container.
Directionality for edges:
- For rel="elaborates": srcLabel = parent (more general), dstLabel = child (more specific).
- For rel="supports": srcLabel supports dstLabel (evidence/argument -> claim).
- For rel="depends_on": srcLabel depends on dstLabel (thing -> prerequisite).

Extract KPs from these turns. Return ONLY the JSON.`;

  const kpRaw = await service.chatJson({ system: kpSystem, user: kpUser, temperature: 0.25 }, model);
  const parsed = ConceptionKpDelta.parse(kpRaw);

  // Enforce Context Group structure: keep anchors->group and group->children; drop any anchor->child edges if model emits them.
  const cg = isRecord(drAny.contextGroup) ? (drAny.contextGroup as Record<string, unknown>) : null;
  const cgId = cg && typeof cg.id === 'string' ? cg.id.trim() : '';
  const cgAnchors = cg && Array.isArray(cg.anchorKps) ? cg.anchorKps : [];
  if (cgId && cgAnchors.length >= 2) {
    const anchorLabels = new Set(
      cgAnchors
        .map((x) => (isRecord(x) ? String(x.label ?? '').trim() : ''))
        .filter(Boolean)
        .slice(0, 12)
    );
    const groupAdd = (parsed.add ?? []).find(
      (a) =>
        Array.isArray(a.facets) &&
        a.facets.includes('GROUP:context') &&
        a.facets.some((f) => String(f).startsWith(`ctx:group:${cgId}`))
    );
    const groupLabel = String(groupAdd?.label ?? '').trim();
    if (groupLabel) {
      parsed.edges = (parsed.edges ?? []).filter((e) => {
        const src = String((e as { srcLabel?: unknown }).srcLabel ?? '').trim();
        const dst = String((e as { dstLabel?: unknown }).dstLabel ?? '').trim();
        if (!src || !dst) return true;
        // Keep anchor -> group
        if (anchorLabels.has(src) && dst === groupLabel) return true;
        // Drop anchor -> anything else (prevents children being attached to anchors in group mode)
        if (anchorLabels.has(src) && dst !== groupLabel) return false;
        return true;
      });
    }
  }

  return parsed;
}


