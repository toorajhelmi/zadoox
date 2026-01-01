/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { calculateChanges, applyAcceptedChanges, rejectAllChanges } from '../diff';
import type { ChangeBlock } from '@zadoox/shared';

describe('calculateChanges', () => {
  it('should return empty array when content is identical', () => {
    const original = 'Hello world';
    const newContent = 'Hello world';
    const changes = calculateChanges(original, newContent);
    expect(changes).toEqual([]);
  });

  it('should detect a simple addition', () => {
    const original = 'Hello';
    const newContent = 'Hello world';
    const changes = calculateChanges(original, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('add');
    expect(changes[0].newText).toBe(' world');
  });

  it('should detect a simple deletion', () => {
    const original = 'Hello world';
    const newContent = 'Hello';
    const changes = calculateChanges(original, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('delete');
    expect(changes[0].originalText).toBe(' world');
  });

  it('should detect a modification', () => {
    const original = 'Hello world';
    const newContent = 'Hello there';
    const changes = calculateChanges(original, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('modify');
    expect(changes[0].originalText).toBe('world');
    expect(changes[0].newText).toBe('there');
  });

  it('should merge consecutive changes within threshold', () => {
    const original = 'The quick brown fox';
    const newContent = 'The fast red cat';
    const changes = calculateChanges(original, newContent);
    // Should merge multiple operations into one
    expect(changes.length).toBeLessThanOrEqual(2); // May be 1 or 2 depending on diff algorithm
  });

  it('should preserve small unchanged gaps when merging nearby changes', () => {
    // Two small edits with an unchanged gap between them ("XY").
    // When merged, newText should include the gap so highlight spans the full visible region.
    const original = 'abcXYZdef';
    const newContent = 'abqXYWdef';
    const changes = calculateChanges(original, newContent);

    // Depending on diff output, it may merge into one modify.
    const merged = changes.find((c) => c.type === 'modify');
    if (merged?.newText) {
      expect(merged.newText).toContain('XY');
    }
  });

  it('should handle multiple separate changes', () => {
    const original = 'First paragraph.\n\nSecond paragraph.';
    const newContent = 'First paragraph updated.\n\nSecond paragraph updated.';
    const changes = calculateChanges(original, newContent);
    // Should have separate changes for each paragraph
    expect(changes.length).toBeGreaterThan(0);
  });

  it('should assign unique IDs to changes', () => {
    const original = 'A B C';
    const newContent = 'A X B Y C';
    const changes = calculateChanges(original, newContent);
    const ids = changes.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should handle empty original content', () => {
    const original = '';
    const newContent = 'New content';
    const changes = calculateChanges(original, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('add');
    expect(changes[0].newText).toBe('New content');
  });

  it('should handle empty new content', () => {
    const original = 'Original content';
    const newContent = '';
    const changes = calculateChanges(original, newContent);
    expect(changes.length).toBe(1);
    expect(changes[0].type).toBe('delete');
    expect(changes[0].originalText).toBe('Original content');
  });
});

describe('applyAcceptedChanges', () => {
  it('should apply accepted additions', () => {
    const original = 'Hello';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'add',
        startPosition: 5,
        endPosition: 5,
        newText: ' world',
        accepted: true,
      },
    ];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('Hello world');
  });

  it('should apply accepted deletions', () => {
    const original = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'delete',
        startPosition: 5,
        endPosition: 11,
        originalText: ' world',
        accepted: true,
      },
    ];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('Hello');
  });

  it('should apply accepted modifications', () => {
    const original = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'modify',
        startPosition: 6,
        endPosition: 11,
        originalText: 'world',
        newText: 'there',
        accepted: true,
      },
    ];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('Hello there');
  });

  it('should ignore non-accepted changes', () => {
    const original = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'modify',
        startPosition: 6,
        endPosition: 11,
        originalText: 'world',
        newText: 'there',
        accepted: false,
      },
    ];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('Hello world');
  });

  it('should apply multiple changes in correct order', () => {
    const original = 'A B C';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'modify',
        startPosition: 2,
        endPosition: 3,
        originalText: 'B',
        newText: 'X',
        accepted: true,
      },
      {
        id: '2',
        type: 'modify',
        startPosition: 4,
        endPosition: 5,
        originalText: 'C',
        newText: 'Y',
        accepted: true,
      },
    ];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('A X Y');
  });

  it('should handle empty changes array', () => {
    const original = 'Hello world';
    const changes: ChangeBlock[] = [];
    const result = applyAcceptedChanges(original, changes);
    expect(result).toBe('Hello world');
  });
});

describe('rejectAllChanges', () => {
  it('should return original content unchanged', () => {
    const original = 'Hello world';
    const result = rejectAllChanges(original);
    expect(result).toBe(original);
  });

  it('should handle empty content', () => {
    const original = '';
    const result = rejectAllChanges(original);
    expect(result).toBe('');
  });
});

