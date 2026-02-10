import type { AIService, AIModel } from '../ai-service.js';
import { DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES } from '@zadoox/shared';
import { loadDocPlanTemplate } from './docplan-template.js';
import type { DocPlanTemplate, DocPlanTemplateField } from './docplan-template.js';
import { pickMediumFieldsToAsk } from './formalization-medium-pick.js';
import { shortlistFieldOptions } from './formalization-field-shortlist.js';
import { suggestFormalizationForSlot } from './formalization-suggest.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function normalize(s: string): string {
  return String(s ?? '')
    .toLowerCase()
    .trim()
    .replace(/["'“”‘’]+/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDocTypeValueFromUser(message: string): string | null {
  const m = normalize(message);
  if (!m) return null;
  for (const c of DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES) {
    if (normalize(c.label) === m) return c.value;
  }
  if (/\bblog\b|\bpost\b/.test(m)) return 'blog';
  if (/\bwhitepaper\b|\bwhite paper\b/.test(m)) return 'whitepaper';
  if (/\bpaper\b|\bacademic\b|\bresearch\b/.test(m)) return 'academic_paper';
  if (/\bother\b/.test(m)) return 'other';
  return null;
}

function getPrefs(dp: Record<string, unknown> | null): Record<string, unknown> {
  const prefs = dp && isRecord((dp as any).prefs) ? ((dp as any).prefs as Record<string, unknown>) : {};
  return prefs;
}

function setPrefPatch(prefs: Record<string, unknown>, fieldId: string, value: unknown): Record<string, unknown> {
  return { ...prefs, [fieldId]: value };
}

function answered(prefs: Record<string, unknown>, fieldId: string): boolean {
  const v = prefs[fieldId];
  if (v === null || v === undefined) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function computeCompleteness(args: {
  template: DocPlanTemplate;
  prefs: Record<string, unknown>;
  selectedMediumFieldIds: string[];
}): { score: number; ready: boolean; requiredIds: string[]; answeredIds: string[] } {
  const highIds = args.template.fields.filter((f) => f.priority === 'high').map((f) => f.id);
  const requiredIds = [...highIds, ...args.selectedMediumFieldIds];
  const answeredIds = requiredIds.filter((id) => answered(args.prefs, id));
  const score = requiredIds.length === 0 ? 1 : answeredIds.length / requiredIds.length;
  return { score, ready: score >= 0.99, requiredIds, answeredIds };
}

function findField(template: DocPlanTemplate, id: string): DocPlanTemplateField | null {
  return template.fields.find((f) => f.id === id) ?? null;
}

/**
 * Formalization state machine (no phase decision prompt).
 * - Applies user's answer to the previously asked slot (if any)
 * - Picks the next slot question
 * - Computes DocPlan completeness and emits a "ready" message when complete
 */
export async function runConceptionFormalizationStep(args: {
  service: AIService;
  message: string;
  dr: unknown;
  model?: AIModel;
}): Promise<{
  assistantText: string;
  phase: 'formalization';
  convergenceScore: number;
  allowIgUpdates: false;
  docPlanPatch?: unknown;
  dmPatch: Record<string, unknown>;
}> {
  const drAny = isRecord(args.dr) ? args.dr : {};
  const dpAny = isRecord(drAny.docPlan) ? (drAny.docPlan as Record<string, unknown>) : null;
  const dmAny = isRecord(drAny.dm) ? (drAny.dm as Record<string, unknown>) : {};

  const msg = String(args.message ?? '').trim();
  const prevLastAskedFieldId = typeof (dmAny as any).lastAskedFieldId === 'string' ? String((dmAny as any).lastAskedFieldId) : null;
  const askedFieldIds = Array.isArray((dmAny as any).askedFieldIds) ? ((dmAny as any).askedFieldIds as unknown[]).map(String) : [];
  const answeredFieldIds = Array.isArray((dmAny as any).answeredFieldIds) ? ((dmAny as any).answeredFieldIds as unknown[]).map(String) : [];
  const selectedMediumFieldIds = Array.isArray((dmAny as any).selectedMediumFieldIds) ? ((dmAny as any).selectedMediumFieldIds as unknown[]).map(String) : [];

  let docPlanPatch: Record<string, unknown> | null = null;
  let prefs = getPrefs(dpAny);

  // Apply answer to previous asked field (including docType).
  if (prevLastAskedFieldId && msg) {
    if (prevLastAskedFieldId === 'docType') {
      const v = parseDocTypeValueFromUser(msg);
      if (v) {
        docPlanPatch = { ...(docPlanPatch ?? {}), docType: v };
      }
    } else {
      // Template field
      const templateDocType = String((dpAny as any)?.docType ?? '').trim();
      const template = templateDocType ? await loadDocPlanTemplate(templateDocType) : null;
      const field = template ? findField(template, prevLastAskedFieldId) : null;
      if (field) {
        if (field.inputKind === 'dropdown' && field.options) {
          const chosenLabel = msg;
          const found = field.options.find((o) => normalize(o.label) === normalize(chosenLabel));
          if (found) {
            prefs = setPrefPatch(prefs, field.id, found.value);
            docPlanPatch = { ...(docPlanPatch ?? {}), prefs };
          }
        } else {
          // text
          if (normalize(msg) !== normalize('Other (type it)')) {
            prefs = setPrefPatch(prefs, field.id, msg);
            docPlanPatch = { ...(docPlanPatch ?? {}), prefs };
          }
        }
      }
    }
  }

  // Effective docType after patch.
  const docTypeEffective = String(((docPlanPatch as any)?.docType ?? (dpAny as any)?.docType ?? 'unknown')).trim() || 'unknown';
  if (docTypeEffective === 'unknown') {
    const s = await suggestFormalizationForSlot({ service: args.service, dr: args.dr, slot: 'docType', model: args.model });
    const options = (s.options.length > 0 ? s.options : DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES.map((c) => c.label))
      .slice(0, 4)
      .map((x) => `- ${x}`)
      .join('\n');
    return {
      assistantText: `OK — let’s plan the document.\n\nWhat kind of document are we writing?\n${options}`,
      phase: 'formalization',
      convergenceScore: 0.2,
      allowIgUpdates: false,
      ...(docPlanPatch ? { docPlanPatch } : {}),
      dmPatch: {
        phase: 'formalization',
        allowIgUpdates: false,
        lastAskedFieldId: 'docType',
        askedFieldIds: Array.from(new Set([...askedFieldIds, 'docType'])),
        suggestedDocTypeOptions: s.options,
      },
    };
  }

  const template = await loadDocPlanTemplate(docTypeEffective);
  if (!template) {
    return {
      assistantText:
        `Doc Plan templates aren’t available yet (missing \`docplan_templates\` table).\n\n` +
        `Run migrations, then try again:\n` +
        `- pnpm --filter @zadoox/backend db:migrate`,
      phase: 'formalization',
      convergenceScore: 0.2,
      allowIgUpdates: false,
      ...(docPlanPatch ? { docPlanPatch } : {}),
      dmPatch: { phase: 'formalization', allowIgUpdates: false, docPlanReady: false },
    };
  }

  // Ensure selected medium fields chosen once per doc type.
  let selectedMedium = selectedMediumFieldIds;
  if (selectedMedium.length === 0) {
    const picked = await pickMediumFieldsToAsk({ service: args.service, dr: args.dr, template, model: args.model });
    selectedMedium = picked.mediumFieldIds;
  }

  // Determine required fields = all High + selected Medium
  const requiredIds = [
    ...template.fields.filter((f) => f.priority === 'high').map((f) => f.id),
    ...selectedMedium,
  ];
  const requiredSet = new Set(requiredIds);
  const answeredNow = new Set<string>(answeredFieldIds);
  for (const id of requiredIds) {
    if (answered(prefs, id)) answeredNow.add(id);
  }
  const required = Array.from(requiredSet);
  const answeredReq = required.filter((id) => answeredNow.has(id));
  const score = required.length === 0 ? 1 : answeredReq.length / required.length;
  const ready = score >= 0.99;

  const dmPatchBase: Record<string, unknown> = {
    phase: 'formalization',
    allowIgUpdates: false,
    docPlanTemplate: template,
    selectedMediumFieldIds: selectedMedium,
    askedFieldIds: Array.from(new Set(askedFieldIds)),
    answeredFieldIds: Array.from(answeredNow),
    docPlanCompleteness: score,
    docPlanReady: ready,
    convergenceScore: score,
    formalizationState: ready ? 'ready' : 'collect',
  };

  if (ready) {
    return {
      assistantText: `Doc Plan looks complete.\n\nIf you want, tell me: "start writing" — or edit any optional fields in Doc Plan.`,
      phase: 'formalization',
      convergenceScore: score,
      allowIgUpdates: false,
      ...(docPlanPatch ? { docPlanPatch } : {}),
      dmPatch: dmPatchBase,
    };
  }

  const nextFieldId = required.find((id) => !answeredNow.has(id)) ?? null;
  if (!nextFieldId) {
    return {
      assistantText: `Doc Plan looks complete.\n\nIf you want, tell me: "start writing" — or edit any optional fields in Doc Plan.`,
      phase: 'formalization',
      convergenceScore: score,
      allowIgUpdates: false,
      ...(docPlanPatch ? { docPlanPatch } : {}),
      dmPatch: { ...dmPatchBase, docPlanReady: true, formalizationState: 'ready' },
    };
  }

  const field = findField(template, nextFieldId);
  if (!field) {
    return {
      assistantText: `I’m missing a field definition for "${nextFieldId}".`,
      phase: 'formalization',
      convergenceScore: score,
      allowIgUpdates: false,
      ...(docPlanPatch ? { docPlanPatch } : {}),
      dmPatch: dmPatchBase,
    };
  }

  let assistantText = `${field.label}?\n`;
  if (field.inputKind === 'dropdown' && field.options) {
    const shortlist = await shortlistFieldOptions({ service: args.service, dr: args.dr, field, model: args.model });
    assistantText += `\n${shortlist.map((x) => `- ${x}`).join('\n')}`;
  } else {
    assistantText += `\n- Other (type it)`;
  }

  return {
    assistantText,
    phase: 'formalization',
    convergenceScore: score,
    allowIgUpdates: false,
    ...(docPlanPatch ? { docPlanPatch } : {}),
    dmPatch: {
      ...dmPatchBase,
      lastAskedFieldId: field.id,
      askedFieldIds: Array.from(new Set([...(dmPatchBase.askedFieldIds as string[]), field.id])),
    },
  };
}

