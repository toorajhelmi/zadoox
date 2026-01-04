'use client';

import type { InlineEditOperation } from '@zadoox/shared';
import type { QuickOption, QuickOptionWizardKey } from '@/lib/services/context-options';

export type EditorSurfaceMode = 'markdown' | 'latex';

export interface InlineWizardPreview {
  operations: InlineEditOperation[];
  previewText: string;
  newContent: string;
}

export type InlineWizardScopeStrategy =
  | 'selection-or-prev-paragraph'
  | 'selection-or-cursor-paragraph'
  | 'cursor';

export interface InlineWizardContext {
  option: QuickOption;
  documentId: string;
  editMode: EditorSurfaceMode;
  content: string;
  cursorPosition: { line: number; column: number };
  scope: {
    kind: 'selection' | 'previous_paragraph' | 'cursor_paragraph' | 'cursor';
    text: string;
  };
}

export interface InlineWizardProps {
  ctx: InlineWizardContext;
  onCancel: () => void;
  onCloseAll: () => void;
  onPreview: (input: { prompt: string; mode: 'update' | 'insert'; scopeStrategy?: InlineWizardScopeStrategy }) => Promise<InlineWizardPreview>;
  onPreviewInsert?: (input: { content: string; placement?: 'before' | 'after' }) => Promise<InlineWizardPreview>;
  onApply: (preview: InlineWizardPreview) => Promise<void>;
}

export type InlineWizardComponent = (props: InlineWizardProps) => JSX.Element;

export function isWizardKey(value: unknown): value is QuickOptionWizardKey {
  return (
    value === 'translate' ||
    value === 'add-section' ||
    value === 'insert-figure' ||
    value === 'insert-figure-grid' ||
    value === 'insert-table' ||
    value === 'insert-equation'
  );
}


