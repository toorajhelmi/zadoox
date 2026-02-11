import { z } from 'zod';
import { supabaseAdmin } from '../../../db/client.js';

// -----------------------------
// DocPlan template (planning)
// -----------------------------

export const DocPlanFieldPriority = z.enum(['high', 'medium', 'low']);
export type DocPlanFieldPriority = z.infer<typeof DocPlanFieldPriority>;

export const DocPlanFieldInputKind = z.enum(['dropdown', 'short_text', 'long_text']);
export type DocPlanFieldInputKind = z.infer<typeof DocPlanFieldInputKind>;

export const DocPlanTemplateField = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    priority: DocPlanFieldPriority,
    inputKind: DocPlanFieldInputKind,
    options: z
      .array(
        z.object({
          value: z.string().min(1),
          label: z.string().min(1),
        })
      )
      .optional(),
  })
  .strict();
export type DocPlanTemplateField = z.infer<typeof DocPlanTemplateField>;

export const DocPlanTemplate = z
  .object({
    docType: z.string().min(1),
    implicit: z.record(z.string()).optional(),
    fields: z.array(DocPlanTemplateField).min(1),
  })
  .strict();
export type DocPlanTemplate = z.infer<typeof DocPlanTemplate>;

// -----------------------------
// Draft template (baseline sections)
// -----------------------------

export type DraftTemplateSection = {
  id: string;
  title: string;
  required?: boolean;
  children?: DraftTemplateSection[];
};

export const DraftTemplateSection: z.ZodType<DraftTemplateSection> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      required: z.boolean().optional().default(false),
      children: z.array(DraftTemplateSection).optional(),
    })
    .strict()
);

export const DraftTemplate = z
  .object({
    docType: z.string().min(1),
    sections: z.array(DraftTemplateSection).default([]),
  })
  .strict();
export type DraftTemplate = z.infer<typeof DraftTemplate>;

type CacheEntry<T> = { loadedAt: number; value: T };
const docPlanCache = new Map<string, CacheEntry<DocPlanTemplate | null>>();
const draftCache = new Map<string, CacheEntry<DraftTemplate | null>>();

function isSchemaCacheMissing(msg: string, table: string): boolean {
  return msg.includes(table) && msg.toLowerCase().includes('schema cache');
}

async function selectTemplatesRow(docType: string): Promise<{ docplan_template: unknown; draft_template: unknown } | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('doc_templates')
    .select('docplan_template, draft_template')
    .eq('doc_type', docType)
    .maybeSingle();

  if (error) {
    const msg = String(error.message ?? '');
    // Common case in dev: migrations not applied yet (PostgREST schema cache).
    if (isSchemaCacheMissing(msg, 'doc_templates')) return null;
    throw new Error(`Failed to load doc template for ${docType}: ${error.message}`);
  }

  const row = data as { docplan_template?: unknown; draft_template?: unknown } | null;
  if (!row) return null;
  return { docplan_template: row.docplan_template ?? null, draft_template: row.draft_template ?? null };
}

export async function loadDocPlanTemplate(docType: string): Promise<DocPlanTemplate | null> {
  const key = String(docType ?? '').trim();
  if (!key) return null;

  const cached = docPlanCache.get(key);
  if (cached && Date.now() - cached.loadedAt < 30_000) return cached.value;

  const row = await selectTemplatesRow(key);
  if (!row || !row.docplan_template) {
    docPlanCache.set(key, { loadedAt: Date.now(), value: null });
    return null;
  }

  const out = DocPlanTemplate.parse(row.docplan_template);
  docPlanCache.set(key, { loadedAt: Date.now(), value: out });
  return out;
}

export async function loadDraftTemplate(docType: string): Promise<DraftTemplate | null> {
  const key = String(docType ?? '').trim();
  if (!key) return null;

  const cached = draftCache.get(key);
  if (cached && Date.now() - cached.loadedAt < 30_000) return cached.value;

  const row = await selectTemplatesRow(key);
  if (!row || !row.draft_template) {
    draftCache.set(key, { loadedAt: Date.now(), value: null });
    return null;
  }

  const out = DraftTemplate.parse(row.draft_template);
  draftCache.set(key, { loadedAt: Date.now(), value: out });
  return out;
}

