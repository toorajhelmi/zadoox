import type { AIService, AIModel } from '../ai-service.js';
import { z } from 'zod';
import type { DocPlanTemplate } from './docplan-template.js';

const PickResponse = z
  .object({
    mediumFieldIds: z.array(z.string()).default([]),
    rationale: z.string().optional(),
  })
  .strict();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export async function pickMediumFieldsToAsk(args: {
  service: AIService;
  dr: unknown;
  template: DocPlanTemplate;
  model?: AIModel;
}): Promise<{ mediumFieldIds: string[] }> {
  const drAny = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const ideaGraph = isRecord(drAny.ideaGraph) ? drAny.ideaGraph : null;

  const medium = (args.template.fields ?? []).filter((f) => f.priority === 'medium');
  if (medium.length === 0) return { mediumFieldIds: [] };

  const system = `You are selecting which Medium-priority DocPlan fields are worth asking during planning.

Rules:
- Choose 0–5 mediumFieldIds from the provided list.
- Base this on what the user has discussed so far (turns + idea graph).
- Output ONLY JSON: { "mediumFieldIds": string[] }`;

  const user = `DOC TYPE: ${args.template.docType}

MEDIUM FIELDS (candidates):
${JSON.stringify(medium.map((f) => ({ id: f.id, label: f.label, inputKind: f.inputKind, options: f.options?.map((o) => o.label) ?? null })), null, 2)}

IDEA GRAPH (compact):
${JSON.stringify(ideaGraph, null, 2)}

LAST TURNS:
${JSON.stringify(lastTurns, null, 2)}
`;

  const raw = await args.service.chatJson({ system, user, temperature: 0.15 }, args.model);
  const parsed = PickResponse.parse(raw);
  const allowed = new Set(medium.map((f) => f.id));
  const picked = parsed.mediumFieldIds.map(String).filter((id) => allowed.has(id));
  // De-dupe and cap.
  const out = Array.from(new Set(picked)).slice(0, 5);
  return { mediumFieldIds: out };
}

