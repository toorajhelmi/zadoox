/**
 * Placeholder system for Extended Markdown
 * Handles resolution, replacement, and validation of placeholders ({CH}, {REF})
 */

import { PLACEHOLDER_PATTERNS, type PlaceholderType } from '../constants/placeholders';

/**
 * Context for placeholder resolution
 */
export interface PlaceholderContext {
  chapterNumber?: number;
  sectionNumber?: string; // e.g., "1.2"
  referenceNumber?: string;
}

/**
 * Validate that placeholders in content are valid
 */
export function validatePlaceholders(content: string): {
  valid: boolean;
  errors: string[];
  placeholders: Array<{ type: PlaceholderType; position: number }>;
} {
  const errors: string[] = [];
  const placeholders: Array<{ type: PlaceholderType; position: number }> = [];

  // Find all placeholders
  let match: RegExpExecArray | null;

  // Check for chapter placeholders
  const chapterPattern = new RegExp(PLACEHOLDER_PATTERNS.chapter.source, PLACEHOLDER_PATTERNS.chapter.flags);
  chapterPattern.lastIndex = 0;
  while ((match = chapterPattern.exec(content)) !== null) {
    placeholders.push({ type: 'CH', position: match.index });
  }

  // Check for reference placeholders
  const refPattern = new RegExp(PLACEHOLDER_PATTERNS.ref.source, PLACEHOLDER_PATTERNS.ref.flags);
  refPattern.lastIndex = 0;
  while ((match = refPattern.exec(content)) !== null) {
    placeholders.push({ type: 'REF', position: match.index });
  }

  // Check for invalid placeholder syntax (e.g., {CH} with extra braces)
  const invalidPattern = /\{[^{}]+\{[^{}]+\}/g;
  const invalidMatches = content.match(invalidPattern);
  if (invalidMatches) {
    errors.push(`Invalid placeholder syntax found: ${invalidMatches.join(', ')}`);
  }

  // All valid placeholders use the defined patterns, so if we found them, they're valid
  const valid = errors.length === 0;

  return {
    valid,
    errors,
    placeholders,
  };
}

/**
 * Resolve placeholder values based on context
 */
export function resolvePlaceholder(
  placeholderType: PlaceholderType,
  context: PlaceholderContext
): string {
  switch (placeholderType) {
    case 'CH':
      if (context.chapterNumber === undefined) {
        throw new Error('Chapter number not provided in context for {CH} placeholder');
      }
      return String(context.chapterNumber);
    
    case 'REF':
      if (context.referenceNumber !== undefined) {
        return context.referenceNumber;
      }
      if (context.sectionNumber !== undefined) {
        return context.sectionNumber;
      }
      throw new Error('Reference number or section number not provided in context for {REF} placeholder');
    
    default:
      throw new Error(`Unknown placeholder type: ${placeholderType}`);
  }
}

/**
 * Replace all placeholders in content with resolved values
 */
export function replacePlaceholders(
  content: string,
  context: PlaceholderContext
): string {
  let result = content;

  // Replace chapter placeholders
  result = result.replace(PLACEHOLDER_PATTERNS.chapter, () => {
    return resolvePlaceholder('CH', context);
  });

  // Replace reference placeholders
  result = result.replace(PLACEHOLDER_PATTERNS.ref, () => {
    return resolvePlaceholder('REF', context);
  });

  return result;
}

/**
 * Extract placeholder context from document structure
 * This is a helper function that can be used to build context from document metadata
 */
export function buildPlaceholderContext(
  chapterNumber?: number,
  sectionNumber?: string,
  referenceNumber?: string
): PlaceholderContext {
  return {
    chapterNumber,
    sectionNumber,
    referenceNumber,
  };
}

