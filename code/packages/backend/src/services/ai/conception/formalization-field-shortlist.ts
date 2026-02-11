import type { AIService, AIModel } from '../ai-service.js';
import { z } from 'zod';
import type { DocPlanTemplateField } from './docplan-template.js';

const Resp = z
  .object({
    options: z.array(z.string()).default([]),
    question: z.string().optional(),
  })
  .strict();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function compactIdeaGraphForPrompt(ideaGraph: unknown): unknown {
  if (!isRecord(ideaGraph)) return null;
  const nodesAny = (ideaGraph as { nodes?: unknown }).nodes;
  const edgesAny = (ideaGraph as { edges?: unknown }).edges;
  const nodes = Array.isArray(nodesAny) ? nodesAny.slice(0, 25) : [];
  const edges = Array.isArray(edgesAny) ? edgesAny.slice(0, 40) : [];
  // Keep any additional lightweight metadata if present.
  const out: Record<string, unknown> = { nodes, edges };
  const meta = (ideaGraph as { meta?: unknown }).meta;
  if (isRecord(meta)) out.meta = meta;
  return out;
}

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
}): Promise<{ options: string[]; question?: string }> {
  const opts = args.field.options?.map((o) => o.label) ?? [];
  if (opts.length <= 4) return { options: opts };

  const drAny = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const ideaGraph = compactIdeaGraphForPrompt((drAny as { ideaGraph?: unknown }).ideaGraph);

  const system = `You are shortlisting dropdown options for a DocPlan field.

Rules:
- Pick 2–4 option labels from the provided list.
- Do NOT invent new labels.
- Also produce ONE natural-sounding single-line question for the user.
- The question must NOT include the options list.
- Avoid "Quick question" / "Doc Plan" boilerplate.
- Return ONLY JSON: { "options": string[], "question"?: string }`;

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
  const finalOptions = out.length >= 2 ? out : opts.slice(0, 4);
  const question = typeof parsed.question === 'string' ? parsed.question.trim() : undefined;
  return { options: finalOptions, ...(question ? { question } : {}) };
}

