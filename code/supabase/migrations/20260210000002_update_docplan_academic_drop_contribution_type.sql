-- Update academic_paper DocPlan template: drop Contribution type.
-- This removes the field entirely so it won't be asked/shown in planning.

update public.docplan_templates
set template = jsonb_set(
  template,
  '{fields}',
  (
    select coalesce(jsonb_agg(f), '[]'::jsonb)
    from jsonb_array_elements(template->'fields') as f
    where (f->>'id') <> 'academic.contributionType'
  ),
  true
)
where doc_type = 'academic_paper';

