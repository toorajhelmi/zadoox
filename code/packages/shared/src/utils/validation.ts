/**
 * Validation utilities
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate that a string is not empty
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate that a value is a valid number
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validate that a value is a positive integer
 */
export function isPositiveInteger(value: unknown): value is number {
  return isValidNumber(value) && Number.isInteger(value) && value > 0;
}

/**
 * Validate document type
 */
export function isValidDocumentType(value: string): value is 'chapter' | 'section' | 'standalone' {
  return ['chapter', 'section', 'standalone'].includes(value);
}

/**
 * Validate project type
 */
export function isValidProjectType(value: string): value is 'academic' | 'industry' | 'code-docs' {
  return ['academic', 'industry', 'code-docs'].includes(value);
}

/**
 * Validate export format
 */
export function isValidExportFormat(value: string): value is 'latex' | 'pdf' | 'markdown' {
  return ['latex', 'pdf', 'markdown'].includes(value);
}


