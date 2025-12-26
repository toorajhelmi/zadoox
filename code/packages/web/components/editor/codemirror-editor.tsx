'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, ViewUpdate, gutter, GutterMarker } from '@codemirror/view';
import { FloatingFormatMenu, type FormatType } from './floating-format-menu';

// Dynamically import CodeMirror to avoid SSR issues
const CodeMirror = dynamic(
  () => import('@uiw/react-codemirror').then((mod) => mod.default),
  { ssr: false }
);

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (selection: { from: number; to: number; text: string } | null) => void;
  onCursorPositionChange?: (position: { line: number; column: number } | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extensions?: any[];
  onEditorViewReady?: (view: EditorView | null) => void;
  readOnly?: boolean;
}

const PLACEHOLDER_TEXT = 'Start editing...';

// Custom line number marker that only shows for non-empty lines
class LineNumberMarker extends GutterMarker {
  constructor(private lineNumber: number) {
    super();
  }

  eq(other: LineNumberMarker) {
    return this.lineNumber === other.lineNumber;
  }

  toDOM() {
    return document.createTextNode(this.lineNumber.toString());
  }
}

// Custom line numbers extension that hides numbers for empty lines
function customLineNumbers() {
  return gutter({
    class: 'cm-lineNumbers',
    renderEmptyElements: false,
    lineMarker: (view, line) => {
      try {
        const lineInfo = view.state.doc.lineAt(line.from);
        const lineText = lineInfo.text;
        // Only show line number if line is not empty (after trimming whitespace)
        if (lineText.trim().length > 0) {
          return new LineNumberMarker(lineInfo.number);
        }
        // Return null for empty lines (no number shown)
        return null;
      } catch {
        // Fallback: show number if we can't determine line content
        return null;
      }
    },
  });
}

export function CodeMirrorEditor({ value, onChange, onSelectionChange, onCursorPositionChange, extensions = [], onEditorViewReady, readOnly = false }: CodeMirrorEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const [hasEdited, setHasEdited] = useState(false);
  const [displayValue, setDisplayValue] = useState(value);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [formatMenuPosition, setFormatMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState({ from: 0, to: 0 });
  const selectionRangeRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear placeholder on first edit
  useEffect(() => {
    if (!hasEdited && value && value.includes(PLACEHOLDER_TEXT)) {
      // User started typing - clear placeholder
      const cleaned = value.replace(PLACEHOLDER_TEXT, '').trim();
      if (cleaned !== value) {
        onChange(cleaned);
        setHasEdited(true);
      }
    }
  }, [value, hasEdited, onChange]);

  // Update display value
  useEffect(() => {
    setDisplayValue(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    // Don't allow changes when read-only
    if (readOnly) {
      return;
    }
    
    if (!hasEdited && newValue !== value) {
      setHasEdited(true);
    }
    onChange(newValue);
  };

  // Format selected text (internal handler for floating menu)
  const handleFormatInternal = useCallback((format: FormatType) => {
    // Get selection from ref first (most reliable), then fall back to state
    let from = 0;
    let to = 0;
    let text = '';

    if (selectionRangeRef.current) {
      from = selectionRangeRef.current.from;
      to = selectionRangeRef.current.to;
      text = selectionRangeRef.current.text;
    } else if (selectionRange.from !== selectionRange.to && selectedText) {
      from = selectionRange.from;
      to = selectionRange.to;
      text = selectedText;
    } else if (editorViewRef.current) {
      // Last resort: try to get from editor view
      const selection = editorViewRef.current.state.selection.main;
      if (selection.from !== selection.to) {
        from = selection.from;
        to = selection.to;
        text = editorViewRef.current.state.sliceDoc(from, to);
      }
    }

    // Validate we have a valid selection
    if (!text || from === to || from < 0 || to < 0) {
      setShowFormatMenu(false);
      return;
    }

    let formattedText = '';

    switch (format) {
      case 'bold':
        formattedText = `**${text}**`;
        break;
      case 'italic':
        formattedText = `*${text}*`;
        break;
      case 'underline':
        formattedText = `<u>${text}</u>`;
        break;
      case 'superscript':
        formattedText = `<sup>${text}</sup>`;
        break;
      case 'subscript':
        formattedText = `<sub>${text}</sub>`;
        break;
      case 'code':
        formattedText = `\`${text}\``;
        break;
      case 'link':
        formattedText = `[${text}](url)`;
        break;
    }

    // Replace selected text with formatted version using current displayValue
    const currentValue = displayValue;
    
    // Validate range is within bounds
    if (from > currentValue.length || to > currentValue.length) {
      setShowFormatMenu(false);
      return;
    }

    const newValue = 
      currentValue.slice(0, from) + 
      formattedText + 
      currentValue.slice(to);

    onChange(newValue);
    selectionRangeRef.current = null;
    setShowFormatMenu(false);
    setSelectedText('');
    setSelectionRange({ from: 0, to: 0 });
    
    // Try to update cursor position after formatting (using CodeMirror API)
    if (editorViewRef.current) {
      const newPos = from + formattedText.length;
      setTimeout(() => {
        if (editorViewRef.current) {
          try {
            editorViewRef.current.dispatch({
              selection: { anchor: newPos, head: newPos },
            });
          } catch (e) {
            // Cursor update failed, but formatting succeeded
          }
        }
      }, 10);
    }
  }, [selectedText, selectionRange, displayValue, onChange]);


  // Get editor view reference
  useEffect(() => {
    // Try to get view from container after editor mounts
    const timer = setTimeout(() => {
      if (editorContainerRef.current) {
        const cmEditor = editorContainerRef.current.querySelector('.cm-editor');
        if (cmEditor) {
          // @uiw/react-codemirror stores view in a specific way
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const view = (cmEditor as any).__cm_view?.view || (cmEditor as any).cmView?.view;
          if (view) {
            editorViewRef.current = view;
          }
        }
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [displayValue]);

  // Hide menu on click outside (but not on the menu itself)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showFormatMenu) {
        const target = e.target as Node;
        // Check if click is outside both editor and floating menu
        const clickedInEditor = editorRef.current?.contains(target);
        const clickedInMenu = (e.target as HTMLElement)?.closest('.floating-format-menu');
        
        if (!clickedInEditor && !clickedInMenu) {
          setShowFormatMenu(false);
        }
      }
    };

    // Use a small delay to allow menu button clicks to register first
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFormatMenu]);

  // Extension to track selection and show floating menu, and expose editor view
  const selectionExtension = useCallback(() => {
    return EditorView.updateListener.of((update: ViewUpdate) => {
      // Expose editor view to parent
      if (update.view && onEditorViewReady) {
        editorViewRef.current = update.view;
        onEditorViewReady(update.view);
      }
      
      // Track cursor position (line and column)
      if (update.selectionSet && update.view && onCursorPositionChange) {
        const selection = update.state.selection.main;
        const line = update.state.doc.lineAt(selection.head);
        const lineNumber = line.number;
        const column = selection.head - line.from + 1; // +1 for 1-based column
        
        onCursorPositionChange({
          line: lineNumber,
          column: column,
        });
      } else if (update.view && onCursorPositionChange) {
        // Also update on other changes (like content changes)
        const selection = update.view.state.selection.main;
        const line = update.view.state.doc.lineAt(selection.head);
        const lineNumber = line.number;
        const column = selection.head - line.from + 1;
        
        onCursorPositionChange({
          line: lineNumber,
          column: column,
        });
      }
      
      if (update.selectionSet && update.view) {
        const selection = update.state.selection.main;
        const selectedText = update.state.sliceDoc(selection.from, selection.to).trim();
        
        if (!selectedText || selection.from === selection.to) {
          // No selection
          if (selectionTimeoutRef.current) {
            clearTimeout(selectionTimeoutRef.current);
            selectionTimeoutRef.current = null;
          }
          selectionRangeRef.current = null;
          setShowFormatMenu(false);
          setSelectedText('');
          setSelectionRange({ from: 0, to: 0 });
          if (onSelectionChange) {
            onSelectionChange(null);
          }
          return;
        }

        // Text is selected - get position
        const coords = update.view.coordsAtPos(selection.head);
        if (!coords) return;

        editorViewRef.current = update.view;

        if (selectionTimeoutRef.current) {
          clearTimeout(selectionTimeoutRef.current);
        }
        
        selectionTimeoutRef.current = setTimeout(() => {
          const range = { from: selection.from, to: selection.to, text: selectedText };
          
          // Store in both state and ref for reliability
          selectionRangeRef.current = range;
          setFormatMenuPosition({
            x: coords.left + window.scrollX,
            y: coords.top + window.scrollY,
          });
          setSelectedText(selectedText);
          setSelectionRange({ from: range.from, to: range.to });
          
          if (onSelectionChange) {
            onSelectionChange({
              from: range.from,
              to: range.to,
              text: selectedText,
            });
          }
          
          setShowFormatMenu(true);
        }, 150);
      }
    });
  }, [onSelectionChange, onEditorViewReady, onCursorPositionChange]);

  return (
    <div ref={editorContainerRef} className="h-full w-full relative">
      <div ref={editorRef} className="h-full w-full">
        <CodeMirror
          value={displayValue}
          onChange={handleChange}
          extensions={[markdown(), EditorView.lineWrapping, customLineNumbers(), selectionExtension(), ...extensions]}
          theme={oneDark}
          basicSetup={{
            lineNumbers: false, // Disable default line numbers, use custom
            highlightActiveLine: true,
            foldGutter: true,
            dropCursor: false,
            allowMultipleSelections: false,
          }}
          className="h-full"
          editable={!readOnly}
        />
      </div>
      {showFormatMenu && (
        <FloatingFormatMenu
          position={formatMenuPosition}
          onFormat={handleFormatInternal}
        />
      )}
    </div>
  );
}

