# 0) Definitions 
### IdeaGraph (IG)

A **dynamic, exploratory graph** that represents the *space of ideas* a user is considering **before** they commit to a document structure.

* **Purpose:** capture *what the user might want to cover* and how important each piece feels during brainstorming.
* **Nodes:** candidate ideas (topics, hypotheses, questions, assumptions, examples).
* **Edges:** loose relatedness / inclusion links (kept simple in v0).
* **Node weight:** (w \in [0,1]) indicating *salience / intended coverage depth* (higher = should be covered more).
* **State:** high churn is expected; contradictions and alternatives can co-exist.
* **Provenance:** each node/edge stores references to the conversation turns that introduced/updated it.

**IG answers:** “What’s in the idea space, and what seems most important right now?”

---

### DocPlan (DP)

A **committed, human-legible scaffold** that turns the IG into an executable plan for writing—*without being the prose itself*.

* **Purpose:** produce Point B: **structure (sections), scope, and tone**.
* **Core fields:**

  * **doc_type** (paper/novel/spec/etc.) — may be inferred
  * **one-liner** (thesis/logline)
  * **tone/voice** (formal, conversational, etc.)
  * **scope boundaries**: in-scope vs out-of-scope (linked to IG nodes)
  * **sections**: ordered list, each with:

    * **intent** (why the section exists)
    * **bullets** (what it will cover)
    * **IG links** (which ideas it covers + expected coverage)
  * **open questions** (unknowns to resolve later)

DP is the **first “freeze” artifact**: stable enough to start drafting, but still easy to revise.

**DP answers:** “What are we going to write, in what order, with what emphasis and tone?”

---

### SemanticGraph (SG)

A **content-commitment graph** that represents the *meaning-level structure* of the document once formation/drafting begins.

* **Purpose:** capture the document’s core semantics so the system can reason about **consistency, support, gaps, and contradictions**.
* **Nodes:** **primitives** defined by a template (e.g., for academic: claim, definition, evidence, method, question; for other doc types: different primitives).
* **Edges:** a signed support relation with weight in ([-1,1]):

  * (+1) strongly supports
  * (0) neutral/unclear
  * (-1) strongly contradicts
* **Metadata:** confidence + provenance (which paragraph / which chat turns / which sources introduced it).
* **Visibility:** typically **hidden** from users; surfaced only as actionable feedback (e.g., “this claim lacks support”).

SG answers:** “What does this document *mean*, and does it hang together logically given the template?”

---

#### In one line

* **IG** = *explore the idea space* (messy map)
* **DP** = *commit to a writing scaffold* (sections/scope/tone)
* **SG** = *encode semantic commitments* (reasoning about coherence/support)


# 1) Core thesis: how people develop ideas

Most users don’t start with a “goal.” They start with **a mental seed** that is:

* partially articulated (“something about X…”)
* underspecified (“not sure if this is a paper or story yet”)
* unstable (new angles appear as they talk)

A useful system should therefore treat the early session as **sensemaking**, not planning.

**Sensemaking loop (what the chat is doing):**

1. **Externalize**: get the seed out of their head into language.
2. **Differentiate**: split the seed into sub-ideas.
3. **Organize**: cluster and order sub-ideas.
4. **Prioritize**: decide what matters most (weights).
5. **Commit**: freeze a first structure (DocPlan), then shift into drafting.

Your IG captures steps 2–4; DocPlan is step 5.

---

# 2) Goal as a latent variable

You’re right: don’t ask for goal explicitly at the start. Instead, infer a **GoalProfile** gradually and only surface it when moving into formation.

## 2.1 GoalProfile dimensions (latent → explicit later)

Treat “goal” as a vector of dimensions. Many can be `unknown` initially.

### A) Artifact intent

* **doc_type**: paper / proposal / spec / blog / novel / short story / pitch / notes / mixed
* **primary function**: explain / persuade / explore / entertain / instruct / argue / document

### B) Audience & context

* **audience**: self / peers / reviewers / customers / general public / niche community
* **reader sophistication**: beginner / intermediate / expert
* **context**: publication / internal memo / submission / public web / private

### C) Success criteria

* **success metric**: acceptance, bestseller, virality, clarity-to-self, conversion, funding, adoption
* **priority tradeoffs** (weights): {novelty, rigor, clarity, persuasion, entertainment, brevity, completeness}

### D) Constraints

* **time**: deadline date/time window (if any)
* **length**: target range (pages/words)
* **format**: citation style, sections required, template/venue constraints
* **safety/ethics/sensitivity**: must-avoid topics, anonymity needs, risk tolerance

### E) Content stance

* **claim strength**: exploratory vs assertive
* **evidence standard**: anecdotal / references / experiments / formal proof
* **novelty posture**: incremental / moderate / radical

### F) Style & voice

* **tone**: formal / conversational / playful / philosophical / marketing / academic
* **voice**: first-person vs third-person; narrative vs analytical
* **emotion target** (esp. fiction): curiosity, awe, tension, humor, etc.

### G) Coverage strategy

* **breadth vs depth** preference
* **scope strictness**: tight thesis vs wide survey

**Implementation note:** store this as multiple hypotheses early:

```json
"goal_hypotheses": [
  {"doc_type":"academic_paper", "score":0.55, "evidence":["user said 'innovation', 'method', 'accepted'"]},
  {"doc_type":"blog", "score":0.25, "evidence":["user wants 'readable' tone"]},
  {"doc_type":"notes", "score":0.20, "evidence":["user unsure about audience"]}
]
```

During ideation, you can ask *non-goal-feeling* disambiguations:

* “Is this closer to a paper, a story, or a product/spec?” (quick pick)
* “Do you want to convince someone, or mainly clarify it for yourself?” (quick pick)

---

# 3) Data artifacts

## 3.1 IdeaGraph (IG) — phase 1 artifact (visible)

**Purpose:** model idea space + importance.

Minimal structure:

```json
{
  "nodes": [
    {"id":"i1","label":"core idea","weight":0.85,"state":"hypothesis|question|topic|assumption","provenance":["msg:12","msg:14"]},
    {"id":"i2","label":"related work","weight":0.40,"state":"topic","provenance":["msg:18"]}
  ],
  "edges": [
    {"src":"i1","dst":"i2","weight":0.3,"provenance":["msg:18"]}
  ]
}
```

* Keep **one edge weight** for v0 (as you want).
* Keep **provenance** (chat message ranges) and **confidence** internally.

## 3.2 DocPlan (DP) — bridge artifact (visible)

**Purpose:** the first “contract” the user can recognize as *their intended document*.

Minimal DP:

```json
{
  "doc_type": "unknown|academic_paper|novel|blog|spec|proposal",
  "working_title": "string?",
  "one_liner": "string",
  "tone_guess": ["formal","conversational","..."],
  "scope": {
    "in_scope": [{"ig":"i1","target_weight":0.9},{"ig":"i7","target_weight":0.4}],
    "out_of_scope": [{"ig":"i9"}]
  },
  "sections": [
    {"id":"S1","title":"Introduction","intent":"what the reader should learn","bullets":["..."],"ig_links":[{"ig":"i1","coverage":0.8}]},
    {"id":"S2","title":"Related Work","intent":"position the idea","bullets":["..."],"ig_links":[{"ig":"i2","coverage":0.7}]}
  ],
  "open_questions": [{"ig":"i5","question":"What evidence will we use to justify X?"}]
}
```

## 3.3 SG + IR — phase 2 artifacts (hidden)

* SG: semantic primitives + support weight in [-1,1], confidence+provenance
* IR: block graph (sections/figures/tables/refs), generated directly from DP skeleton

---

# 4) Why IG → DP → (SG/IR) and not IG → (SG/IR)

You *can* go IG → SG/IR, but DP is still needed implicitly because:

* **Point B is DP** (structure/scope/tone). SG is deeper than required for “start drafting.”
* DP is **cheap to revise**; SG is costly to keep coherent during high-churn ideation.
* DP provides a **stable scaffold** for IR creation and for where SG nodes “attach” later.
* DP is the **handoff boundary** where the system can legitimately start enforcing consistency.

So: DP is not extra work; it is the explicit version of the decision you must make anyway.

---

# 5) Phase 1 chat behavior (ideation)

## 5.1 What the chat must do

1. Extract candidate IG nodes from each user message.
2. Merge/cluster nodes to avoid explosion.
3. Update weights continuously.
4. Track goal hypotheses silently.
5. Decide when to “commit moment.”

## 5.2 Weight update (simple v0)

Maintain node weight as a blend of:

* user emphasis (repetition, explicit “important”, time spent)
* centrality (connectedness to other high-weight nodes)
* recency (decay)
* goal alignment (if goal hypothesis confidence is high)

Example:

```
w_i ← clamp( α*w_i + β*user_emphasis + γ*centrality + δ*goal_alignment + ε*recency )
```

---

# 6) Auto “commit moment” detection (system-driven)

You want **Z** to decide commit, not the user. Define commit as:

> “The idea space has stabilized enough that producing a first DP will reduce user effort more than it risks steering them wrong.”

## 6.1 Metrics to compute (rolling window, e.g., last 8–12 turns)

### IG stability signals

* **Node churn**: new_nodes_per_turn
* **Weight volatility**: avg(|w_t - w_{t-1}|)
* **Cluster stability**: similarity between clusterings across turns
* **Edge volatility**: changes to edge weights / additions

### Goal confidence signals

* **doc_type_confidence**: max(goal_hypotheses.score)
* **success_criteria_confidence**: do we have even 1–2 strong signals?

### User readiness signals (implicit)

* “okay so how would I structure this”
* “what sections should I have”
* “help me write / outline”
* user starts summarizing (“so the main point is…”)

### DP feasibility signals

* Can we map top-K IG clusters into coherent sections?
* Do we have at least:

  * 1 clear core node
  * 3–7 supporting nodes
  * <= N open questions (or they are localized)

## 6.2 Commit rule (v0, deterministic + simple)

Commit when all are true:

1. **IG stability**:

   * new_nodes_per_turn ≤ 0.5 (avg over window)
   * weight_volatility ≤ 0.08 (avg absolute change)
2. **Core clarity**:

   * max_node_weight ≥ 0.75 AND top-3 nodes sum ≥ 1.8
3. **Structure emergence**:

   * at least 2 clusters with ≥2 nodes each (or 4–8 nodes total if clustering is weak)
4. **User readiness OR time pressure**:

   * readiness_phrase_detected == true
     **OR** session length exceeds a threshold (e.g., 10–15 minutes of ideation turns)

When triggered:

* system generates **DP v1** automatically and transitions UI into hybrid mode
* user can continue ideation *inside the DP* (edits update IG weights), but the “center of gravity” shifts

## 6.3 Safe fallback if commit was premature

Don’t ask permission; just make reversal cheap:

* Maintain `mode = formation` but allow “drift”:

  * if node churn spikes again for M turns, auto-relax back into ideation mode (DP updates but is marked “drafting outline” not “drafting prose”).

---

# 7) Event-driven pipeline (for code)

## 7.1 Core services (conceptual)

* **ChatIngestor**: receives message, assigns msg_id
* **IGBuilder**: extract/update nodes, edges, weights, provenance
* **GoalInferencer**: update goal_hypotheses
* **CommitDetector**: computes metrics + triggers DP generation
* **DPGenerator**: IG → DP draft (sections, scope, tone_guess)
* **IRBuilder**: DP → IR skeleton (sections/blocks)
* **ModeController**: ideation ↔ formation

## 7.2 Events

* `message_received(msg_id)`
* `ig_updated(ig_delta, metrics)`
* `goal_updated(goal_hypotheses_delta)`
* `commit_triggered(reason, metrics_snapshot)`
* `dp_generated(dp_v1)`
* `mode_changed(ideation|formation)`

---

# 8) What phase 2 looks like (brief)

* DP becomes the visible scaffold (outline in the editor).
* As user writes paragraphs, SG nodes are extracted **per block** and used for:

  * contradiction detection
  * missing-support warnings
  * scope drift detection (writing about out_of_scope IG nodes)
* The user sees only actionable guidance, not SG/IR internals.
