/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { mapChangesToNewContent } from '../diff-mapper';
import type { ChangeBlock } from '@zadoox/shared';

describe('mapChangesToNewContent', () => {
  it('should map addition changes to new content positions', () => {
    const original = 'Hello';
    const newContent = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'add',
        startPosition: 5, // Insert at position 5 in original
        endPosition: 5,
        newText: ' world',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(1);
    expect(mapped[0].startPosition).toBe(5); // Should be at position 5 in new content
    expect(mapped[0].endPosition).toBe(11); // 5 + 6 (length of ' world')
  });

  it('should map modification changes to new content positions', () => {
    const original = 'Hello world';
    const newContent = 'Hello there';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'modify',
        startPosition: 6, // In original
        endPosition: 11,
        originalText: 'world',
        newText: 'there',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(1);
    expect(mapped[0].startPosition).toBe(6); // Same position in new content
    expect(mapped[0].endPosition).toBe(11); // 6 + 5 (length of 'there')
  });

  it('should skip deletion changes (not shown in new content)', () => {
    const original = 'Hello world';
    const newContent = 'Hello';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'delete',
        startPosition: 5,
        endPosition: 11,
        originalText: ' world',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(0); // Deletions don't appear in new content
  });

  it('should handle multiple changes in order', () => {
    const original = 'A B C';
    const newContent = 'A X B Y C';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'add',
        startPosition: 2,
        endPosition: 2,
        newText: 'X ',
      },
      {
        id: '2',
        type: 'add',
        startPosition: 5,
        endPosition: 5,
        newText: 'Y ',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(2);
    expect(mapped[0].startPosition).toBe(2);
    expect(mapped[1].startPosition).toBeGreaterThan(mapped[0].endPosition);
  });

  it('should handle empty changes array', () => {
    const original = 'Hello';
    const newContent = 'Hello';
    const changes: ChangeBlock[] = [];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped).toEqual([]);
  });

  it('should handle changes at the beginning', () => {
    const original = 'world';
    const newContent = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'add',
        startPosition: 0,
        endPosition: 0,
        newText: 'Hello ',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(1);
    expect(mapped[0].startPosition).toBe(0);
    expect(mapped[0].endPosition).toBe(6);
  });

  it('should handle changes at the end', () => {
    const original = 'Hello';
    const newContent = 'Hello world';
    const changes: ChangeBlock[] = [
      {
        id: '1',
        type: 'add',
        startPosition: 5,
        endPosition: 5,
        newText: ' world',
      },
    ];
    const mapped = mapChangesToNewContent(changes, original, newContent);
    expect(mapped.length).toBe(1);
    expect(mapped[0].startPosition).toBe(5);
    expect(mapped[0].endPosition).toBe(11);
  });
});

