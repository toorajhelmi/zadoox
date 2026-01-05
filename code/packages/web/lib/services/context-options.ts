/**
 * Context-aware quick options service
 * Provides rules-based suggestions for inline AI commands based on document context
 * Later can be enhanced with LLM-driven suggestions
 */

import type { DocumentStyle } from '@zadoox/shared';

export type QuickOptionGroup = 'Generation' | 'Transformation' | 'Structure' | 'Tone';
export type QuickOptionFollowUpKey = 'translate' | 'add-section';
export type QuickOptionSubgroup =
  | 'Sections'
  | 'Insert'
  | 'Citations & References'
  | 'Rewrite'
  | 'Argumentation'
  | 'Organization'
  | 'Tone';
export type QuickOptionWizardKey =
  | 'translate'
  | 'add-section'
  | 'insert-figure'
  | 'insert-figure-grid'
  | 'insert-table'
  | 'insert-equation';

export interface QuickOption {
  id: string;
  label: string;
  description?: string;
  action: string; // The action/prompt to send
  group: QuickOptionGroup;
  subgroup?: QuickOptionSubgroup;
  /**
   * If present, selecting this option should open a wizard UI.
   * The wizard will collect minimal inputs, allow preview, and then apply.
   */
  wizardKey?: QuickOptionWizardKey;
  /**
   * If present, selecting this option should ask follow-up questions
   * before turning it into a concrete prompt.
   */
  followUpKey?: QuickOptionFollowUpKey;
}

export interface ContextOptionsParams {
  documentStyle: DocumentStyle;
  cursorPosition: { line: number; column: number };
  content: string;
  adjacentBlocks?: {
    before: string | null;
    after: string | null;
  };
}

const headingMatch = (line: string, heading: string) =>
  new RegExp(`^#{1,6}\\s+${heading}\\b`, 'i').test(line.trim());

function hasHeading(content: string, heading: string): boolean {
  return content.split('\n').some((l) => headingMatch(l, heading));
}

function firstNonEmptyLineIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] || '').trim().length > 0) return i;
  }
  return -1;
}

function lastNonEmptyLineIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if ((lines[i] || '').trim().length > 0) return i;
  }
  return -1;
}

interface ScoredOption {
  option: QuickOption;
  score: number;
}

/**
 * Global option catalog (shown in the "More…" searchable picker).
 * Keep prompts generic and applicable across doc styles, but compatible with
 * Zadoox extended Markdown features (figures/tables/refs/citations/blocks).
 */
const ALL_OPTIONS: QuickOption[] = [
  // Generation
  {
    id: 'gen-add-abstract',
    label: 'Add abstract',
    description: 'Insert an Abstract section at the beginning',
    action: 'Add an "Abstract" section at the beginning of this document. Keep it concise and aligned with the existing content (if any).',
    group: 'Generation',
    subgroup: 'Sections',
  },
  {
    id: 'gen-add-introduction',
    label: 'Add introduction',
    description: 'Insert an Introduction section near the start',
    action: 'Add an "Introduction" section near the start of this document. Make it flow naturally into what follows.',
    group: 'Generation',
    subgroup: 'Sections',
  },
  {
    id: 'gen-add-conclusion',
    label: 'Add conclusion',
    description: 'Add a concluding section at the end',
    action: 'Add a "Conclusion" section at the end of this document that summarizes key points and closes the narrative.',
    group: 'Generation',
    subgroup: 'Sections',
  },
  {
    id: 'gen-add-section',
    label: 'Add section…',
    description: 'Insert a new section heading and starter content',
    action: 'Add a new section here.',
    group: 'Generation',
    subgroup: 'Sections',
    wizardKey: 'add-section',
    followUpKey: 'add-section',
  },
  {
    id: 'gen-add-example',
    label: 'Add example',
    description: 'Add a concrete example to clarify the point',
    action: 'Add a concrete example that clarifies the current point, matching the document tone.',
    group: 'Generation',
    subgroup: 'Sections',
  },
  {
    id: 'gen-add-citation',
    label: 'Add citation',
    description: 'Insert a citation placeholder (e.g. [@smith2024])',
    action:
      'Add a relevant citation placeholder in the appropriate place using the Zadoox citation syntax (e.g., [@smith2024] or [@smith2024, p. 42]).',
    group: 'Generation',
    subgroup: 'Citations & References',
  },
  {
    id: 'gen-insert-figure',
    label: 'Insert figure',
    description: 'Insert a figure block with label syntax {#fig:... label="Figure {REF}.1"}',
    action:
      'Insert a figure block here using Zadoox extended Markdown, including a label like {#fig:...} and label="Figure {REF}.1". Use a placeholder image path under assets/.',
    group: 'Generation',
    subgroup: 'Insert',
    wizardKey: 'insert-figure',
  },
  {
    id: 'gen-insert-figure-grid',
    label: 'Insert figure grid',
    description: 'Insert a multi-cell figure grid using ::: ... ::: with ||| and --- delimiters',
    action:
      'Insert a figure grid here using Zadoox extended Markdown grid syntax (::: cols=... caption="..."), with per-cell figures and delimiters (||| and ---).',
    group: 'Generation',
    subgroup: 'Insert',
    wizardKey: 'insert-figure-grid',
  },
  {
    id: 'gen-insert-table',
    label: 'Insert table',
    description: 'Insert a Markdown table with a table label {#tbl:... label="Table {REF}.1"}',
    action:
      'Insert a Markdown table here and add a Zadoox table label block like {#tbl:... label="Table {REF}.1" caption="..."} below it.',
    group: 'Generation',
    subgroup: 'Insert',
    wizardKey: 'insert-table',
  },
  {
    id: 'gen-insert-equation',
    label: 'Insert equation',
    description: 'Insert a labeled equation block using $$ ... $${#eq:... label="Equation {REF}.1"}',
    action:
      'Insert a LaTeX equation block here using $$...$$ and add a label like {#eq:... label="Equation {REF}.1"}.',
    group: 'Generation',
    subgroup: 'Insert',
    wizardKey: 'insert-equation',
  },

  // Transformation
  {
    id: 'xform-improve',
    label: 'Improve writing',
    description: 'Improve clarity/flow while preserving meaning',
    action: 'Improve the writing for clarity, flow, and correctness while preserving meaning and structure.',
    group: 'Transformation',
    subgroup: 'Rewrite',
  },
  {
    id: 'xform-expand',
    label: 'Expand',
    description: 'Add detail, explanation, or supporting points',
    action: 'Expand this content with more detail, explanation, and supporting points while staying on-topic.',
    group: 'Transformation',
    subgroup: 'Rewrite',
  },
  {
    id: 'xform-condense',
    label: 'Condense',
    description: 'Make it shorter without losing key information',
    action: 'Condense this content to be more concise without losing key information.',
    group: 'Transformation',
    subgroup: 'Rewrite',
  },
  {
    id: 'xform-translate',
    label: 'Translate…',
    description: 'Translate (will ask for from/to language)',
    action: 'Translate this content.',
    group: 'Transformation',
    subgroup: 'Rewrite',
    wizardKey: 'translate',
    followUpKey: 'translate',
  },
  {
    id: 'xform-counterargument',
    label: 'Add counterargument',
    description: 'Add a brief counterpoint + response',
    action:
      'Add a brief counterargument to the main claim here, then respond to it constructively. Keep it integrated into the surrounding text.',
    group: 'Transformation',
    subgroup: 'Argumentation',
  },

  // Structure
  {
    id: 'struct-reorder',
    label: 'Improve structure',
    description: 'Reorder for stronger logical flow',
    action: 'Improve the structure and ordering of this section for a clearer logical flow. Keep headings consistent.',
    group: 'Structure',
    subgroup: 'Organization',
  },
  {
    id: 'struct-add-subsection',
    label: 'Add subsection',
    description: 'Insert a subsection heading under the current section',
    action: 'Add an appropriate subsection heading here and start the subsection with 1–2 paragraphs.',
    group: 'Structure',
    subgroup: 'Organization',
  },
  {
    id: 'struct-add-crossref',
    label: 'Add cross-reference',
    description: 'Add a reference like @sec:..., @fig:..., @tbl:..., @eq:...',
    action:
      'Add a useful cross-reference using Zadoox syntax (e.g., @sec:..., @fig:..., @tbl:..., @eq:...) where it improves navigation.',
    group: 'Structure',
    subgroup: 'Citations & References',
  },
  {
    id: 'struct-add-footnote',
    label: 'Add footnote',
    description: 'Add a footnote using [^1] syntax',
    action: 'Add a footnote using Markdown footnote syntax ([^1]) and provide the corresponding footnote content.',
    group: 'Structure',
    subgroup: 'Citations & References',
  },

  // Tone
  {
    id: 'tone-more-formal',
    label: 'Make more formal',
    description: 'Increase formality and academic tone',
    action: 'Rewrite this content in a more formal tone while keeping meaning and structure.',
    group: 'Tone',
    subgroup: 'Tone',
  },
  {
    id: 'tone-more-casual',
    label: 'Make more casual',
    description: 'More conversational, simpler wording',
    action: 'Rewrite this content in a more casual, approachable tone while keeping meaning and structure.',
    group: 'Tone',
    subgroup: 'Tone',
  },
];

export function getAllQuickOptions(): QuickOption[] {
  return [...ALL_OPTIONS];
}

/**
 * Get context-aware quick options based on document style and position
 */
export function getContextOptions(params: ContextOptionsParams): QuickOption[] {
  const { cursorPosition, content, adjacentBlocks } = params;

  const lines = content.split('\n');
  const firstIdx = firstNonEmptyLineIndex(lines);
  const lastIdx = lastNonEmptyLineIndex(lines);

  const isEmptyDoc = content.trim().length === 0;
  const cursorLine0 = Math.max(0, cursorPosition.line - 1); // cursorPosition.line is 1-based in UI

  const isBeforeAnyText = isEmptyDoc || (firstIdx >= 0 && cursorLine0 <= firstIdx);
  const isAfterAllText = isEmptyDoc || (lastIdx >= 0 && cursorLine0 >= lastIdx);
  const isInMiddle = !isBeforeAnyText && !isAfterAllText;

  const hasAbstract = hasHeading(content, 'abstract');
  const hasIntro = hasHeading(content, 'introduction') || hasHeading(content, 'intro');
  const hasConclusion = hasHeading(content, 'conclusion');

  const scored: ScoredOption[] = [];

  const push = (id: string, score: number) => {
    const opt = ALL_OPTIONS.find((o) => o.id === id);
    if (opt) scored.push({ option: opt, score });
  };

  // Start-of-doc suggestions
  if (isBeforeAnyText) {
    if (!hasAbstract) push('gen-add-abstract', 100);
    if (!hasIntro) push('gen-add-introduction', 90);
    // If empty doc, still allow a generic section creation
    push('gen-add-section', isEmptyDoc ? 80 : 40);
  }

  // End-of-doc suggestions
  if (isAfterAllText) {
    if (!hasConclusion && !isEmptyDoc) push('gen-add-conclusion', 100);
    push('struct-add-crossref', 30);
  }

  // Middle-of-doc suggestions (generic manipulation)
  if (isInMiddle) {
    push('xform-improve', 80);
    push('xform-expand', adjacentBlocks?.before ? 70 : 55);
    push('xform-condense', 40);
    push('gen-add-example', 35);
    push('gen-add-citation', 30);
    push('struct-reorder', 25);
  }

  // Always-available high-value actions (lower priority)
  push('gen-insert-figure', 15);
  push('gen-insert-figure-grid', 15);
  push('gen-insert-table', 15);
  push('gen-insert-equation', 15);
  push('tone-more-formal', 10);
  push('tone-more-casual', 10);
  push('xform-translate', 8);

  // Deduplicate by id and sort by score desc
  const byId = new Map<string, ScoredOption>();
  for (const s of scored) {
    const existing = byId.get(s.option.id);
    if (!existing || s.score > existing.score) byId.set(s.option.id, s);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .map((x) => x.option);
}

/**
 * Get adjacent blocks around cursor position
 */
export function getAdjacentBlocks(
  content: string,
  cursorLine: number
): { before: string | null; after: string | null } {
  const lines = content.split('\n');
  
  // Get the paragraph/section before cursor
  let before: string | null = null;
  for (let i = cursorLine - 1; i >= 0; i--) {
    const line = lines[i]?.trim() || '';
    if (line) {
      if (!before) before = '';
      before = line + (before ? '\n' + before : '');
    } else if (before) {
      break;
    }
  }

  // Get the paragraph/section after cursor
  let after: string | null = null;
  for (let i = cursorLine + 1; i < lines.length; i++) {
    const line = lines[i]?.trim() || '';
    if (line) {
      if (!after) after = '';
      after = (after ? after + '\n' : '') + line;
    } else if (after) {
      break;
    }
  }

  return { before: before || null, after: after || null };
}

