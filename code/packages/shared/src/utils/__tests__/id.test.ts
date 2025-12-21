import { describe, it, expect } from 'vitest';
import { generateId, generateShortId, isValidId } from '../id';

describe('ID generation utilities', () => {
  describe('generateId', () => {
    it('should generate a valid UUID v4', () => {
      const id = generateId();
      expect(isValidId(id)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should generate IDs in UUID v4 format', () => {
      const id = generateId();
      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuidRegex.test(id)).toBe(true);
    });
  });

  describe('generateShortId', () => {
    it('should generate an 8-character ID', () => {
      const id = generateShortId();
      expect(id).toHaveLength(8);
    });

    it('should generate alphanumeric IDs', () => {
      const id = generateShortId();
      const alphanumericRegex = /^[a-zA-Z0-9]{8}$/;
      expect(alphanumericRegex.test(id)).toBe(true);
    });

    it('should generate unique short IDs', () => {
      const id1 = generateShortId();
      const id2 = generateShortId();
      // Very unlikely to be the same, but test for uniqueness
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidId', () => {
    it('should return true for valid UUID v4s', () => {
      const validIds = [
        '550e8400-e29b-41d4-a716-446655440000', // UUID v4 (has '4' in 3rd part, 'a' in 4th part)
        '6ba7b810-9dad-41d4-b716-446655440000', // UUID v4 (has '4' in 3rd part, 'b' in 4th part)
        '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d', // UUID v4 (has '4' in 3rd part, '9' in 4th part)
      ];
      validIds.forEach((id) => {
        expect(isValidId(id)).toBe(true);
      });
    });

    it('should return false for invalid UUIDs', () => {
      const invalidIds = [
        'not-a-uuid',
        '123e4567-e89b-12d3-a456',
        '123e4567e89b12d3a456426614174000',
        '',
        '123e4567-e89b-12d3-a456-42661417400', // too short
        '123e4567-e89b-12d3-a456-4266141740000', // too long
      ];
      invalidIds.forEach((id) => {
        expect(isValidId(id)).toBe(false);
      });
    });

    it('should return false for non-UUID v4 format', () => {
      // UUID v1 example (has '1' in version position, not '4')
      const uuidV1 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      expect(isValidId(uuidV1)).toBe(false); // Should fail because it's not v4
      
      // Invalid UUID format
      const invalid = '6ba7b810-9dad-11d1-80b4-00c04fd430c';
      expect(isValidId(invalid)).toBe(false);
    });
  });
});

