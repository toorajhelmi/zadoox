import type { DocPlan } from '../types/conception';

export type DocPlanDocType = NonNullable<DocPlan['docType']>;

export const DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES = [
  { value: 'blog', label: 'Blog' },
  { value: 'academic_paper', label: 'Academic Paper' },
  { value: 'whitepaper', label: 'Whitepaper' },
  { value: 'other', label: 'Other (type it)' },
] as const satisfies ReadonlyArray<{ value: DocPlanDocType; label: string }>;

export const DOC_PLAN_DOC_TYPE_ALL_CHOICES = [
  { value: 'unknown', label: 'Unknown' },
  ...DOC_PLAN_DOC_TYPE_PRIMARY_CHOICES,
  { value: 'spec', label: 'Spec' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'notes', label: 'Notes' },
  { value: 'mixed', label: 'Mixed' },
  // Supported by the type, but not part of the “short, formal doc family” first-ask.
  { value: 'novel', label: 'Novel' },
] as const satisfies ReadonlyArray<{ value: DocPlanDocType; label: string }>;

export const DOC_PLAN_DOC_TYPE_VALUES = DOC_PLAN_DOC_TYPE_ALL_CHOICES.map((x) => x.value) as unknown as [
  DocPlanDocType,
  ...DocPlanDocType[],
];

