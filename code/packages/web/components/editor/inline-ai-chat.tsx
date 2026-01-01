'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getContextOptions, getAdjacentBlocks, type QuickOption } from '@/lib/services/context-options';
import type { DocumentStyle } from '@zadoox/shared';

interface InlineAIChatProps {
  position: { top: number; left: number };
  content: string;
  cursorPosition: { line: number; column: number };
  documentStyle: DocumentStyle;
  onClose: () => void;
  onSend: (message: string) => void;
  onQuickOption: (option: QuickOption) => void;
}

export function InlineAIChat({
  position,
  content,
  cursorPosition,
  documentStyle,
  onClose,
  onSend,
  onQuickOption,
}: InlineAIChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [quickOptions, setQuickOptions] = useState<QuickOption[]>([]);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get context options when component mounts or cursor/content changes
  useEffect(() => {
    const adjacentBlocks = getAdjacentBlocks(content, cursorPosition.line);
    const options = getContextOptions({
      documentStyle,
      cursorPosition,
      content,
      adjacentBlocks,
    });
    setQuickOptions(options);
  }, [documentStyle, cursorPosition, content]);

  // Adjust position to stay within viewport bounds
  useEffect(() => {
    const adjustPosition = () => {
      const minWidth = 400;
      const maxWidth = 600;
      const padding = 16; // Padding from viewport edges
      
      let adjustedLeft = position.left;
      let adjustedTop = position.top;
      
      // Check right edge overflow
      const rightEdge = position.left + maxWidth;
      const viewportWidth = window.innerWidth;
      if (rightEdge > viewportWidth - padding) {
        // Shift left to keep within viewport
        adjustedLeft = viewportWidth - maxWidth - padding;
        // But don't go too far left (keep at least some padding)
        adjustedLeft = Math.max(padding, adjustedLeft);
      }
      
      // Check left edge overflow
      if (adjustedLeft < padding) {
        adjustedLeft = padding;
      }
      
      setAdjustedPosition({ top: adjustedTop, left: adjustedLeft });
      
      // Adjust top after container renders to check bottom overflow with actual height
      requestAnimationFrame(() => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          
          let finalTop = adjustedTop;
          
          // Check bottom edge overflow with actual height
          const bottomEdge = finalTop + rect.height;
          if (bottomEdge > viewportHeight - padding) {
            finalTop = viewportHeight - rect.height - padding;
            finalTop = Math.max(padding, finalTop);
          }
          
          // Check top edge overflow
          if (finalTop < padding) {
            finalTop = padding;
          }
          
          if (Math.abs(finalTop - adjustedTop) > 1) {
            setAdjustedPosition({ top: finalTop, left: adjustedLeft });
          }
        }
      });
    };
    
    adjustPosition();
    window.addEventListener('resize', adjustPosition);
    return () => window.removeEventListener('resize', adjustPosition);
  }, [position]);
  
  // Focus input when opened
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Handle escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = useCallback(() => {
    if (inputValue.trim()) {
      onSend(inputValue.trim());
      setInputValue('');
      onClose();
    }
  }, [inputValue, onSend, onClose]);

  const handleQuickOption = useCallback((option: QuickOption) => {
    onQuickOption(option);
    onClose();
  }, [onQuickOption, onClose]);

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-2xl"
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
        minWidth: '400px',
        maxWidth: '600px',
      }}
    >
      {/* Quick Options */}
      {quickOptions.length > 0 && (
        <div className="p-2 border-b border-gray-800">
          <div className="text-xs text-gray-400 mb-2 px-2">Quick options</div>
          <div className="flex flex-wrap gap-1">
            {quickOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => handleQuickOption(option)}
                className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                title={option.description}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 flex items-center gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Ask anything or choose a quick option..."
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300 transition-colors"
          title="Close (Esc)"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          className="p-1.5 bg-vscode-blue hover:bg-blue-600 disabled:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed rounded text-white transition-colors"
          title="Send (Enter)"
        >
          <ArrowRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

