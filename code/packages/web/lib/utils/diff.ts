/**
 * Diff calculation utilities for AI change tracking
 */

import DiffMatchPatch from 'diff-match-patch';
import type { ChangeBlock, ChangeType } from '@zadoox/shared';

const dmp = new DiffMatchPatch();

/**
 * Calculate changes between original and new content
 * Returns an array of ChangeBlock objects representing additions, deletions, and modifications
 */
export function calculateChanges(originalContent: string, newContent: string): ChangeBlock[] {
  // Calculate diffs using diff-match-patch
  const diffs = dmp.diff_main(originalContent, newContent);
  dmp.diff_cleanupSemantic(diffs);

  const changes: ChangeBlock[] = [];
  let position = 0;
  let changeId = 0;

  // Process diffs and convert to ChangeBlock format
  // diff-match-patch returns: -1 = delete, 0 = equal, 1 = insert
  for (let i = 0; i < diffs.length; i++) {
    const [operation, text] = diffs[i];
    
    if (operation === -1) {
      // Delete operation
      const nextDiff = i + 1 < diffs.length ? diffs[i + 1] : null;
      
      if (nextDiff && nextDiff[0] === 1) {
        // Next operation is insert - this is a modification
        changes.push({
          id: `change-${changeId++}`,
          type: 'modify',
          startPosition: position,
          endPosition: position + text.length,
          originalText: text,
          newText: nextDiff[1],
          accepted: undefined,
        });
        // Skip the next insert operation since we've already processed it as modify
        i++;
        position += text.length; // Advance position past deleted text
      } else {
        // Pure deletion
        changes.push({
          id: `change-${changeId++}`,
          type: 'delete',
          startPosition: position,
          endPosition: position + text.length,
          originalText: text,
          accepted: undefined,
        });
        position += text.length;
      }
    } else if (operation === 1) {
      // Insert operation (not preceded by delete, so it's a pure addition)
      // For additions, startPosition and endPosition are the same (insertion point in original content)
      // The mapper will convert these to the correct positions in the new content
      changes.push({
        id: `change-${changeId++}`,
        type: 'add',
        startPosition: position, // Insert at current position in original content
        endPosition: position, // Same as startPosition (no text to mark in original content)
        newText: text,
        accepted: undefined,
      });
      // Don't advance position for pure insertions (they don't consume original content)
    } else {
      // Equal (no change) - just advance position
      position += text.length;
    }
  }

  return changes;
}

/**
 * Apply accepted changes to original content
 * Only changes with accepted === true are applied
 */
export function applyAcceptedChanges(originalContent: string, changes: ChangeBlock[]): string {
  // Sort changes by position (descending) to apply from end to start (preserves positions)
  const sortedChanges = [...changes]
    .filter(change => change.accepted === true)
    .sort((a, b) => b.startPosition - a.startPosition);

  let result = originalContent;

  for (const change of sortedChanges) {
    const before = result.substring(0, change.startPosition);
    const after = result.substring(change.endPosition);

    if (change.type === 'add') {
      // Insert new text
      result = before + (change.newText || '') + after;
    } else if (change.type === 'delete') {
      // Remove text (already handled by substring)
      result = before + after;
    } else if (change.type === 'modify') {
      // Replace text
      result = before + (change.newText || '') + after;
    }
  }

  return result;
}

/**
 * Reject all changes (return original content)
 */
export function rejectAllChanges(originalContent: string): string {
  return originalContent;
}

