import type { AIService, AIModel } from '../ai-service.js';
import { z } from 'zod';
import type { DocPlanTemplateField } from './docplan-template.js';

const Resp = z
  .object({
    question: z.string(),
  })
  .strict();

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function safeOneLine(s: string): string {
  return String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function fallbackQuestion(field: DocPlanTemplateField): string {
  const label = safeOneLine(String(field.label ?? 'this'));
  if (field.inputKind === 'dropdown') return `Which ${label} should we use?`;
  return `What should we use for ${label}?`;
}

export async function generateFormalizationQuestion(args: {
  service: AIService;
  dr: unknown;
  docType: string;
  field: DocPlanTemplateField;
  options?: string[]; // labels, not values
  model?: AIModel;
}): Promise<string> {
  const drAny = isRecord(args.dr) ? args.dr : {};
  const lastTurns = Array.isArray(drAny.lastTurns) ? drAny.lastTurns : [];
  const recentAssistant = lastTurns
    .filter(
      (t): t is { role?: unknown; content?: unknown } =>
        isRecord(t) && t.role === 'assistant' && typeof (t as { content?: unknown }).content === 'string'
    )
    .slice(-6)
    .map((t) => safeOneLine(String(t.content)))
    .filter(Boolean);

  const system = `You write ONE natural-sounding question for a document-planning (Doc Plan) flow.

Rules:
- Output ONLY JSON: { "question": string }
- The question must be a single line (no bullets, no numbering).
- Keep it short (ideally under 120 characters).
- Do not say "Quick question", "Doc Plan", or other boilerplate.
- Avoid repeating phrasing from recent assistant questions.
- If the field is a dropdown, ask the user to pick an option (do NOT list the options in the question).
`;

  const user = `DOC TYPE:
${safeOneLine(args.docType)}

FIELD:
${JSON.stringify({ id: args.field.id, label: args.field.label, inputKind: args.field.inputKind }, null, 2)}

OPTION LABELS (if dropdown):
${JSON.stringify(args.options ?? [], null, 2)}

RECENT ASSISTANT QUESTIONS (verbatim):
${JSON.stringify(recentAssistant, null, 2)}
`;

  try {
    const raw = await args.service.chatJson({ system, user, temperature: 0.6 }, args.model);
    const parsed = Resp.parse(raw);
    const q = safeOneLine(parsed.question);
    return q.length > 0 ? q : fallbackQuestion(args.field);
  } catch {
    return fallbackQuestion(args.field);
  }
}

