'use client';

import { useState, useEffect, useRef } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

interface InlineAIHintProps {
  position: { top: number; left: number };
  visible: boolean;
  onActivate: () => void;
}

export function InlineAIHint({ position, visible, onActivate }: InlineAIHintProps) {
  const [fadeIn, setFadeIn] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const hintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible) {
      // Small delay for fade-in effect
      timeoutRef.current = setTimeout(() => {
        setFadeIn(true);
      }, 100);
    } else {
      setFadeIn(false);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={hintRef}
      className={`fixed z-40 transition-opacity duration-200 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <button
        onClick={onActivate}
        onMouseEnter={() => setFadeIn(true)}
        className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600/50 rounded text-xs text-gray-400 hover:text-gray-300 transition-all backdrop-blur-sm"
      >
        <SparklesIcon className="w-3 h-3" />
        <span>Press <kbd className="px-1 py-0.5 bg-gray-700/50 rounded text-[10px] font-mono">⌘K</kbd> to chat</span>
      </button>
    </div>
  );
}

