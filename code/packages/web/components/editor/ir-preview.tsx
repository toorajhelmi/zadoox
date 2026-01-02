'use client';

import { useMemo } from 'react';
import { irToXmd, parseXmdToIr, type DocumentNode } from '@zadoox/shared';
import { MarkdownPreview } from './markdown-preview';

interface IrPreviewProps {
  docId: string;
  content: string;
  ir?: DocumentNode | null;
}

/**
 * IR preview for comparison.
 *
 * Phase 11 bridge: XMD -> IR -> XMD -> existing MarkdownPreview renderer.
 * This lets us compare parity without changing the main preview behavior.
 */
export function IrPreview({ docId, content, ir }: IrPreviewProps) {
  const irXmd = useMemo(() => {
    if (!content.trim()) return '';
    if (ir) {
      return irToXmd(ir);
    }
    const derived = parseXmdToIr({ docId, xmd: content });
    return irToXmd(derived);
  }, [docId, content, ir]);

  return <MarkdownPreview content={irXmd} />;
}


