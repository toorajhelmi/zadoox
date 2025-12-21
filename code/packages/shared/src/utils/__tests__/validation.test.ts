import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  isNonEmptyString,
  isValidNumber,
  isPositiveInteger,
  isValidDocumentType,
  isValidProjectType,
  isValidExportFormat,
} from '../validation';

describe('Validation utilities', () => {
  describe('isValidEmail', () => {
    it('should return true for valid email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.com',
        'user_123@test-domain.com',
      ];
      validEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it('should return false for invalid email addresses', () => {
      const invalidEmails = [
        'not-an-email',
        '@example.com',
        'user@',
        'user@domain',
        'user name@example.com',
        '',
        'user@@example.com',
      ];
      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });
  });

  describe('isNonEmptyString', () => {
    it('should return true for non-empty strings', () => {
      expect(isNonEmptyString('hello')).toBe(true);
      expect(isNonEmptyString('  text  ')).toBe(true);
      expect(isNonEmptyString('a')).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isNonEmptyString('')).toBe(false);
      expect(isNonEmptyString('   ')).toBe(false);
      expect(isNonEmptyString('\t\n')).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isNonEmptyString(null as any)).toBe(false);
      expect(isNonEmptyString(undefined as any)).toBe(false);
      expect(isNonEmptyString(123 as any)).toBe(false);
      expect(isNonEmptyString({} as any)).toBe(false);
      expect(isNonEmptyString([] as any)).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(42)).toBe(true);
      expect(isValidNumber(-10)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('should return false for invalid numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-number values', () => {
      expect(isValidNumber('123' as any)).toBe(false);
      expect(isValidNumber(null as any)).toBe(false);
      expect(isValidNumber(undefined as any)).toBe(false);
    });
  });

  describe('isPositiveInteger', () => {
    it('should return true for positive integers', () => {
      expect(isPositiveInteger(1)).toBe(true);
      expect(isPositiveInteger(100)).toBe(true);
      expect(isPositiveInteger(999999)).toBe(true);
    });

    it('should return false for non-positive integers', () => {
      expect(isPositiveInteger(0)).toBe(false);
      expect(isPositiveInteger(-1)).toBe(false);
      expect(isPositiveInteger(-100)).toBe(false);
    });

    it('should return false for non-integers', () => {
      expect(isPositiveInteger(3.14)).toBe(false);
      expect(isPositiveInteger(0.5)).toBe(false);
    });

    it('should return false for invalid numbers', () => {
      expect(isPositiveInteger(NaN)).toBe(false);
      expect(isPositiveInteger(Infinity)).toBe(false);
    });
  });

  describe('isValidDocumentType', () => {
    it('should return true for valid document types', () => {
      expect(isValidDocumentType('chapter')).toBe(true);
      expect(isValidDocumentType('section')).toBe(true);
      expect(isValidDocumentType('standalone')).toBe(true);
    });

    it('should return false for invalid document types', () => {
      expect(isValidDocumentType('invalid')).toBe(false);
      expect(isValidDocumentType('')).toBe(false);
      expect(isValidDocumentType('Chapter')).toBe(false); // case sensitive
    });
  });

  describe('isValidProjectType', () => {
    it('should return true for valid project types', () => {
      expect(isValidProjectType('academic')).toBe(true);
      expect(isValidProjectType('industry')).toBe(true);
      expect(isValidProjectType('code-docs')).toBe(true);
    });

    it('should return false for invalid project types', () => {
      expect(isValidProjectType('invalid')).toBe(false);
      expect(isValidProjectType('')).toBe(false);
      expect(isValidProjectType('Academic')).toBe(false); // case sensitive
    });
  });

  describe('isValidExportFormat', () => {
    it('should return true for valid export formats', () => {
      expect(isValidExportFormat('latex')).toBe(true);
      expect(isValidExportFormat('pdf')).toBe(true);
      expect(isValidExportFormat('markdown')).toBe(true);
    });

    it('should return false for invalid export formats', () => {
      expect(isValidExportFormat('invalid')).toBe(false);
      expect(isValidExportFormat('')).toBe(false);
      expect(isValidExportFormat('LaTeX')).toBe(false); // case sensitive
    });
  });
});

