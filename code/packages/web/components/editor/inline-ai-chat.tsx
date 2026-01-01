'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRightIcon, ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  getAllQuickOptions,
  getContextOptions,
  getAdjacentBlocks,
  type QuickOption,
  type QuickOptionGroup,
} from '@/lib/services/context-options';
import type { DocumentStyle } from '@zadoox/shared';
import type { InlineWizardPreview, InlineWizardComponent } from './inline-wizards/types';
import type { InlineWizardScopeStrategy } from './inline-wizards/types';
import { TranslateWizard } from './inline-wizards/translate-wizard';
import { InsertFigureWizard } from './inline-wizards/insert-figure-wizard';
import { TodoWizard } from './inline-wizards/todo-wizard';

interface InlineAIChatProps {
  position: { top: number; left: number };
  content: string;
  cursorPosition: { line: number; column: number };
  selection?: { from: number; to: number; text: string } | null;
  scopeText?: string;
  scopeKind?: 'selection' | 'previous_paragraph' | 'cursor_paragraph' | 'cursor';
  documentStyle: DocumentStyle;
  onClose: () => void;
  onSend: (message: string) => void;
  onQuickOption: (option: QuickOption) => void;
  onPreviewInlineEdit: (input: {
    prompt: string;
    mode: 'update' | 'insert';
    scopeStrategy?: InlineWizardScopeStrategy;
  }) => Promise<InlineWizardPreview>;
  onPreviewInsertAtCursor: (input: { content: string; placement?: 'before' | 'after' }) => Promise<InlineWizardPreview>;
  onApplyInlinePreview: (preview: InlineWizardPreview) => Promise<void>;
}

export function InlineAIChat({
  position,
  content,
  cursorPosition,
  selection,
  scopeText,
  scopeKind,
  documentStyle,
  onClose,
  onSend,
  onQuickOption,
  onPreviewInlineEdit,
  onPreviewInsertAtCursor,
  onApplyInlinePreview,
}: InlineAIChatProps) {
  const [inputValue, setInputValue] = useState('');
  const [quickOptions, setQuickOptions] = useState<QuickOption[]>([]);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [optionsQuery, setOptionsQuery] = useState('');
  const [optionsLevel, setOptionsLevel] = useState<'groups' | 'options'>('groups');
  const [selectedGroup, setSelectedGroup] = useState<QuickOptionGroup | null>(null);
  const [activeWizard, setActiveWizard] = useState<{ option: QuickOption } | null>(null);
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

  const derivedScopeText = (scopeText || selection?.text || '').trim();
  const derivedScopeKind: NonNullable<InlineAIChatProps['scopeKind']> =
    scopeKind || ((selection?.text || '').trim() ? 'selection' : 'cursor_paragraph');

  // Adjust position to stay within viewport bounds (re-runs on size changes too)
  useEffect(() => {
    const padding = 16;

    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

    const recalc = () => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const maxLeft = Math.max(padding, viewportWidth - rect.width - padding);
      const maxTop = Math.max(padding, viewportHeight - rect.height - padding);

      const newLeft = clamp(position.left, padding, maxLeft);
      const newTop = clamp(position.top, padding, maxTop);

      setAdjustedPosition((prev) => {
        if (Math.abs(prev.left - newLeft) < 1 && Math.abs(prev.top - newTop) < 1) return prev;
        return { left: newLeft, top: newTop };
      });
    };

    // Initial (after mount/layout)
    requestAnimationFrame(recalc);

    // Recalc on viewport resize
    window.addEventListener('resize', recalc);

    // Recalc when content height/width changes (e.g. opening "More…" / groups)
    const ro = new ResizeObserver(() => requestAnimationFrame(recalc));
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', recalc);
      ro.disconnect();
    };
  }, [position, showAllOptions, optionsLevel, selectedGroup, activeWizard]);
  
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

  const handleQuickOption = useCallback(
    (option: QuickOption) => {
      if (option.wizardKey) {
        setActiveWizard({ option });
        setShowAllOptions(false);
        setOptionsLevel('groups');
        setSelectedGroup(null);
        setOptionsQuery('');
        return;
      }
      onQuickOption(option);
      onClose();
    },
    [onQuickOption, onClose]
  );

  const allOptions = getAllQuickOptions();

  const groupCounts = (['Generation', 'Transformation', 'Structure', 'Tone'] as const).map((group) => ({
    group,
    count: allOptions.filter((o) => o.group === group).length,
  }));

  const groupOptions = selectedGroup ? allOptions.filter((o) => o.group === selectedGroup) : [];
  const filteredGroupOptions = groupOptions
    .filter((o) => {
      const q = optionsQuery.trim().toLowerCase();
      if (!q) return true;
      const hay = `${o.label} ${o.description || ''} ${o.group} ${o.subgroup || ''}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 50);

  const subgrouped = (() => {
    const map = new Map<string, QuickOption[]>();
    for (const opt of filteredGroupOptions) {
      const key = opt.subgroup || 'Other';
      map.set(key, [...(map.get(key) || []), opt]);
    }
    return Array.from(map.entries());
  })();

  const WizardComponent: InlineWizardComponent | null = (() => {
    const option = activeWizard?.option;
    if (!option?.wizardKey) return null;
    if (option.wizardKey === 'translate') return TranslateWizard;
    if (option.wizardKey === 'insert-figure') return InsertFigureWizard;
    return TodoWizard;
  })();

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
      {WizardComponent && activeWizard ? (
        <div className="border-b border-gray-800">
          <WizardComponent
            ctx={{ option: activeWizard.option, content, cursorPosition, scope: { kind: derivedScopeKind, text: derivedScopeText } }}
            onCancel={() => setActiveWizard(null)}
            onCloseAll={onClose}
            onPreview={onPreviewInlineEdit}
            onPreviewInsert={onPreviewInsertAtCursor}
            onApply={async (preview) => {
              await onApplyInlinePreview(preview);
              onClose();
            }}
          />
        </div>
      ) : (
        <>
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
              {/* Level 1: Groups */}
              {optionsLevel === 'groups' && (
                <div className="space-y-2">
                  <div className="px-1 text-[10px] tracking-wide uppercase text-gray-500">Choose a category</div>
                  <div className="grid grid-cols-2 gap-2">
                    {groupCounts.map(({ group, count }) => (
                      <button
                        key={group}
                        onClick={() => {
                          setSelectedGroup(group);
                          setOptionsLevel('options');
                          setOptionsQuery('');
                        }}
                        className="text-left px-2 py-2 rounded border border-gray-800 hover:border-gray-700 hover:bg-gray-800/40 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-200">{group}</span>
                          <span className="text-[10px] text-gray-400">{count}</span>
                        </div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Browse {group.toLowerCase()} actions</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Level 2: Options within selected group */}
              {optionsLevel === 'options' && selectedGroup && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOptionsLevel('groups');
                        setSelectedGroup(null);
                        setOptionsQuery('');
                      }}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-200"
                      title="Back"
                    >
                      <ChevronLeftIcon className="w-4 h-4" />
                      Back
                    </button>
                    <div className="text-xs text-gray-300">{selectedGroup}</div>
                    <div className="w-12" />
                  </div>

                  <input
                    value={optionsQuery}
                    onChange={(e) => setOptionsQuery(e.target.value)}
                    placeholder={`Search ${selectedGroup.toLowerCase()}…`}
                    className="w-full bg-gray-950 text-xs text-gray-200 placeholder-gray-500 border border-gray-700 rounded px-2 py-1 focus:outline-none focus:border-gray-600"
                  />

                  <div className="mt-2 max-h-56 overflow-auto space-y-3">
                    {subgrouped.map(([subgroup, options]) => (
                      <div key={subgroup}>
                        <div className="px-1 mb-1 text-[10px] tracking-wide uppercase text-gray-500">{subgroup}</div>
                        <div className="space-y-1">
                          {options.map((opt) => (
                            <button
                              key={opt.id}
                              onClick={() => handleQuickOption(opt)}
                              className="w-full text-left px-2 py-1 rounded border border-gray-800 hover:border-gray-700 hover:bg-gray-800/40 transition-colors"
                              title={opt.description}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-gray-200">{opt.label}</span>
                              </div>
                              {opt.description && (
                                <div className="text-[10px] text-gray-400 mt-0.5">{opt.description}</div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {filteredGroupOptions.length === 0 && (
                      <div className="text-xs text-gray-400 px-1">No matching actions.</div>
                    )}
                  </div>
                </div>
              )}

              {/* (Optional later) global search from groups level could go here */}
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
        </>
      )}
    </div>
  );
}
