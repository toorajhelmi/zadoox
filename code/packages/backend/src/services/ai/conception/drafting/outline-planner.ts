import type { AIService, AIModel } from '../../ai-service.js';
import type { DraftTemplate } from '../doc-templates.js';
import type { ImportanceById } from './types.js';
import { OutlinePlan, type OutlinePlan as OutlinePlanT } from './types.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export async function planDraftOutline(args: {
  service: AIService;
  model?: AIModel;
  docType: string;
  docPlan: unknown;
  draftTemplate: DraftTemplate;
  includedGraph: { nodes: Array<{ id: string; label: string; importance: 'H' | 'M' | 'L' }>; edges: Array<{ src: string; dst: string }> };
  importanceById: ImportanceById;
}): Promise<{ outlinePlan: OutlinePlanT }> {
  const prefs = isRecord(args.docPlan) ? (args.docPlan as Record<string, unknown>) : {};

  const system = `You are planning an optimal document outline.

You will receive:
- docType
- DocPlan (non-content prefs)
- a baseline draft template with required sections
- an included IdeaGraph (nodes + edges) where nodes are labeled and scored H/M/L importance

Task:
- Produce an outline (sections + subsections) that fits the docType and DocPlan.
- Keep the outline concise and practical.
- Respect required baseline sections, but you may reorder, merge, or add subsections when helpful.
- Use the IdeaGraph importance: H must be emphasized, M included if relevant, L optional.
- Do not ask the user any questions.

Output ONLY JSON matching:
{ "docType": string, "sections": [{ "id": string, "title": string, "required"?: boolean, "notes"?: string[], "children"?: [...] }] }`;

  const user = `DOC TYPE:\n${args.docType}\n\nDOC PLAN:\n${JSON.stringify(prefs, null, 2)}\n\nBASELINE DRAFT TEMPLATE:\n${JSON.stringify(args.draftTemplate, null, 2)}\n\nINCLUDED IDEA GRAPH:\n${JSON.stringify(args.includedGraph, null, 2)}\n`;

  const raw = await args.service.chatJson({ system, user, temperature: 0.25 }, args.model);
  const parsed = OutlinePlan.parse(raw);
  return { outlinePlan: parsed };
}

