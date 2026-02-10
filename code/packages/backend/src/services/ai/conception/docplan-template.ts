import { z } from 'zod';
import { supabaseAdmin } from '../../../db/client.js';

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

const cache = new Map<string, { loadedAt: number; template: DocPlanTemplate }>();

export async function loadDocPlanTemplate(docType: string): Promise<DocPlanTemplate | null> {
  const key = String(docType ?? '').trim();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.loadedAt < 30_000) return cached.template;

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('docplan_templates')
    .select('template')
    .eq('doc_type', key)
    .maybeSingle();

  if (error) {
    const msg = String(error.message ?? '');
    // Common case in dev: migrations not applied yet (PostgREST schema cache).
    if (msg.includes('docplan_templates') && msg.toLowerCase().includes('schema cache')) {
      return null;
    }
    throw new Error(`Failed to load DocPlan template for ${key}: ${error.message}`);
  }
  const raw = (data as any)?.template ?? null;
  if (!raw) return null;

  const template = DocPlanTemplate.parse(raw);
  cache.set(key, { loadedAt: Date.now(), template });
  return template;
}

