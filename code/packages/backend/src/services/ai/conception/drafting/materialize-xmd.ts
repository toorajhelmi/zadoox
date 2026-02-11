import type { AIService, AIModel } from '../../ai-service.js';
import type { OutlinePlan } from './types.js';

export async function materializeDraftXmd(args: {
  service: AIService;
  model?: AIModel;
  docType: string;
  docPlan: unknown;
  outlinePlan: OutlinePlan;
  includedGraph: { nodes: Array<{ id: string; label: string; importance: 'H' | 'M' | 'L' }>; edges: Array<{ src: string; dst: string }> };
}): Promise<{ xmd: string; summary: string }> {
  const system = `You are writing a first draft skeleton in Extended Markdown (XMD) for the Zadoox editor.

Constraints:
- Do NOT ask the user any questions.
- Produce a usable first draft even if some information is missing.
- When information is missing, insert clear TODO markers (use lines starting with "TODO:").
- Keep content grounded in the included IdeaGraph nodes; prioritize H over M over L.
- Output must be ONLY JSON: { "summary": string, "xmd": string }.

XMD formatting rules:
- Document title is a single line starting with "@ " (e.g. "@ My Title").
- Section headings use Markdown headings like "#", "##", etc.
- Use paragraphs and bullet lists normally.
`;

  const user = `DOC TYPE:\n${args.docType}\n\nDOC PLAN:\n${JSON.stringify(args.docPlan, null, 2)}\n\nOUTLINE PLAN:\n${JSON.stringify(args.outlinePlan, null, 2)}\n\nINCLUDED IDEA GRAPH:\n${JSON.stringify(args.includedGraph, null, 2)}\n`;

  const raw = await args.service.chatJson({ system, user, temperature: 0.35 }, args.model);
  const obj = raw as { summary?: unknown; xmd?: unknown };
  const summary = typeof obj.summary === 'string' ? obj.summary.trim() : '';
  const xmd = typeof obj.xmd === 'string' ? obj.xmd.trim() : '';
  if (!summary || !xmd) throw new Error('Failed to materialize draft');
  return { summary, xmd };
}

