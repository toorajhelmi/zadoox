/**
 * Placeholder constants for document content
 * Used in Extended Markdown for dynamic references
 */

/**
 * Chapter reference placeholder - replaced with chapter number
 * Example: {CH} -> "1"
 */
export const PLACEHOLDER_CHAPTER = '{CH}';

/**
 * Reference placeholder - replaced with reference number based on structure
 * Example: {REF} -> "1.2" (section 1.2)
 */
export const PLACEHOLDER_REF = '{REF}';

/**
 * Placeholder regex patterns
 */
export const PLACEHOLDER_PATTERNS = {
  chapter: /\{CH\}/g,
  ref: /\{REF\}/g,
} as const;

/**
 * All placeholder types
 */
export type PlaceholderType = 'CH' | 'REF';

/**
 * Placeholder mapping
 */
export const PLACEHOLDERS: Record<PlaceholderType, string> = {
  CH: PLACEHOLDER_CHAPTER,
  REF: PLACEHOLDER_REF,
} as const;


