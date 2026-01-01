/**
 * Editor types for change tracking and diff visualization
 */

export type ChangeType = 'add' | 'delete' | 'modify';

/**
 * A single change block representing an addition, deletion, or modification
 */
export interface ChangeBlock {
  id: string;
  type: ChangeType;
  startPosition: number; // Character position in original document
  endPosition: number; // Character position in original document (for delete/modify)
  originalText?: string; // Text that was deleted or modified
  newText?: string; // Text that was added or replaces originalText
  accepted?: boolean; // Whether user has accepted this change (undefined = pending)
}

/**
 * Collection of changes for a document or block
 */
export interface DocumentChanges {
  changes: ChangeBlock[];
  originalContent: string;
  newContent: string;
  blockId?: string; // Optional paragraph/block ID this change applies to
}


