import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { irToLatexDocument, irToXmd, parseLatexToIr, parseXmdToIr } from '@zadoox/shared';

type EditFormat = 'markdown' | 'latex';

export function useEditorEditFormat(params: {
  actualDocumentId: string | undefined;
  documentId: string;
  content: string;
  ir: any | null;
  documentMetadata: any;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<any>>;
  updateContent: (next: string) => void;
}) {
  const { actualDocumentId, documentId, content, ir, documentMetadata, setDocumentMetadata, updateContent } = params;

  const [editFormat, setEditFormat] = useState<EditFormat>('markdown');
  const [latexDraft, setLatexDraft] = useState<string>('');

  // Initialize edit format / cached latex from metadata (Phase 12).
  useEffect(() => {
    const last = (documentMetadata as any)?.lastEditedFormat as EditFormat | undefined;
    const latex = (documentMetadata as any)?.latex as string | undefined;
    if (last === 'latex' || last === 'markdown') {
      setEditFormat(last);
    }
    if (typeof latex === 'string') {
      // Avoid overwriting while the user is actively typing in LaTeX (prevents cursor/scroll reset).
      // We intentionally do NOT regenerate LaTeX from IR here; the LaTeX draft is treated as the
      // persisted editing surface when lastEditedFormat === 'latex'.
      const shouldAdopt = latexDraft.length === 0 || editFormat !== 'latex';
      if (shouldAdopt) setLatexDraft(latex);
    } else if (last === 'latex' && !latexDraft) {
      // If last format is LaTeX but we have no cached latex yet, derive it from IR/XMD.
      try {
        if (ir) setLatexDraft(irToLatexDocument(ir));
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualDocumentId, (documentMetadata as any)?.lastEditedFormat, (documentMetadata as any)?.latex]);

  const handleEditFormatChange = useCallback(
    async (next: EditFormat) => {
      if (next === editFormat) return;
      if (!actualDocumentId || actualDocumentId === 'default') {
        setEditFormat(next);
        return;
      }

      try {
        if (next === 'latex') {
          const nextIr = ir ?? parseXmdToIr({ docId: actualDocumentId, xmd: content });
          const latex = irToLatexDocument(nextIr);
          setLatexDraft(latex);
          setEditFormat('latex');
          const nextMeta = { ...(documentMetadata as any), latex, lastEditedFormat: 'latex' as const };
          setDocumentMetadata(nextMeta);
          await api.documents.update(actualDocumentId, {
            content,
            metadata: nextMeta,
            changeType: 'manual-save',
            changeDescription: 'Switched editor to LaTeX',
          });
          return;
        }

        // next === 'markdown'
        // When leaving LaTeX mode, re-derive XMD from the current LaTeX draft so any LaTeX-only
        // boilerplate (e.g. \end{document}) cannot leak into the Markdown surface.
        let nextContent = content;
        try {
          const nextIr = parseLatexToIr({ docId: actualDocumentId, latex: latexDraft });
          nextContent = irToXmd(nextIr);
          updateContent(nextContent);
        } catch {
          // If conversion fails, keep the last known XMD content (never block switching).
        }

        setEditFormat('markdown');
        const nextMeta = { ...(documentMetadata as any), latex: latexDraft, lastEditedFormat: 'markdown' as const };
        setDocumentMetadata(nextMeta);
        await api.documents.update(actualDocumentId, {
          content: nextContent,
          metadata: nextMeta,
          changeType: 'manual-save',
          changeDescription: 'Switched editor to Markdown',
        });
      } catch (e) {
        console.error('Failed to switch edit format:', e);
        setEditFormat(next);
      }
    },
    [actualDocumentId, content, documentMetadata, editFormat, ir, latexDraft, setDocumentMetadata, updateContent]
  );

  return { editFormat, setEditFormat, latexDraft, setLatexDraft, handleEditFormatChange };
}


