/**
 * Diff calculation utilities for AI change tracking
 */

import DiffMatchPatch from 'diff-match-patch';
import type { ChangeBlock } from '@zadoox/shared';

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

  // Merge all adjacent or nearby changes (within threshold) into single changes
  // This treats a single insertion/replacement as one change, even if diff-match-patch breaks it into multiple operations
  const mergedChanges: ChangeBlock[] = [];
  const MERGE_THRESHOLD = 100; // Merge changes within 100 characters of each other
  
  for (let i = 0; i < changes.length; i++) {
    const current = changes[i];
    
    if (mergedChanges.length === 0) {
      mergedChanges.push({ ...current });
      continue;
    }
    
    const last = mergedChanges[mergedChanges.length - 1];
    const lastEnd = last.endPosition || last.startPosition;
    const currentStart = current.startPosition;
    const distance = currentStart - lastEnd;
    
    // If changes are adjacent or very close (within threshold), merge them
    if (distance <= MERGE_THRESHOLD && distance >= 0) {
      // Merge into a single "modify" change that covers the entire range
      const mergedStart = Math.min(last.startPosition, current.startPosition);
      const mergedEnd = Math.max(
        last.endPosition || last.startPosition,
        current.endPosition || current.startPosition
      );
      
      // Combine original text (for deletions/modifications)
      const lastOriginal = last.type === 'delete' || last.type === 'modify' ? (last.originalText || '') : '';
      const currentOriginal = current.type === 'delete' || current.type === 'modify' ? (current.originalText || '') : '';
      const gapText = distance > 0 ? originalContent.substring(lastEnd, currentStart) : '';
      const combinedOriginal = lastOriginal + gapText + currentOriginal;
      
      // Combine new text (for additions/modifications)
      const lastNew = last.type === 'add' || last.type === 'modify' ? (last.newText || '') : '';
      const currentNew = current.type === 'add' || current.type === 'modify' ? (current.newText || '') : '';
      const combinedNew = lastNew + currentNew;
      
      // Replace last change with merged change
      mergedChanges[mergedChanges.length - 1] = {
        id: last.id, // Keep first change's ID
        type: 'modify', // Always treat merged as modify
        startPosition: mergedStart,
        endPosition: mergedEnd,
        originalText: combinedOriginal || undefined,
        newText: combinedNew || undefined,
        accepted: undefined,
      };
    } else {
      // Too far apart - add as separate change
      mergedChanges.push({ ...current });
    }
  }

  // #region agent log
  if (typeof fetch !== 'undefined') {
    fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'diff.ts:77',message:'Merged consecutive changes',data:{beforeMerge:changes.length,afterMerge:mergedChanges.length,changes:mergedChanges.map(c=>({type:c.type,start:c.startPosition,end:c.endPosition,textLength:c.newText?.length||c.originalText?.length||0}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
  }
  // #endregion

  return mergedChanges;
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

