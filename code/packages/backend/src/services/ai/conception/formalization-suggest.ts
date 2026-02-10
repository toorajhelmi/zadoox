import type { AIService, AIModel } from '../ai-service.js';
import { z } from 'zod';
import { DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES } from '@zadoox/shared';

const SuggestSlot = z.enum(['docType', 'workingTitle', 'oneLiner', 'sections']);
type SuggestSlot = z.infer<typeof SuggestSlot>;

const SuggestResponse = z
  .object({
    // Optional pre-fill guess (only when confident).
    inferred: z
      .object({
        docTypeLabel: z.string().optional(),
        workingTitle: z.string().optional(),
        oneLiner: z.string().optional(),
        sections: z.array(z.string()).optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
      .optional(),
    // Shortlist options for the user to pick from (rendered as clickable hyphen list).
    options: z.array(z.string()).min(0).max(6).default([]),
    // For sections: suggested section titles to preview/apply.
    suggestedSections: z.array(z.string()).min(0).max(8).optional(),
  })
  .strict();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function normalize(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeOptions(opts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of opts) {
    const key = normalize(o);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  return out;
}

export async function suggestFormalizationForSlot(args: {
  service: AIService;
  dr: unknown;
  slot: SuggestSlot;
  model?: AIModel;
}): Promise<z.infer<typeof SuggestResponse>> {
  const { service, model, slot } = args;
  const drAny = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const ideaGraph = isRecord(drAny.ideaGraph) ? drAny.ideaGraph : null;
  const dp = isRecord(drAny.docPlan) ? drAny.docPlan : {};

  const inventories = {
    docTypePrimaryChoices: DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES.map((c) => ({ label: c.label, value: c.value })),
  };

  const system = `You are helping choose the next DocPlan value during formalization.

Goal:
- Produce a SHORT shortlist of 2–4 clickable options based on the user's prior chat + idea graph.
- Only output options that are plausible given DR.
- Prefer proposing an inferred answer when confident (and still include options so user can change).

Inventory (authoritative when applicable):
${JSON.stringify(inventories, null, 2)}

Rules:
- For slot="docType": options MUST be drawn from inventories.docTypePrimaryChoices[].label (and may include "Other (type it)" if present in inventory).
- For other slots: options must be plain strings the user could click (e.g., a title).
- Keep options short; each option must be a single line.
- Return ONLY JSON with shape:
{
  "inferred"?: { ... },
  "options": string[],
  "suggestedSections"?: string[]
}
`;

  const user = `SLOT: ${slot}

CURRENT DOC PLAN (may be partial):
${JSON.stringify(dp, null, 2)}

IDEA GRAPH (compact, may be partial):
${JSON.stringify(ideaGraph, null, 2)}

LAST TURNS:
${JSON.stringify(lastTurns, null, 2)}

Return the JSON.`;

  const raw = await service.chatJson({ system, user, temperature: 0.2 }, model);
  const parsed = SuggestResponse.parse(raw);

  // Defensive normalization: ensure docType options are inventory labels.
  if (slot === 'docType') {
    const allowed = new Set(inventories.docTypePrimaryChoices.map((c) => normalize(c.label)));
    const fixed = parsed.options.filter((o) => allowed.has(normalize(o)));
    parsed.options = dedupeOptions(fixed).slice(0, 4);
    if (parsed.options.length === 0) {
      parsed.options = inventories.docTypePrimaryChoices.map((c) => c.label).slice(0, 4);
    }
  } else {
    parsed.options = dedupeOptions(parsed.options).slice(0, 4);
  }

  if (Array.isArray(parsed.suggestedSections)) {
    parsed.suggestedSections = dedupeOptions(parsed.suggestedSections).slice(0, 8);
  }

  return parsed;
}

