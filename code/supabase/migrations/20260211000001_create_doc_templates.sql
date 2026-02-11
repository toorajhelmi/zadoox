-- Unified templates per doc type:
-- - DocPlan template (planning fields/options/priorities)
-- - Draft template (baseline sections/subsections for materialization)
--
-- We keep a compatibility VIEW named `docplan_templates` so older code continues to work
-- while we migrate loaders to `doc_templates`.

create table if not exists public.doc_templates (
  doc_type text primary key,
  docplan_template jsonb not null default '{}'::jsonb,
  draft_template jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger (idempotent, shared function).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_doc_templates_updated_at') then
    -- function `public.set_updated_at()` may already exist; create/replace is safe.
    create or replace function public.set_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;

    create trigger trg_doc_templates_updated_at
    before update on public.doc_templates
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Migrate existing DocPlan templates into doc_templates if the old table exists.
do $$
begin
  if to_regclass('public.docplan_templates') is not null then
    insert into public.doc_templates (doc_type, docplan_template)
    select doc_type, template
    from public.docplan_templates
    on conflict (doc_type) do update set
      docplan_template = excluded.docplan_template;
  end if;
end $$;

-- Seed baseline draft templates (high-level only; LLM will adjust based on DocPlan).
-- (Upsert into doc_templates.draft_template)
insert into public.doc_templates (doc_type, draft_template)
values
(
  'blog',
  jsonb_build_object(
    'docType', 'blog',
    'sections', jsonb_build_array(
      jsonb_build_object('id','title','title','Title','required', true),
      jsonb_build_object('id','hook','title','Hook / opening','required', true),
      jsonb_build_object('id','body','title','Main points','required', true),
      jsonb_build_object('id','examples','title','Examples / evidence','required', false),
      jsonb_build_object('id','cta','title','Call to action','required', false),
      jsonb_build_object('id','closing','title','Closing','required', true)
    )
  )
),
(
  'whitepaper',
  jsonb_build_object(
    'docType', 'whitepaper',
    'sections', jsonb_build_array(
      jsonb_build_object('id','title','title','Title','required', true),
      jsonb_build_object('id','executive_summary','title','Executive summary','required', true),
      jsonb_build_object('id','problem','title','Problem / context','required', true),
      jsonb_build_object('id','solution','title','Approach / solution','required', true),
      jsonb_build_object('id','evaluation','title','Evidence / evaluation','required', false),
      jsonb_build_object('id','recommendations','title','Recommendations','required', false),
      jsonb_build_object('id','conclusion','title','Conclusion','required', true),
      jsonb_build_object('id','references','title','References','required', false)
    )
  )
),
(
  'academic_paper',
  jsonb_build_object(
    'docType', 'academic_paper',
    'sections', jsonb_build_array(
      jsonb_build_object('id','title','title','Title','required', true),
      jsonb_build_object('id','abstract','title','Abstract','required', true),
      jsonb_build_object('id','introduction','title','Introduction','required', true),
      jsonb_build_object('id','related_work','title','Related work','required', false),
      jsonb_build_object('id','method','title','Methodology','required', true),
      jsonb_build_object('id','results','title','Results','required', false),
      jsonb_build_object('id','discussion','title','Discussion','required', false),
      jsonb_build_object('id','conclusion','title','Conclusion','required', true),
      jsonb_build_object('id','references','title','References','required', true)
    )
  )
)
on conflict (doc_type) do update set
  draft_template = excluded.draft_template;

-- Compatibility: if docplan_templates is a TABLE, rename it and replace with a VIEW.
do $$
declare
  kind "char";
begin
  if to_regclass('public.docplan_templates') is not null then
    select c.relkind into kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'docplan_templates';

    -- relkind 'r' = ordinary table, 'v' = view
    if kind = 'r' then
      alter table public.docplan_templates rename to docplan_templates_legacy;
    end if;
  end if;

  -- Ensure the compatibility view exists (recreate idempotently).
  if to_regclass('public.docplan_templates') is not null then
    -- If something (like a view) exists with that name, drop it first.
    execute 'drop view if exists public.docplan_templates';
  end if;

  execute $v$
    create view public.docplan_templates as
    select
      doc_type,
      docplan_template as template,
      created_at,
      updated_at
    from public.doc_templates
  $v$;
end $$;

