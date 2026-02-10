import type { AIService, AIModel } from '../ai-service.js';
import { z } from 'zod';
import type { DocPlanTemplateField } from './docplan-template.js';

const Resp = z
  .object({
    options: z.array(z.string()).default([]),
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

export async function shortlistFieldOptions(args: {
  service: AIService;
  dr: unknown;
  field: DocPlanTemplateField;
  model?: AIModel;
}): Promise<string[]> {
  const opts = args.field.options?.map((o) => o.label) ?? [];
  if (opts.length <= 4) return opts;

  const drAny = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const ideaGraph = isRecord(drAny.ideaGraph) ? drAny.ideaGraph : null;

  const system = `You are shortlisting dropdown options for a DocPlan field.

Rules:
- Pick 2–4 option labels from the provided list.
- Do NOT invent new labels.
- Return ONLY JSON: { "options": string[] }`;

  const user = `FIELD:
${JSON.stringify({ id: args.field.id, label: args.field.label }, null, 2)}

ALL OPTION LABELS:
${JSON.stringify(opts, null, 2)}

IDEA GRAPH (compact):
${JSON.stringify(ideaGraph, null, 2)}

LAST TURNS:
${JSON.stringify(lastTurns, null, 2)}
`;

  const raw = await args.service.chatJson({ system, user, temperature: 0.2 }, args.model);
  const parsed = Resp.parse(raw);
  const allowed = new Set(opts.map((x) => normalize(x)));
  const picked = parsed.options.map(String).filter((x) => allowed.has(normalize(x)));
  const out = Array.from(new Set(picked)).slice(0, 4);
  return out.length >= 2 ? out : opts.slice(0, 4);
}

