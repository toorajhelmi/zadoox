'use client';

import { useMemo } from 'react';
import { irToXmd, parseXmdToIr } from '@zadoox/shared';
import { MarkdownPreview } from './markdown-preview';

interface IrPreviewProps {
  docId: string;
  content: string;
}

/**
 * IR preview for comparison.
 *
 * Phase 11 bridge: XMD -> IR -> XMD -> existing MarkdownPreview renderer.
 * This lets us compare parity without changing the main preview behavior.
 */
export function IrPreview({ docId, content }: IrPreviewProps) {
  const irXmd = useMemo(() => {
    if (!content.trim()) return '';
    const ir = parseXmdToIr({ docId, xmd: content });
    return irToXmd(ir);
  }, [docId, content]);

  return <MarkdownPreview content={irXmd} />;
}


