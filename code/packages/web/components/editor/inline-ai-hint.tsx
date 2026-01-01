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

  const hintRef = useRef<HTMLDivElement>(null);

  // Hide hint when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (hintRef.current && !hintRef.current.contains(e.target as Node)) {
        // Don't close on click outside - let it fade naturally or when cursor moves
        // This prevents the hint from disappearing when user clicks in the editor
      }
    };
    
    if (visible) {
      // We don't close on click outside for the hint, but we could add this if needed
      // document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      // document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visible]);

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

