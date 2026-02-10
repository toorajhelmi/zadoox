# Conception: Transition to Formalization (Implementation v0)

This doc specifies how we detect and handle the transition from **Ideation** → **Formalization** during Full‑AI Conception.

## Goals

- **LLM-driven detection**: the same LLM call that generates Z’s response must also decide whether we are in `ideation` or `formalization`.
- **No background stage detection** (v0): phase detection is part of the response call so Z “knows” which mode it is in while responding.
- **No auto-transition to editor** (current v0 behavior): even if formalization is detected, we stay on the ideation surface for now.
- **Visible marker**: when the user expresses drafting intent, show a clear system marker indicating whether formalization was detected.
- **DP is minimal**: formalization should not interrogate; it should gather only enough to start drafting and continue in the editor later.

## Current Data Model (already exists)

From `packages/shared/src/types/conception.ts`:
- `ConceptionState.phase`: `'ideation' | 'formalization'`
- `ConceptionState.turns`: chat history (role + content + createdAt)
- `ConceptionState.ideaGraph`: IdeaGraph nodes/edges with provenance
- `ConceptionState.docPlan`: DocPlan scaffold (sections etc.)
- `ConceptionState.dm`: DM memory (asked/answered slots, etc.)

## API Contract (v0)

Endpoint: `POST /api/v1/ai/conception/two-stage/step`

Request body:
- `message`: latest user message (string)
- `dr`: Dialogue Representation (compact transcript + compact IG + dm memory + uiPinnedKps)

Response body (data):
- `assistantText`: string
- `phase`: `'ideation' | 'formalization'`  ← **new source of truth for detection**
- `convergenceScore`: number in `[0,1]`
- `kps`: KP/edge deltas for updating IG

## Backend: DM Call (same call that generates Z response)

Implementation: inside `/ai/conception/two-stage/step`

The DM LLM prompt must return JSON:

```json
{
  "assistantText": "…",
  "phase": "ideation|formalization",
  "convergenceScore": 0.0
}
```

### DM Rules (high-level)

- **Ideation**: maximize idea throughput, avoid interrogating, 0–1 question.
- **Formalization**: shift toward producing a first draft; ask only missing material questions, 0–2 questions max.
- **Avoid long outlines**: even in formalization, do not write a long multi-section outline; ask the next best planning question.

### Formalization triggers (LLM rubric)

The DM call should set `phase="formalization"` when:
- The latest user message expresses explicit drafting intent:
  - “let’s draft…”, “start writing…”, “outline…”, “create the doc…”, “turn this into a document…”. We should use LLM interpretation not hardcoding texts.
- Or the user is primarily referring to existing KPs (chips / pinned / selected) rather than introducing new branches.

## Next Step After Detection (planned, not implemented here)

Once formalization detection is reliable and DP logic is ready:
- Replace marker-only behavior with a **lightweight DP mode**:
  - Ask first: **All vs Select IG nodes**
  - Optional H/M/L importance for selected nodes
  - Generate a minimal `DocPlan` draft
- Add a user action: **“Start Draft”** to materialize IR skeleton and move into editor.


