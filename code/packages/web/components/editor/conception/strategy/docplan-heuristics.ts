import type { ConceptionGoalHypothesis, DocPlan } from '@zadoox/shared';
import { clamp01 } from './utils';

export function inferDocTypeHypotheses(message: string): ConceptionGoalHypothesis[] {
  const m = String(message ?? '').toLowerCase();
  const scores: Record<NonNullable<DocPlan['docType']>, number> = {
    unknown: 0.1,
    academic_paper: 0,
    whitepaper: 0,
    novel: 0,
    blog: 0,
    spec: 0,
    proposal: 0,
    notes: 0,
    mixed: 0,
    other: 0,
  };
  const evidence: Record<NonNullable<DocPlan['docType']>, string[]> = {
    unknown: [],
    academic_paper: [],
    whitepaper: [],
    novel: [],
    blog: [],
    spec: [],
    proposal: [],
    notes: [],
    mixed: [],
    other: [],
  };

  const bump = (k: NonNullable<DocPlan['docType']>, inc: number, why: string) => {
    scores[k] += inc;
    evidence[k].push(why);
  };

  if (/\bpaper\b|\barxiv\b|\bconference\b|\bmethod\b|\bresults?\b|\bexperiment\b|\brelated work\b/.test(m))
    bump('academic_paper', 0.6, 'mentions paper/research terms');
  if (/\bwhitepaper\b|\bwhite paper\b/.test(m)) bump('whitepaper', 0.6, 'mentions whitepaper');
  if (/\bspec\b|\brfc\b|\bapi\b|\brequirements?\b|\bdesign\b|\barchitecture\b/.test(m))
    bump('spec', 0.6, 'mentions spec/design terms');
  if (/\bproposal\b|\bpitch\b|\bfunding\b|\bgrant\b/.test(m)) bump('proposal', 0.6, 'mentions proposal terms');
  if (/\bblog\b|\bpost\b|\bnewsletter\b/.test(m)) bump('blog', 0.55, 'mentions blog/post');
  if (/\bnovel\b|\bcharacter\b|\bplot\b|\bscene\b|\bfiction\b|\bstory\b/.test(m)) bump('novel', 0.55, 'mentions fiction terms');
  if (/\bnotes\b|\bscratch\b|\bbrain dump\b/.test(m)) bump('notes', 0.4, 'mentions notes');
  if (/\bpaper\b/.test(m) && /\bblog\b/.test(m)) bump('mixed', 0.4, 'mentions multiple formats');

  // Normalize into hypotheses.
  const entries = Object.entries(scores) as Array<[NonNullable<DocPlan['docType']>, number]>;
  const sum = entries.reduce((acc, [, v]) => acc + Math.max(0, v), 0) || 1;
  const out: ConceptionGoalHypothesis[] = entries
    .map(([docType, v]) => ({
      docType,
      score: clamp01(Math.max(0, v) / sum),
      evidence: evidence[docType],
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Ensure unknown exists if everything is weak.
  if (!out.some((h) => h.docType === 'unknown')) out.push({ docType: 'unknown', score: 0.2, evidence: [] });
  return out;
}

export function detectExplicitDocTypeAnswer(message: string): NonNullable<DocPlan['docType']> | null {
  const m = String(message ?? '').toLowerCase();
  // Strong explicit preference statements should override weak/conflicting keyword evidence.
  if (/\bcloser to (a |an )?spec\b|\bmore like (a |an )?spec\b|\bspec\s*\/\s*framework\b/.test(m)) return 'spec';
  if (/\bcloser to (a |an )?paper\b|\bmore like (a |an )?paper\b/.test(m)) return 'academic_paper';
  if (/\bcloser to (a |an )?blog\b|\bmore like (a |an )?blog\b/.test(m)) return 'blog';
  if (/\bcloser to (a |an )?story\b|\bmore like (a |an )?story\b|\bfiction\b/.test(m)) return 'novel';
  if (/\bcloser to (a |an )?proposal\b|\bmore like (a |an )?proposal\b|\bpitch\b/.test(m)) return 'proposal';
  if (/\bcloser to notes\b|\bmore like notes\b/.test(m)) return 'notes';
  if (/\bwhitepaper\b|\bwhite paper\b|\bcloser to (a |an )?whitepaper\b|\bmore like (a |an )?whitepaper\b/.test(m))
    return 'whitepaper';
  return null;
}


