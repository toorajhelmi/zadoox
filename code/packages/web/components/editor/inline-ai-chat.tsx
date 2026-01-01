'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getAllQuickOptions, getContextOptions, getAdjacentBlocks, type QuickOption } from '@/lib/services/context-options';
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
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [optionsQuery, setOptionsQuery] = useState('');
  const [activeFlow, setActiveFlow] = useState<{
    key: NonNullable<QuickOption['followUpKey']>;
    option: QuickOption;
    step: number;
    answers: string[];
  } | null>(null);
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

  const startFlowIfNeeded = useCallback((option: QuickOption): boolean => {
    if (!option.followUpKey) return false;
    setActiveFlow({
      key: option.followUpKey,
      option,
      step: 0,
      answers: [],
    });
    setShowAllOptions(false);
    setOptionsQuery('');
    setInputValue('');
    // Focus input for the follow-up question
    requestAnimationFrame(() => inputRef.current?.focus());
    return true;
  }, []);

  const handleQuickOption = useCallback(
    (option: QuickOption) => {
      if (startFlowIfNeeded(option)) return;
      onQuickOption(option);
      onClose();
    },
    [onQuickOption, onClose, startFlowIfNeeded]
  );

  const allOptions = getAllQuickOptions();
  const filteredAllOptions = allOptions
    .filter((o) => {
      const q = optionsQuery.trim().toLowerCase();
      if (!q) return true;
      const hay = `${o.label} ${o.description || ''} ${o.group}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 50);

  const flowPrompt = (() => {
    if (!activeFlow) return null;
    if (activeFlow.key === 'translate') {
      return activeFlow.step === 0 ? 'Translate from which language?' : 'Translate to which language?';
    }
    if (activeFlow.key === 'add-section') {
      return 'What should the new section be titled?';
    }
    return null;
  })();

  const handleFlowSubmit = useCallback(() => {
    if (!activeFlow) return;
    const answer = inputValue.trim();
    if (!answer) return;

    const nextAnswers = [...activeFlow.answers, answer];

    if (activeFlow.key === 'translate') {
      if (nextAnswers.length < 2) {
        setActiveFlow({ ...activeFlow, answers: nextAnswers, step: activeFlow.step + 1 });
        setInputValue('');
        return;
      }
      const [from, to] = nextAnswers;
      const concrete: QuickOption = {
        ...activeFlow.option,
        // Make the prompt concrete and self-contained
        action: `Translate this content from ${from} to ${to}. Preserve formatting (Markdown / Zadoox extended Markdown) and keep technical terms accurate.`,
        followUpKey: undefined,
      };
      onQuickOption(concrete);
      onClose();
      return;
    }

    if (activeFlow.key === 'add-section') {
      const [title] = nextAnswers;
      const concrete: QuickOption = {
        ...activeFlow.option,
        action: `Add a new section titled "${title}" here. Insert an appropriate Markdown heading and 1–2 starter paragraphs that fit the surrounding context.`,
        followUpKey: undefined,
      };
      onQuickOption(concrete);
      onClose();
      return;
    }
  }, [activeFlow, inputValue, onQuickOption, onClose]);

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
            {quickOptions.slice(0, 3).map((option) => (
              <button
                key={option.id}
                onClick={() => handleQuickOption(option)}
                className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                title={option.description}
              >
                {option.label}
              </button>
            ))}

            <button
              onClick={() => setShowAllOptions((v) => !v)}
              className="px-2 py-1 text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-700 transition-colors"
              title="Search all actions"
            >
              More…
            </button>
          </div>

          {showAllOptions && (
            <div className="mt-2 border-t border-gray-800 pt-2">
              <input
                value={optionsQuery}
                onChange={(e) => setOptionsQuery(e.target.value)}
                placeholder="Search all actions…"
                className="w-full bg-gray-950 text-xs text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
              />

              <div className="mt-2 max-h-48 overflow-auto space-y-1">
                {filteredAllOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleQuickOption(opt)}
                    className="w-full text-left px-2 py-1 rounded border border-gray-800 hover:border-gray-700 hover:bg-gray-800/40 transition-colors"
                    title={opt.description}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-200">{opt.label}</span>
                      <span className="text-[10px] text-gray-400">{opt.group}</span>
                    </div>
                    {opt.description && <div className="text-[10px] text-gray-400 mt-0.5">{opt.description}</div>}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              if (activeFlow) {
                handleFlowSubmit();
              } else {
                handleSend();
              }
            }
          }}
          placeholder={flowPrompt || 'Ask anything or choose a quick option...'}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
        />
        {activeFlow && (
          <button
            onClick={() => {
              setActiveFlow(null);
              setInputValue('');
            }}
            className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
            title="Cancel"
          >
            Cancel
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-gray-300 transition-colors"
          title="Close (Esc)"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            if (activeFlow) {
              handleFlowSubmit();
            } else {
              handleSend();
            }
          }}
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

