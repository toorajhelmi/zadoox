import { z } from 'zod';

export const DraftImportance = z.enum(['H', 'M', 'L']);
export type DraftImportance = z.infer<typeof DraftImportance>;

export const ImportanceById = z.record(DraftImportance).default({});
export type ImportanceById = z.infer<typeof ImportanceById>;

export const IncludedNodeIds = z.array(z.string().min(1)).default([]);

export type OutlineSection = {
  id: string;
  title: string;
  children?: OutlineSection[];
  notes?: string[];
  required?: boolean;
};

export const OutlineSection: z.ZodType<OutlineSection> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      title: z.string().min(1),
      children: z.array(OutlineSection).optional(),
      notes: z.array(z.string()).optional(), // internal notes for materialization
      required: z.boolean().optional(),
    })
    .strict()
);

export const OutlinePlan = z
  .object({
    docType: z.string().min(1),
    sections: z.array(OutlineSection).min(1),
  })
  .strict();
export type OutlinePlan = z.infer<typeof OutlinePlan>;

export const MaterializeDraftRequest = z
  .object({
    dr: z.unknown(),
    includedNodeIds: IncludedNodeIds.optional(),
    importanceById: ImportanceById.optional(),
  })
  .strict();
export type MaterializeDraftRequest = z.infer<typeof MaterializeDraftRequest>;

export const MaterializeDraftResponse = z
  .object({
    outlinePlan: OutlinePlan,
    xmd: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();
export type MaterializeDraftResponse = z.infer<typeof MaterializeDraftResponse>;

