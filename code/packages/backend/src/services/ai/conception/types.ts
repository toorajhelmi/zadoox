import { z } from 'zod';
import { DOC_PLAN_DOC_TYPE_VALUES } from '@zadoox/shared';

export const ConceptionPhase = z.enum(['ideation', 'formalization']);
export type ConceptionPhase = z.infer<typeof ConceptionPhase>;

const DocType = z.enum(DOC_PLAN_DOC_TYPE_VALUES);

export const ConceptionDocPlanPatch = z
  .object({
    docType: DocType.optional(),
    prefs: z.record(z.unknown()).optional(),
    workingTitle: z.string().optional(),
    oneLiner: z.string().optional(),
    toneGuess: z.array(z.string()).optional(),
    sections: z
      .array(
        z.object({
          title: z.string().min(1),
          intent: z.string().optional(),
          bullets: z.array(z.string()).optional(),
        })
      )
      .optional(),
    openQuestions: z
      .array(
        z.object({
          igId: z.string().optional(),
          question: z.string().min(1),
        })
      )
      .optional(),
    scope: z
      .object({
        inScope: z.array(z.object({ igId: z.string().min(1), targetWeight: z.number().optional() })).optional(),
        outOfScope: z.array(z.object({ igId: z.string().min(1) })).optional(),
      })
      .optional(),
  })
  .strict();
export type ConceptionDocPlanPatch = z.infer<typeof ConceptionDocPlanPatch>;

export const ConceptionDmResponse = z.object({
  assistantText: z.string().min(1),
  phase: ConceptionPhase,
  convergenceScore: z.number().min(0).max(1),
  allowIgUpdates: z.boolean(),
  docPlanPatch: ConceptionDocPlanPatch.optional(),
  dmPatch: z
    .object({
      phase: ConceptionPhase.optional(),
      convergenceScore: z.number().min(0).max(1).optional(),
      allowIgUpdates: z.boolean().optional(),
      askedSlots: z.array(z.string()).optional(),
      answeredSlots: z.array(z.string()).optional(),
      lastAskedSlot: z.string().nullable().optional(),
      lastAskedFieldId: z.string().nullable().optional(),
      formalizationState: z.string().optional(),
      docPlanCompleteness: z.number().min(0).max(1).optional(),
      docPlanReady: z.boolean().optional(),
      formalizationStartTurnId: z.string().optional(),
      suggestedDocTypeOptions: z.array(z.string()).optional(),
      suggestedWorkingTitles: z.array(z.string()).optional(),
      suggestedOneLiners: z.array(z.string()).optional(),
      suggestedSections: z.array(z.string()).optional(),
      docPlanTemplate: z.unknown().optional(),
      selectedMediumFieldIds: z.array(z.string()).optional(),
      askedFieldIds: z.array(z.string()).optional(),
      answeredFieldIds: z.array(z.string()).optional(),
    })
    .strict()
    .optional(),
});
export type ConceptionDmResponse = z.infer<typeof ConceptionDmResponse>;

export const ConceptionKpDelta = z.object({
  add: z
    .array(
      z.object({
        label: z.string().min(1),
        kpType: z.string().min(1),
        status: z.enum(['accepted', 'proposed']),
        confidence: z.number().min(0).max(1),
        facets: z.array(z.string()).default([]),
        evidenceTurnIds: z.array(z.string()).min(1),
      })
    )
    .default([]),
  strengthen: z.array(z.any()).default([]),
  supersede: z.array(z.any()).default([]),
  edges: z
    .array(
      z.object({
        srcLabel: z.string().min(1),
        dstLabel: z.string().min(1),
        rel: z.enum(['supports', 'depends_on', 'contrasts_with', 'elaborates']),
        status: z.enum(['accepted', 'proposed']),
        confidence: z.number().min(0).max(1),
        evidenceTurnIds: z.array(z.string()).min(1),
        facets: z.array(z.string()).optional(),
      })
    )
    .default([]),
});
export type ConceptionKpDelta = z.infer<typeof ConceptionKpDelta>;



