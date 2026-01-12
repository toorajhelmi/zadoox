'use client';

import { useMemo } from 'react';
import { renderIrToHtml, type DocumentNode } from '@zadoox/shared';
import { MarkdownPreview } from './markdown-preview';

interface IrPreviewProps {
  docId: string;
  content: string;
  ir?: DocumentNode | null;
}

/**
 * IR preview for comparison.
 *
 * Phase 12+: render IR directly to HTML (IR -> HTML).
 */
export function IrPreview({ docId, content, ir }: IrPreviewProps) {
  const htmlOverride = useMemo(() => {
    if (!content.trim()) return '';
    if (!ir) return '';
    const html = renderIrToHtml(ir);
    return html;
  }, [content, ir]);

  return <MarkdownPreview content={content} htmlOverride={htmlOverride} />;
}


