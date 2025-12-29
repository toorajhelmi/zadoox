'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeBlock } from '@zadoox/shared';

interface ChangeIndicatorsProps {
  content: string;
  changes: ChangeBlock[];
  editorView: any; // EditorView from CodeMirror
}

/**
 * Change Indicators Column
 * Shows green/red/blue indicator bars on the right side for AI changes
 */
export function ChangeIndicators({ content, changes, editorView }: ChangeIndicatorsProps) {
  const [indicatorPositions, setIndicatorPositions] = useState<Array<{ top: number; height: number; type: ChangeBlock['type'] }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!editorView || changes.length === 0) {
      setIndicatorPositions([]);
      return;
    }

    const updatePositions = () => {
      const positions: Array<{ top: number; height: number; type: ChangeBlock['type'] }> = [];
      const container = containerRef.current;
      if (!container || !editorView) return;

      const editor = editorView.dom;
      const editorRect = editor.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollContainer = editor.closest('.cm-scroller') || editor;
      
      for (const change of changes) {
        if (change.accepted !== undefined) continue; // Skip accepted/rejected changes

        try {
          // Get line information for the change position
          const doc = editorView.state.doc;
          if (change.startPosition >= doc.length) continue;

          // Get coordinates from editor
          const startCoords = editorView.coordsAtPos(change.startPosition, false);
          const endPos = change.endPosition ? Math.min(change.endPosition, doc.length) : change.startPosition;
          const endCoords = editorView.coordsAtPos(endPos, false);

          if (!startCoords || !endCoords) continue;

          // Calculate position relative to editor's scroller
          const scrollTop = scrollContainer.scrollTop || 0;
          const top = startCoords.top - scrollTop;
          const height = Math.max(endCoords.bottom - startCoords.top, 4);

          positions.push({
            top: Math.max(0, top),
            height: Math.max(4, height),
            type: change.type,
          });
        } catch (error) {
          // Skip changes that can't be positioned
          console.warn('Failed to position change indicator:', error);
        }
      }

      setIndicatorPositions(positions);
    };

    // Update positions on scroll and resize
    const handleUpdate = () => {
      requestAnimationFrame(updatePositions);
    };

    const scrollContainer = editorView.dom.closest('.cm-scroller') || editorView.dom;
    scrollContainer.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);
    
    // Initial update
    const timeoutId = setTimeout(updatePositions, 100);
    updatePositions();

    return () => {
      scrollContainer.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearTimeout(timeoutId);
    };
  }, [changes, editorView, content]);

  const getIndicatorColor = (type: ChangeBlock['type']) => {
    switch (type) {
      case 'add':
        return 'bg-green-500';
      case 'delete':
        return 'bg-red-500';
      case 'modify':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (changes.length === 0 || indicatorPositions.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute right-6 top-0 bottom-0 w-1 pointer-events-none z-10"
    >
      {indicatorPositions.map((pos, index) => (
        <div
          key={index}
          className={`absolute ${getIndicatorColor(pos.type)} opacity-80`}
          style={{
            top: `${pos.top}px`,
            height: `${pos.height}px`,
            width: '3px',
            right: '0',
          }}
        />
      ))}
    </div>
  );
}

