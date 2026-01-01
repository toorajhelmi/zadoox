/**
 * Context-aware quick options service
 * Provides rules-based suggestions for inline AI commands based on document context
 * Later can be enhanced with LLM-driven suggestions
 */

import type { DocumentStyle } from '@zadoox/shared';

export interface QuickOption {
  id: string;
  label: string;
  description?: string;
  action: string; // The action/prompt to send
  category?: string;
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

/**
 * Get context-aware quick options based on document style and position
 */
export function getContextOptions(params: ContextOptionsParams): QuickOption[] {
  const { documentStyle, cursorPosition, content, adjacentBlocks } = params;
  const options: QuickOption[] = [];

  const lines = content.split('\n');
  const isAtStart = cursorPosition.line === 0 || cursorPosition.line === 1;
  const isAtEnd = cursorPosition.line >= lines.length - 1;
  const hasContent = content.trim().length > 0;
  
  // Check if document starts with specific patterns
  const startsWithHeading = lines[0]?.trim().startsWith('#');
  const firstLineText = lines[0]?.trim() || '';

  // Academic paper options
  if (documentStyle === 'academic') {
    // At the beginning of document
    if (isAtStart && !hasContent) {
      options.push({
        id: 'add-abstract',
        label: 'Add Abstract',
        description: 'Add an abstract section',
        action: 'Add an abstract section for this paper',
        category: 'structure',
      });
      options.push({
        id: 'add-intro',
        label: 'Add Introduction',
        description: 'Add an introduction section',
        action: 'Add an introduction section',
        category: 'structure',
      });
    }

    // At the beginning but has some content
    if (isAtStart && hasContent && !firstLineText.toLowerCase().includes('abstract')) {
      options.push({
        id: 'add-abstract',
        label: 'Add Abstract',
        description: 'Insert an abstract section at the beginning',
        action: 'Add an abstract section at the beginning of this document',
        category: 'structure',
      });
    }

    // If there's an abstract but no intro
    if (hasContent && firstLineText.toLowerCase().includes('abstract') && 
        !content.toLowerCase().includes('## introduction')) {
      options.push({
        id: 'add-intro',
        label: 'Add Introduction',
        description: 'Add an introduction section after the abstract',
        action: 'Add an introduction section',
        category: 'structure',
      });
    }

    // Common academic sections
    if (!content.toLowerCase().includes('## methods') && 
        (content.toLowerCase().includes('introduction') || hasContent)) {
      options.push({
        id: 'add-methods',
        label: 'Add Methods',
        description: 'Add a methods section',
        action: 'Add a methods section',
        category: 'structure',
      });
    }

    if (!content.toLowerCase().includes('## results') && hasContent) {
      options.push({
        id: 'add-results',
        label: 'Add Results',
        description: 'Add a results section',
        action: 'Add a results section',
        category: 'structure',
      });
    }

    if (!content.toLowerCase().includes('## discussion') && hasContent) {
      options.push({
        id: 'add-discussion',
        label: 'Add Discussion',
        description: 'Add a discussion section',
        action: 'Add a discussion section',
        category: 'structure',
      });
    }

    if (!content.toLowerCase().includes('## conclusion') && hasContent) {
      options.push({
        id: 'add-conclusion',
        label: 'Add Conclusion',
        description: 'Add a conclusion section',
        action: 'Add a conclusion section',
        category: 'structure',
      });
    }

    // References section (should be at end)
    if (isAtEnd && !content.toLowerCase().includes('## references')) {
      options.push({
        id: 'add-references',
        label: 'Add References',
        description: 'Add a references section',
        action: 'Add a references section',
        category: 'structure',
      });
    }
  }

  // General options (work for all styles)
  if (!isAtStart && adjacentBlocks?.before) {
    options.push({
      id: 'expand-paragraph',
      label: 'Expand',
      description: 'Expand the current paragraph',
      action: 'Expand this paragraph with more detail',
      category: 'editing',
    });
  }

  if (adjacentBlocks?.before || adjacentBlocks?.after) {
    options.push({
      id: 'improve-writing',
      label: 'Improve',
      description: 'Improve the writing quality',
      action: 'Improve the writing quality of this section',
      category: 'editing',
    });
  }

  if (hasContent) {
    options.push({
      id: 'add-section',
      label: 'Add Section',
      description: 'Add a new section',
      action: 'Add a new section here',
      category: 'structure',
    });
  }

  // Remove duplicates based on id
  const uniqueOptions = Array.from(
    new Map(options.map(opt => [opt.id, opt])).values()
  );

  // Sort: structure options first, then editing options
  return uniqueOptions.sort((a, b) => {
    if (a.category === 'structure' && b.category !== 'structure') return -1;
    if (a.category !== 'structure' && b.category === 'structure') return 1;
    return 0;
  });
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

