'use client';

import { useCallback, useRef, useState } from 'react';
import { MicIcon, ArrowRightIcon } from '@/components/icons';

export function RightAiChatPanel(props: {
  isOpen: boolean;
  isFullAI: boolean;
  onOpen: () => void;
  onClose: () => void;
  inputRef?: React.MutableRefObject<HTMLTextAreaElement | null>;
}) {
  const { isOpen, isFullAI, onOpen, onClose, inputRef } = props;

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(() => {
    const msg = inputValue.trim();
    if (!msg || sending) return;
    setSending(true);
    setInputValue('');

    // Reset textarea height after sending (matches Think panel chat UX)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // TODO: wire to real chat backend; for now, just stop "sending" immediately.
    setTimeout(() => setSending(false), 150);
  }, [inputValue, sending]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`absolute right-2 bottom-3 px-3 py-2 rounded border border-vscode-border text-xs transition-colors ${
          isFullAI
            ? 'bg-[#a855f7]/10 hover:bg-[#a855f7]/20 text-[#e9d5ff]'
            : 'bg-[#007acc]/10 hover:bg-[#007acc]/20 text-[#bfe3ff]'
        }`}
        title="Open AI chat"
      >
        {isFullAI ? 'Open Full‑AI' : 'Open AI chat'}
      </button>
    );
  }

  return (
    <div className="w-[360px] min-w-[320px] max-w-[420px] h-full border-l border-vscode-border bg-vscode-sidebar flex flex-col">
      <div
        className={`px-3 py-2 border-b border-vscode-border flex items-center justify-between ${
          isFullAI ? 'bg-[#a855f7]/10' : 'bg-[#007acc]/10'
        }`}
      >
        <div className="text-xs font-mono text-vscode-text-secondary">{isFullAI ? 'FULL‑AI' : 'AI‑ASSIST'}</div>
        <button
          type="button"
          className="text-xs text-vscode-text-secondary hover:text-vscode-text transition-colors"
          onClick={onClose}
        >
          Hide
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 text-sm text-vscode-text-secondary">
        {isFullAI ? (
          <div className="text-vscode-text">
            Guided chat will appear here. Tell Zadoox what you’re creating and we’ll produce the first draft.
          </div>
        ) : (
          <div>Open chat to ask for help, generate structure, or draft content.</div>
        )}
      </div>

      {/* Input Area - same command-bar style as Think panel chat */}
      <div className="p-3 border-t border-vscode-border">
        <div className="rounded-lg bg-black border border-gray-800">
          <div className="px-4 pt-4 pb-3">
            <textarea
              ref={(el) => {
                textareaRef.current = el;
                if (inputRef) inputRef.current = el;
              }}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize textarea
                const textarea = e.target;
                textarea.style.height = 'auto';
                textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={isFullAI ? 'Describe what you want to write…' : 'Ask anything…'}
              rows={1}
              className="w-full text-xs bg-transparent text-gray-200 placeholder-gray-500 focus:outline-none resize-none overflow-y-auto"
              disabled={sending}
              style={{ minHeight: '20px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-center justify-between px-4 pb-3 pt-2 border-t border-gray-900">
            <div className="flex items-center gap-3" />
            <div className="flex items-center gap-2">
              {sending && (
                <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              )}
              <button
                type="button"
                onClick={handleSend}
                disabled={sending}
                className={`p-1.5 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
                  inputValue.trim()
                    ? isFullAI
                      ? 'bg-[#a855f7] hover:bg-[#9333ea] text-white'
                      : 'bg-vscode-blue hover:bg-blue-600 text-white'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
                title={inputValue.trim() ? 'Send message' : 'Start conversation'}
              >
                {inputValue.trim() ? <ArrowRightIcon className="w-4 h-4" /> : <MicIcon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


