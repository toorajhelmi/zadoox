-- DocPlan templates (DB-backed)
-- These templates define non-content planning fields per doc family.

create table if not exists public.docplan_templates (
  doc_type text primary key,
  template jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Simple updated_at trigger (idempotent).
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_docplan_templates_updated_at') then
    create or replace function public.set_updated_at()
    returns trigger as $fn$
    begin
      new.updated_at = now();
      return new;
    end;
    $fn$ language plpgsql;

    create trigger trg_docplan_templates_updated_at
    before update on public.docplan_templates
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Seed templates (upsert).
insert into public.docplan_templates (doc_type, template)
values
(
  'blog',
  jsonb_build_object(
    'docType', 'blog',
    'fields', jsonb_build_array(
      jsonb_build_object('id','blog.platform','label','Platform','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','zadoox','label','Zadoox'),
        jsonb_build_object('value','wordpress','label','WordPress'),
        jsonb_build_object('value','wix','label','Wix'),
        jsonb_build_object('value','squarespace','label','Squarespace'),
        jsonb_build_object('value','medium','label','Medium'),
        jsonb_build_object('value','ghost','label','Ghost'),
        jsonb_build_object('value','substack','label','Substack'),
        jsonb_build_object('value','blogger','label','Blogger'),
        jsonb_build_object('value','linkedin_articles','label','LinkedIn Articles'),
        jsonb_build_object('value','other','label','Other')
      )),
      jsonb_build_object('id','audience.primary','label','Audience','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','general','label','General'),
        jsonb_build_object('value','practitioners','label','Practitioners'),
        jsonb_build_object('value','builders','label','Builders'),
        jsonb_build_object('value','executives','label','Executives'),
        jsonb_build_object('value','students','label','Students'),
        jsonb_build_object('value','mixed','label','Mixed'),
        jsonb_build_object('value','other','label','Other')
      )),
      jsonb_build_object('id','audience.expertiseLevel','label','Expertise level','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','beginner','label','Beginner'),
        jsonb_build_object('value','intermediate','label','Intermediate'),
        jsonb_build_object('value','advanced','label','Advanced'),
        jsonb_build_object('value','mixed','label','Mixed')
      )),
      jsonb_build_object('id','blog.distributionGoal','label','Distribution goal','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','seo','label','SEO'),
        jsonb_build_object('value','social','label','Social'),
        jsonb_build_object('value','newsletter','label','Newsletter'),
        jsonb_build_object('value','community','label','Community'),
        jsonb_build_object('value','internal','label','Internal')
      )),
      jsonb_build_object('id','length.target','label','Target length','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','short','label','Short'),
        jsonb_build_object('value','medium','label','Medium'),
        jsonb_build_object('value','long','label','Long')
      )),
      jsonb_build_object('id','detail.level','label','Level of detail','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','high_level','label','High-level'),
        jsonb_build_object('value','balanced','label','Balanced'),
        jsonb_build_object('value','deep_dive','label','Deep dive')
      )),

      -- Medium (ask only if relevant; otherwise show after planning ends)
      jsonb_build_object('id','tone.formality','label','Formality','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','casual','label','Casual'),
        jsonb_build_object('value','semi_formal','label','Semi-formal'),
        jsonb_build_object('value','formal','label','Formal')
      )),
      jsonb_build_object('id','style.mode','label','Writing mode','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','explanatory','label','Explanatory'),
        jsonb_build_object('value','practical','label','Practical'),
        jsonb_build_object('value','opinionated','label','Opinionated'),
        jsonb_build_object('value','mixed','label','Mixed')
      )),
      jsonb_build_object('id','media.richness','label','Media richness','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','text_only','label','Text-only'),
        jsonb_build_object('value','some_figures','label','Some figures'),
        jsonb_build_object('value','figure_heavy','label','Figure-heavy')
      )),
      jsonb_build_object('id','blog.callToAction','label','Call to action','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','none','label','None'),
        jsonb_build_object('value','subscribe','label','Subscribe'),
        jsonb_build_object('value','try_product','label','Try product'),
        jsonb_build_object('value','contact','label','Contact'),
        jsonb_build_object('value','share','label','Share'),
        jsonb_build_object('value','other','label','Other')
      )),
      jsonb_build_object('id','evidence.bar','label','Evidence bar','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','light','label','Light'),
        jsonb_build_object('value','moderate','label','Moderate'),
        jsonb_build_object('value','strong','label','Strong')
      )),
      jsonb_build_object('id','blog.seoKeywords','label','SEO keywords (optional)','priority','medium','inputKind','short_text')
    )
  )
),
(
  'academic_paper',
  jsonb_build_object(
    'docType', 'academic_paper',
    'implicit', jsonb_build_object(
      'audience.primary','researchers',
      'audience.expertiseLevel','advanced',
      'tone.formality','formal',
      'evidence.bar','strong'
    ),
    'fields', jsonb_build_array(
      jsonb_build_object('id','academic.venueType','label','Venue type','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','conference','label','Conference'),
        jsonb_build_object('value','journal','label','Journal'),
        jsonb_build_object('value','workshop','label','Workshop'),
        jsonb_build_object('value','arxiv_only','label','arXiv-only'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),
      jsonb_build_object('id','academic.contributionType','label','Contribution type','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','new_method','label','New method'),
        jsonb_build_object('value','empirical_study','label','Empirical study'),
        jsonb_build_object('value','system','label','System'),
        jsonb_build_object('value','survey','label','Survey'),
        jsonb_build_object('value','theory','label','Theory'),
        jsonb_build_object('value','position_paper','label','Position paper')
      )),
      jsonb_build_object('id','academic.methodology','label','Methodology','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','quantitative','label','Quantitative'),
        jsonb_build_object('value','qualitative','label','Qualitative'),
        jsonb_build_object('value','mixed_methods','label','Mixed methods'),
        jsonb_build_object('value','theoretical','label','Theoretical'),
        jsonb_build_object('value','engineering','label','Engineering'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),
      jsonb_build_object('id','academic.targetLength','label','Target length','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','4_pages','label','4 pages'),
        jsonb_build_object('value','8_pages','label','8 pages'),
        jsonb_build_object('value','12_pages','label','12 pages'),
        jsonb_build_object('value','long_form','label','Long-form'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),
      jsonb_build_object('id','academic.citationStyle','label','Citation style','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','ieee','label','IEEE'),
        jsonb_build_object('value','acm','label','ACM'),
        jsonb_build_object('value','apa','label','APA'),
        jsonb_build_object('value','chicago','label','Chicago'),
        jsonb_build_object('value','mla','label','MLA'),
        jsonb_build_object('value','bibtex_generic','label','BibTeX-generic'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),

      -- Medium
      jsonb_build_object('id','academic.venueName','label','Venue name (optional)','priority','medium','inputKind','short_text'),
      jsonb_build_object('id','academic.reviewModel','label','Review model','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','double_blind','label','Double-blind'),
        jsonb_build_object('value','single_blind','label','Single-blind'),
        jsonb_build_object('value','open','label','Open'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),
      jsonb_build_object('id','academic.figureDensity','label','Figure density','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','low','label','Low'),
        jsonb_build_object('value','medium','label','Medium'),
        jsonb_build_object('value','high','label','High')
      )),
      jsonb_build_object('id','academic.reproducibilityBar','label','Reproducibility bar','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','low','label','Low'),
        jsonb_build_object('value','medium','label','Medium'),
        jsonb_build_object('value','high','label','High')
      )),

      -- Low (never asked)
      jsonb_build_object('id','academic.supplementalMaterial','label','Supplemental material','priority','low','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','none','label','None'),
        jsonb_build_object('value','appendix','label','Appendix'),
        jsonb_build_object('value','artifact','label','Artifact'),
        jsonb_build_object('value','dataset','label','Dataset'),
        jsonb_build_object('value','code','label','Code'),
        jsonb_build_object('value','unknown','label','Unknown')
      ))
    )
  )
),
(
  'whitepaper',
  jsonb_build_object(
    'docType', 'whitepaper',
    'fields', jsonb_build_array(
      jsonb_build_object('id','whitepaper.purpose','label','Purpose','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','educational','label','Educational'),
        jsonb_build_object('value','decision_support','label','Decision support'),
        jsonb_build_object('value','product_positioning','label','Product positioning'),
        jsonb_build_object('value','policy','label','Policy'),
        jsonb_build_object('value','market_overview','label','Market overview')
      )),
      jsonb_build_object('id','whitepaper.stakeholder','label','Primary stakeholder','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','technical','label','Technical'),
        jsonb_build_object('value','business','label','Business'),
        jsonb_build_object('value','mixed','label','Mixed')
      )),
      jsonb_build_object('id','whitepaper.disclosureLevel','label','Disclosure level','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','public','label','Public'),
        jsonb_build_object('value','semi_public','label','Semi-public'),
        jsonb_build_object('value','internal','label','Internal')
      )),
      jsonb_build_object('id','whitepaper.buyerStage','label','Buyer stage','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','awareness','label','Awareness'),
        jsonb_build_object('value','consideration','label','Consideration'),
        jsonb_build_object('value','decision','label','Decision'),
        jsonb_build_object('value','unknown','label','Unknown')
      )),
      jsonb_build_object('id','length.target','label','Target length','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','medium','label','Medium'),
        jsonb_build_object('value','long','label','Long')
      )),
      jsonb_build_object('id','detail.level','label','Level of detail','priority','high','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','balanced','label','Balanced'),
        jsonb_build_object('value','deep_dive','label','Deep dive')
      )),

      -- Medium
      jsonb_build_object('id','tone.formality','label','Formality','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','semi_formal','label','Semi-formal'),
        jsonb_build_object('value','formal','label','Formal')
      )),
      jsonb_build_object('id','whitepaper.brandVoice','label','Brand voice','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','neutral','label','Neutral'),
        jsonb_build_object('value','authoritative','label','Authoritative'),
        jsonb_build_object('value','consultative','label','Consultative')
      )),
      jsonb_build_object('id','media.richness','label','Media richness','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','text_only','label','Text-only'),
        jsonb_build_object('value','some_figures','label','Some figures'),
        jsonb_build_object('value','figure_heavy','label','Figure-heavy')
      )),
      jsonb_build_object('id','evidence.bar','label','Evidence bar','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','moderate','label','Moderate'),
        jsonb_build_object('value','strong','label','Strong')
      )),
      jsonb_build_object('id','audience.primary','label','Audience (optional)','priority','medium','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','practitioners','label','Practitioners'),
        jsonb_build_object('value','executives','label','Executives'),
        jsonb_build_object('value','mixed','label','Mixed'),
        jsonb_build_object('value','other','label','Other')
      )),

      -- Low
      jsonb_build_object('id','whitepaper.callToAction','label','Call to action (optional)','priority','low','inputKind','dropdown','options',jsonb_build_array(
        jsonb_build_object('value','none','label','None'),
        jsonb_build_object('value','contact_sales','label','Contact sales'),
        jsonb_build_object('value','book_demo','label','Book demo'),
        jsonb_build_object('value','download','label','Download'),
        jsonb_build_object('value','other','label','Other')
      ))
    )
  )
)
on conflict (doc_type) do update set template = excluded.template;

