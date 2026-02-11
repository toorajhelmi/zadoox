import type { AIService, AIModel } from '../../ai-service.js';
import { loadDraftTemplate, loadDocPlanTemplate } from '../doc-templates.js';
import type { DocPlanTemplate } from '../doc-templates.js';
import { MaterializeDraftRequest, type MaterializeDraftResponse } from './types.js';
import { compactIncludedGraph, extractIdeaGraph, pickIncludedNodes } from './ig-selection.js';
import { planDraftOutline } from './outline-planner.js';
import { materializeDraftXmd } from './materialize-xmd.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function extractDocPlan(dr: unknown): { docType: string; docPlan: Record<string, unknown> } {
  const drAny = isRecord(dr) ? dr : {};
  const dpAny = isRecord((drAny as { docPlan?: unknown }).docPlan) ? ((drAny as { docPlan?: unknown }).docPlan as Record<string, unknown>) : {};
  const docType = String((dpAny as { docType?: unknown }).docType ?? 'unknown').trim() || 'unknown';
  return { docType, docPlan: dpAny };
}

function summarizeDocPlan(args: { docType: string; docPlan: Record<string, unknown>; template: DocPlanTemplate | null }): string {
  const prefs = isRecord((args.docPlan as { prefs?: unknown }).prefs) ? ((args.docPlan as { prefs?: unknown }).prefs as Record<string, unknown>) : {};
  const bits: string[] = [];
  bits.push(`Doc type: ${args.docType}`);
  const length = prefs['length.target'] ?? prefs['academic.targetLength'];
  if (length) bits.push(`Target length: ${String(length)}`);
  const detail = prefs['detail.level'];
  if (detail) bits.push(`Detail: ${String(detail)}`);
  return bits.join(' • ');
}

export async function materializeConceptionDraft(args: {
  service: AIService;
  model?: AIModel;
  body: unknown;
}): Promise<MaterializeDraftResponse> {
  const req = MaterializeDraftRequest.parse(args.body);

  const { docType, docPlan } = extractDocPlan(req.dr);
  if (!docType || docType === 'unknown') {
    throw new Error('Doc type is required before drafting');
  }

  const { nodes, edges } = extractIdeaGraph(req.dr);
  if (nodes.length === 0) throw new Error('IdeaGraph is empty');

  const { includedIds } = pickIncludedNodes({ nodes, edges, includedNodeIds: req.includedNodeIds ?? [] });
  const importanceById = req.importanceById ?? {};
  const includedGraph = compactIncludedGraph({ includedIds, nodes, edges, importanceById });

  const draftTemplate = await loadDraftTemplate(docType);
  if (!draftTemplate) throw new Error(`Missing draft template for ${docType}`);

  const dpTemplate = await loadDocPlanTemplate(docType);
  const summary = summarizeDocPlan({ docType, docPlan, template: dpTemplate });

  const { outlinePlan } = await planDraftOutline({
    service: args.service,
    model: args.model,
    docType,
    docPlan,
    draftTemplate,
    includedGraph,
    importanceById,
  });

  const { xmd, summary: generatedSummary } = await materializeDraftXmd({
    service: args.service,
    model: args.model,
    docType,
    docPlan,
    outlinePlan,
    includedGraph,
  });

  return {
    outlinePlan,
    xmd,
    summary: generatedSummary || summary,
  };
}

