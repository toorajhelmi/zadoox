/**
 * Utility to map change positions from original content to new content
 * When showing new content with decorations, we need positions relative to new content
 */

import type { ChangeBlock } from '@zadoox/shared';

/**
 * Map change positions from original content to new content
 * This is needed because diff positions are in original content, but we display new content
 */
export function mapChangesToNewContent(changes: ChangeBlock[], originalContent: string, _newContent: string): ChangeBlock[] {
  // For simplicity, we'll create a position mapping
  // This is a simplified approach - for production, you'd want a more robust mapping
  
  const mappedChanges: ChangeBlock[] = [];
  let newPosition = 0;
  let originalPosition = 0;
  let changeIndex = 0;
  
  // Sort changes by position
  const sortedChanges = [...changes].sort((a, b) => a.startPosition - b.startPosition);
  
  while (originalPosition < originalContent.length && changeIndex < sortedChanges.length) {
    const change = sortedChanges[changeIndex];
    
    // If we've passed this change, skip it
    if (change.startPosition < originalPosition) {
      changeIndex++;
      continue;
    }
    
    // Advance to the change position in original
    if (originalPosition < change.startPosition) {
      const segment = originalContent.substring(originalPosition, change.startPosition);
      // This segment is unchanged, so advance in both
      newPosition += segment.length;
      originalPosition += segment.length;
    }
    
    // Now we're at the change
    if (change.type === 'add') {
      // Addition - insert position is in original, but content appears in new
      // The position in new content is where we are now
      mappedChanges.push({
        ...change,
        startPosition: newPosition,
        endPosition: newPosition + (change.newText?.length || 0),
      });
      // Advance in new content
      newPosition += change.newText?.length || 0;
      // Don't advance in original (addition doesn't consume original)
    } else if (change.type === 'delete') {
      // Deletion - text removed, so it doesn't appear in new content
      // We can't show deletions in new content, so skip them
      // Advance in original only
      originalPosition += (change.endPosition || change.startPosition) - change.startPosition;
    } else if (change.type === 'modify') {
      // Modification - original text replaced with new text
      mappedChanges.push({
        ...change,
        startPosition: newPosition,
        endPosition: newPosition + (change.newText?.length || 0),
      });
      // Advance in new content by new text length
      newPosition += change.newText?.length || 0;
      // Advance in original by original text length
      originalPosition += (change.endPosition || change.startPosition) - change.startPosition;
    }
    
    changeIndex++;
  }
  
  return mappedChanges;
}

