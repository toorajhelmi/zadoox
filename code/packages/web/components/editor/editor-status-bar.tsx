'use client';

import { formatDistanceToNow } from 'date-fns';
import { useMemo } from 'react';
import type { AIAnalysisResponse } from '@zadoox/shared';

interface EditorStatusBarProps {
  isSaving: boolean;
  lastSaved: Date | null;
  content?: string;
  docAI?: {
    metrics: Record<string, number> | null;
    analyzedSections: number;
    isAnalyzing: boolean;
  };
}

function abbreviateMetricKey(key: string): string {
  const known: Record<string, string> = {
    quality: 'Q',
    clarity: 'C',
    wordiness: 'W',
  };
  if (known[key]) return known[key];

  const parts = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter(Boolean);
  if (parts.length === 0) return key.slice(0, 2).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((p) => p[0]).join('').slice(0, 3).toUpperCase();
}

function formatMetrics(metrics: Record<string, number>): string {
  const keys = Object.keys(metrics);
  const preferred = ['quality', 'clarity', 'wordiness'];
  keys.sort((a, b) => {
    const ia = preferred.indexOf(a);
    const ib = preferred.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    return a.localeCompare(b);
  });

  return keys.map((k) => `${abbreviateMetricKey(k)}${Math.round(metrics[k])}`).join(' ');
}

/**
 * Editor Status Bar
 * VS Code-style status bar at the bottom of the editor
 */
export function EditorStatusBar({
  isSaving,
  lastSaved,
  content = '',
  docAI,
}: EditorStatusBarProps) {
  // Calculate document stats from content
  const stats = useMemo(() => {
    const words = content.trim() ? content.trim().split(/\s+/).filter(w => w.length > 0) : [];
    const wordCount = words.length;
    const characterCount = content.length;
    return { wordCount, characterCount };
  }, [content]);

  const aiText = useMemo(() => {
    if (!docAI) return null;
    if (docAI.isAnalyzing && !docAI.metrics) return 'AI: …';
    if (!docAI.metrics) return null;
    const s = formatMetrics(docAI.metrics);
    if (!s) return null;
    return `AI: ${s}`;
  }, [docAI]);

  return (
    <div className="h-6 bg-vscode-statusBar-background border-t border-vscode-statusBar-border flex items-center justify-between px-2 text-xs text-vscode-statusBar-foreground">
      {/* Left side - Status and info */}
      <div className="flex items-center gap-4">
        {/* Save status */}
        {isSaving && (
          <span className="text-vscode-statusBar-foreground">
            Saving...
          </span>
        )}
        {!isSaving && lastSaved && (
          <span className="text-vscode-statusBar-foreground">
            Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
          </span>
        )}
        {!isSaving && !lastSaved && (
          <span className="text-vscode-statusBar-foreground">
            Not saved
          </span>
        )}
      </div>

      {/* Right side - AI + Document stats */}
      <div className="flex items-center gap-4">
        {aiText && (
          <span className="text-vscode-statusBar-foreground truncate max-w-[50vw]" title={aiText}>
            {aiText}
          </span>
        )}
        <span className="text-vscode-statusBar-foreground">
          {stats.wordCount} {stats.wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>
    </div>
  );
}

