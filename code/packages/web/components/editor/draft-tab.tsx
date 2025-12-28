'use client';

import { useState, useRef, useCallback } from 'react';
import { api } from '@/lib/api/client';

interface DraftTabProps {
  paragraphId: string;
  blockContent: string;
  sectionHeading?: string;
  sectionContent?: string;
  documentId?: string; // Optional, not currently used but may be needed for future features
  onContentGenerated: (content: string, mode: 'blend' | 'replace' | 'extend') => void;
  onGeneratingChange?: (isGenerating: boolean) => void;
}

export function DraftTab({
  paragraphId,
  blockContent,
  sectionHeading,
  sectionContent,
  documentId: _documentId, // Prefixed with _ to indicate intentionally unused
  onContentGenerated,
  onGeneratingChange,
}: DraftTabProps) {
  const [draftText, setDraftText] = useState('');
  const [transformedContent, setTransformedContent] = useState<string | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [showBlendReplaceDialog, setShowBlendReplaceDialog] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTransform = useCallback(async () => {
    if (!draftText.trim() || isTransforming) return;

    setIsTransforming(true);
    if (onGeneratingChange) {
      onGeneratingChange(true);
    }

    try {
      // Always transform with 'replace' mode for preview (don't blend yet)
      const result = await api.ai.draft.transform({
        draftText: draftText.trim(),
        paragraphId,
        context: {
          blockContent: '', // Don't include existing content for preview
          sectionHeading,
          sectionContent,
        },
        mode: 'replace',
      });

      setTransformedContent(result.content);
    } catch (error) {
      console.error('Failed to transform draft:', error);
      // TODO: Show error notification
    } finally {
      setIsTransforming(false);
      if (onGeneratingChange) {
        onGeneratingChange(false);
      }
    }
  }, [draftText, paragraphId, sectionHeading, sectionContent, isTransforming, onGeneratingChange]);

  const handleInsert = useCallback(async (mode: 'blend' | 'replace' | 'extend') => {
    if (!draftText.trim()) return;

    // Close dialog immediately
    setShowBlendReplaceDialog(false);
    setIsTransforming(true);
    if (onGeneratingChange) {
      onGeneratingChange(true);
    }

    try {
      // Transform with the selected mode
      const transformMode = mode === 'extend' ? 'replace' : mode; // extend handled in frontend
      const result = await api.ai.draft.transform({
        draftText: draftText.trim(),
        paragraphId,
        context: {
          blockContent,
          sectionHeading,
          sectionContent,
        },
        mode: transformMode,
      });

      onContentGenerated(result.content, mode);
    } catch (error) {
      console.error('Failed to transform draft:', error);
      setIsTransforming(false);
      if (onGeneratingChange) {
        onGeneratingChange(false);
      }
    }
  }, [draftText, paragraphId, blockContent, sectionHeading, sectionContent, onContentGenerated, onGeneratingChange]);

  const handleUseTransformed = useCallback(() => {
    if (!transformedContent) return;

    // Check if block has existing content
    const hasExistingContent = blockContent.trim().length > 0;

    if (hasExistingContent) {
      // Show blend/replace dialog
      setPendingMode('blend');
      setShowBlendReplaceDialog(true);
    } else {
      // No existing content, just replace
      onContentGenerated(transformedContent, 'replace');
    }
  }, [transformedContent, blockContent, onContentGenerated]);

  return (
    <div className="flex flex-col h-full bg-black">
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Draft Input Area */}
        <div className="flex-1 flex flex-col border-b border-gray-800 min-w-0">
          <div className="p-4 border-b border-gray-800">
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Paste your notes or draft text
            </label>
            <textarea
              ref={textareaRef}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Paste notes, copied text, or rough draft here..."
              className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 resize-none focus:outline-none focus:border-gray-700"
              rows={8}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleTransform}
                disabled={!draftText.trim() || isTransforming}
                className="px-4 py-2 text-xs bg-vscode-blue hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isTransforming ? 'Transforming...' : 'Transform'}
              </button>
            </div>
          </div>

          {/* Transformed Content Preview */}
          {transformedContent && (
            <div className="flex-1 overflow-y-auto p-4 min-w-0">
              <div className="mb-2 flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Transformed Content
                </label>
                <button
                  onClick={handleUseTransformed}
                  className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors"
                >
                  Use This
                </button>
              </div>
              <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 whitespace-pre-wrap">
                {transformedContent}
              </div>
            </div>
          )}

          {!transformedContent && !isTransforming && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-xs text-gray-400 text-center">
                Paste your draft text above and click "Transform" to refine it into polished content.
              </div>
            </div>
          )}

          {isTransforming && (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-xs text-gray-400 text-center">
                Transforming your draft...
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Blend/Replace/Extend Dialog */}
      {showBlendReplaceDialog && transformedContent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 w-96">
            <h3 className="text-sm font-semibold text-white mb-2">Insert Content</h3>
            <p className="text-xs text-gray-400 mb-4">
              This block already has content. How would you like to proceed?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleInsert('blend')}
                disabled={isTransforming}
                className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
              >
                Blend
              </button>
              <button
                onClick={() => handleInsert('replace')}
                disabled={isTransforming}
                className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
              >
                Replace
              </button>
              <button
                onClick={() => handleInsert('extend')}
                disabled={isTransforming}
                className="flex-1 px-3 py-2 text-sm bg-gray-800 hover:bg-gray-700 text-white rounded border border-gray-700 transition-colors disabled:opacity-50"
              >
                Add
              </button>
              <button
                onClick={() => setShowBlendReplaceDialog(false)}
                disabled={isTransforming}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay - Only show when generating content (not just transforming for preview) */}
      {isTransforming && !showBlendReplaceDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 flex flex-col items-center gap-4 min-w-[200px]">
            <div className="w-8 h-8 border-4 border-gray-600 border-t-vscode-blue rounded-full animate-spin" />
            <div className="text-sm text-gray-400">Generating content...</div>
          </div>
        </div>
      )}
    </div>
  );
}

