import type { AIService, AIModel } from '../ai-service.js';
import { DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES } from '@zadoox/shared';
import { loadDocPlanTemplate } from './docplan-template.js';
import type { DocPlanTemplate, DocPlanTemplateField } from './docplan-template.js';
import { pickMediumFieldsToAsk } from './formalization-medium-pick.js';
import { shortlistFieldOptions } from './formalization-field-shortlist.js';
import { generateFormalizationQuestion } from './formalization-question.js';
import { suggestFormalizationForSlot } from './formalization-suggest.js';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return new Promise<T>((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    p.then(resolve, reject).finally(() => {
      if (timer) clearTimeout(timer);
    });
  });
}

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
  if (!dp) return {};
  const prefs = (dp as { prefs?: unknown }).prefs;
  return isRecord(prefs) ? prefs : {};
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
  const prevLastAskedFieldId =
    typeof (dmAny as { lastAskedFieldId?: unknown }).lastAskedFieldId === 'string'
      ? String((dmAny as { lastAskedFieldId?: unknown }).lastAskedFieldId)
      : null;
  const askedFieldIds = Array.isArray((dmAny as { askedFieldIds?: unknown }).askedFieldIds)
    ? ((dmAny as { askedFieldIds?: unknown }).askedFieldIds as unknown[]).map(String)
    : [];
  const answeredFieldIds = Array.isArray((dmAny as { answeredFieldIds?: unknown }).answeredFieldIds)
    ? ((dmAny as { answeredFieldIds?: unknown }).answeredFieldIds as unknown[]).map(String)
    : [];
  const selectedMediumFieldIds = Array.isArray((dmAny as { selectedMediumFieldIds?: unknown }).selectedMediumFieldIds)
    ? ((dmAny as { selectedMediumFieldIds?: unknown }).selectedMediumFieldIds as unknown[]).map(String)
    : [];

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
      const templateDocType = String((dpAny as { docType?: unknown } | null)?.docType ?? '').trim();
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
  const patchedDocType = (docPlanPatch as { docType?: unknown } | null)?.docType;
  const priorDocType = (dpAny as { docType?: unknown } | null)?.docType;
  const docTypeEffective = String(patchedDocType ?? priorDocType ?? 'unknown').trim() || 'unknown';
  if (docTypeEffective === 'unknown') {
    const s = await suggestFormalizationForSlot({ service: args.service, dr: args.dr, slot: 'docType', model: args.model });
    const optionLabels = (s.options.length > 0 ? s.options : DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES.map((c) => c.label)).slice(0, 4);
    const q = await generateFormalizationQuestion({
      service: args.service,
      dr: args.dr,
      docType: 'unknown',
      field: { id: 'docType', label: 'document type', inputKind: 'dropdown', priority: 'high', options: [] },
      options: optionLabels,
      model: args.model,
    });
    const options = optionLabels.map((x) => `- ${x}`).join('\n');
    return {
      assistantText: `${q}\n${options}`,
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

  let assistantText = '';
  if (field.inputKind === 'dropdown' && field.options) {
    const fallbackOptions = field.options.map((o) => o.label).slice(0, 4);
    const shortlistRes = await withTimeout(
      shortlistFieldOptions({ service: args.service, dr: args.dr, field, model: args.model }),
      12_000
    ).catch(() => ({ options: fallbackOptions } as { options: string[]; question?: string }));
    const shortlist = shortlistRes.options?.length ? shortlistRes.options : fallbackOptions;

    const q =
      shortlistRes.question?.trim() ||
      (await withTimeout(
        generateFormalizationQuestion({
          service: args.service,
          dr: args.dr,
          docType: docTypeEffective,
          field,
          options: shortlist,
          model: args.model,
        }),
        8_000
      ).catch(() => `Which option should we pick?`));

    assistantText = `${q}\n\n${shortlist.map((x) => `- ${x}`).join('\n')}`;
  } else {
    const q = await withTimeout(
      generateFormalizationQuestion({ service: args.service, dr: args.dr, docType: docTypeEffective, field, model: args.model }),
      8_000
    ).catch(() => `What should we use here?`);
    assistantText = q;
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

