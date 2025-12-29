/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { extractCitedSourceIds } from '../citation';

describe('extractCitedSourceIds', () => {
  it('should extract single citation', () => {
    const content = 'This is a citation [@source-123].';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(1);
    expect(ids.has('source-123')).toBe(true);
  });

  it('should extract multiple citations', () => {
    const content = 'First [@source-1] and second [@source-2] citations.';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(2);
    expect(ids.has('source-1')).toBe(true);
    expect(ids.has('source-2')).toBe(true);
  });

  it('should handle duplicate citations', () => {
    const content = 'Same citation [@source-1] appears twice [@source-1].';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(1); // Set deduplicates
    expect(ids.has('source-1')).toBe(true);
  });

  it('should handle citations with hyphens and numbers', () => {
    const content = 'Citation [@source-123-abc-456].';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(1);
    expect(ids.has('source-123-abc-456')).toBe(true);
  });

  it('should return empty set when no citations found', () => {
    const content = 'No citations here.';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(0);
  });

  it('should handle empty content', () => {
    const content = '';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(0);
  });

  it('should handle citations at start of content', () => {
    const content = '[@source-1] at the start.';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(1);
    expect(ids.has('source-1')).toBe(true);
  });

  it('should handle citations at end of content', () => {
    const content = 'Citation at the end [@source-1]';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(1);
    expect(ids.has('source-1')).toBe(true);
  });

  it('should handle multiple citations in same sentence', () => {
    const content = 'Multiple [@source-1] citations [@source-2] in [@source-3] one sentence.';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(3);
    expect(ids.has('source-1')).toBe(true);
    expect(ids.has('source-2')).toBe(true);
    expect(ids.has('source-3')).toBe(true);
  });

  it('should not match invalid citation formats', () => {
    const content = 'Not a citation [source-1] or [@] or [@ ].';
    const ids = extractCitedSourceIds(content);
    expect(ids.size).toBe(0);
  });
});

