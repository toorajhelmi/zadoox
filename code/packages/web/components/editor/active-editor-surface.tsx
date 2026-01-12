'use client';

import { AIEnhancedEditor } from './ai-enhanced-editor';
import { CodeMirrorEditor } from './codemirror-editor';
import type { ParagraphMode } from '@zadoox/shared';

export function ActiveEditorSurface(props: {
  editMode: 'markdown' | 'latex';
  markdown: {
    value: string;
    onChange: (next: string) => void;
    onSelectionChange: (sel: { from: number; to: number; text: string } | null) => void;
    onCursorPositionChange: (pos: { line: number; column: number } | null) => void;
    onDocumentAIMetricsChange: (payload: { metrics: Record<string, number> | null; analyzedSections: number; isAnalyzing: boolean } | null) => void;
    paragraphModes: Record<string, ParagraphMode>;
    documentId: string;
    thinkPanelOpen: boolean;
    openParagraphId: string | null;
    onOpenPanel: (paragraphId: string) => void;
    onEditorViewReady: (view: any) => void;
    readOnly: boolean;
    changes: any[];
    onAcceptChange: (id: string) => void;
    onRejectChange: (id: string) => void;
    onSaveWithType: (contentToSave: string, changeType: 'auto-save' | 'ai-action') => Promise<void>;
  };
  latex: {
    value: string;
    onChange: (next: string) => void;
    onCursorPositionChange: (pos: { line: number; column: number } | null) => void;
    onEditorViewReady: (view: any) => void;
    readOnly: boolean;
  };
}) {
  if (props.editMode === 'latex') {
    return (
      <CodeMirrorEditor
        value={props.latex.value}
        onChange={props.latex.onChange}
        onCursorPositionChange={props.latex.onCursorPositionChange}
        onEditorViewReady={props.latex.onEditorViewReady}
        language="plain"
        enableFormatMenu={false}
        readOnly={props.latex.readOnly}
      />
    );
  }

  return (
    <AIEnhancedEditor
      value={props.markdown.value}
      onChange={props.markdown.onChange}
      onSelectionChange={props.markdown.onSelectionChange}
      onCursorPositionChange={props.markdown.onCursorPositionChange}
      onDocumentAIMetricsChange={props.markdown.onDocumentAIMetricsChange}
      model="auto"
      paragraphModes={props.markdown.paragraphModes}
      documentId={props.markdown.documentId}
      thinkPanelOpen={props.markdown.thinkPanelOpen}
      openParagraphId={props.markdown.openParagraphId}
      onOpenPanel={props.markdown.onOpenPanel}
      onEditorViewReady={props.markdown.onEditorViewReady}
      readOnly={props.markdown.readOnly}
      changes={props.markdown.changes}
      onAcceptChange={props.markdown.onAcceptChange}
      onRejectChange={props.markdown.onRejectChange}
      onSaveWithType={props.markdown.onSaveWithType}
    />
  );
}


