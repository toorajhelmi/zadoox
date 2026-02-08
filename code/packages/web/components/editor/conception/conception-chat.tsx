'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConceptionState } from '@zadoox/shared';

export function ConceptionChat(props: {
  conception: ConceptionState;
  onDeleteFromTurn?: (turnId: string) => void;
}) {
  const { conception, onDeleteFromTurn } = props;
  const endRef = useRef<HTMLDivElement | null>(null);

  const turns = conception.turns ?? [];
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [turns.length]);

  // Intro typing effect (UI-only; not persisted into conception.turns).
  const [introChars, setIntroChars] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const introTimeoutRef = useRef<number | null>(null);
  const introIntervalRef = useRef<number | null>(null);
  const introText =
    "Hi — I’m Z. What do you want to write about? Start rough: a topic, a question, or a goal. I’ll grow an idea graph as you talk.";

  useEffect(() => {
    const clearTimers = () => {
      if (introTimeoutRef.current) {
        window.clearTimeout(introTimeoutRef.current);
        introTimeoutRef.current = null;
      }
      if (introIntervalRef.current) {
        window.clearInterval(introIntervalRef.current);
        introIntervalRef.current = null;
      }
    };

    if ((turns?.length ?? 0) > 0) {
      clearTimers();
      setIntroDone(true);
      return;
    }

    // Empty chat: restart intro safely (React strict-mode mounts/unmounts effects in dev).
    clearTimers();
    setIntroDone(false);
    setIntroChars(0);

    introTimeoutRef.current = window.setTimeout(() => {
      let i = 0;
      introIntervalRef.current = window.setInterval(() => {
        i++;
        setIntroChars(i);
        if (i >= introText.length) {
          clearTimers();
          setIntroDone(true);
        }
      }, 18);
    }, 500);

    return () => {
      clearTimers();
    };
  }, [turns.length, introText]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto space-y-3">
        {turns.length === 0 ? (
          <div className="p-2 rounded border border-[#3e3e42] bg-[#1e1e1e]">
            <div className="text-[10px] font-mono uppercase text-[#969696] mb-1">
              <span className="font-serif italic tracking-wide text-[#e9d5ff]">Z</span>
              {!introDone ? (
                <span className="ml-2 text-[#969696] normal-case font-sans">
                  <span className="inline-flex items-center gap-1">
                    <span>typing</span>
                    <span className="inline-block w-1 h-1 rounded-full bg-[#969696] animate-pulse" />
                    <span className="inline-block w-1 h-1 rounded-full bg-[#969696] animate-pulse [animation-delay:120ms]" />
                    <span className="inline-block w-1 h-1 rounded-full bg-[#969696] animate-pulse [animation-delay:240ms]" />
                  </span>
                </span>
              ) : null}
            </div>
            <div className="text-sm text-[#e5e5e5] whitespace-pre-wrap">
              {introText.slice(0, introDone ? introText.length : introChars)}
            </div>
          </div>
        ) : null}

        {turns.map((t) => (
          <div key={t.id} className={`p-2 rounded border ${t.role === 'user' ? 'border-[#a855f7]/30 bg-[#a855f7]/10' : 'border-[#3e3e42] bg-[#1e1e1e]'}`}>
            <div className="text-[10px] font-mono uppercase text-[#969696] mb-1 flex items-center justify-between gap-2">
              <div>
                {t.role === 'assistant' ? (
                  <span className="font-serif italic tracking-wide text-[#e9d5ff]">Z</span>
                ) : (
                  <span className="text-[#cccccc]">You</span>
                )}
              </div>
              {onDeleteFromTurn ? (
                <button
                  type="button"
                  className="text-[#9aa0a6] hover:text-[#ffb4b4] transition-colors"
                  title="Delete this message and everything after it"
                  aria-label="Delete this message and everything after it"
                  onClick={() => onDeleteFromTurn(t.id)}
                >
                  🗑
                </button>
              ) : null}
            </div>
            <div className="text-sm text-[#e5e5e5] whitespace-pre-wrap">{t.content}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}


