import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { DocumentNode } from '@zadoox/shared';
import { irToLatexDocument, irToXmd } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

export type EditMode = 'markdown' | 'latex';

export type EditorDocMetadata = {
  lastEditedFormat?: EditMode;
  latex?: string;
  latexIrHash?: string;
  xmdIrHash?: string;
} & Record<string, any>;

export function useEditorEditMode(params: {
  actualDocumentId: string | undefined;
  documentId: string;
  content: string;
  getCurrentIr: () => DocumentNode | null;
  documentMetadata: EditorDocMetadata | undefined;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  updateContent: (next: string) => void;
}) {
  const { actualDocumentId, documentId, content, getCurrentIr, documentMetadata, setDocumentMetadata, updateContent } = params;

  const [editMode, setEditMode] = useState<EditMode>('markdown');
  const [latexDraft, setLatexDraft] = useState<string>('');

  // Important: only initialize editMode from metadata once per document.
  // Otherwise, late metadata refreshes can overwrite explicit user selection
  // (e.g. user clicks "MD" then a stale lastEditedFormat="latex" update flips it back).
  const lastDocKeyRef = useRef<string | null>(null);
  const didInitModeRef = useRef<boolean>(false);

  // Initialize edit mode / cached latex from metadata.
  useEffect(() => {
    const docKey = actualDocumentId || documentId;
    if (lastDocKeyRef.current !== docKey) {
      lastDocKeyRef.current = docKey;
      didInitModeRef.current = false;
    }

    const meta: EditorDocMetadata = documentMetadata ?? {};
    const last = meta.lastEditedFormat;
    const latex = meta.latex;
    if (!didInitModeRef.current && (last === 'latex' || last === 'markdown')) {
      setEditMode(last);
      didInitModeRef.current = true;
    }
    if (typeof latex === 'string') {
      // Avoid overwriting while the user is actively typing in LaTeX (prevents cursor/scroll reset).
      // The LaTeX draft is treated as the persisted editing surface when lastEditedFormat === 'latex'.
      const shouldAdopt = latexDraft.length === 0 || editMode !== 'latex';
      if (shouldAdopt) setLatexDraft(latex);
    } else if (last === 'latex' && !latexDraft) {
      // If last mode is LaTeX but we have no cached latex yet, derive it from IR/XMD.
      try {
        const currentIr = getCurrentIr();
        if (currentIr) setLatexDraft(irToLatexDocument(currentIr));
      } catch {
        // ignore
      }
    }
  }, [actualDocumentId, documentId, documentMetadata, editMode, getCurrentIr, latexDraft]);

  const handleEditModeChange = useCallback(
    async (next: EditMode) => {
      if (next === editMode) return;
      if (!actualDocumentId) {
        setEditMode(next);
        didInitModeRef.current = true;
        return;
      }

      try {
        const currentIr = getCurrentIr();
        if (!currentIr) {
          setEditMode(next);
          didInitModeRef.current = true;
          return;
        }
        const currentIrHash = computeDocIrHash(currentIr);
        const meta: EditorDocMetadata = documentMetadata ?? {};

        const switchImpl: Record<EditMode, () => Promise<void>> = {
          latex: async () => {
            const cachedLatex = typeof meta.latex === 'string' ? meta.latex : '';
            const cachedLatexIrHash = typeof meta.latexIrHash === 'string' ? meta.latexIrHash : null;
            const canReuse = Boolean(currentIrHash && cachedLatex && cachedLatexIrHash === currentIrHash);

            const latexBase = canReuse ? cachedLatex : irToLatexDocument(currentIr);
            const ensured = ensureLatexPreambleForLatexContent(latexBase);
            const latex = ensured.latex;
            setLatexDraft(latex);
            setEditMode('latex');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = {
              ...meta,
              latex,
              ...(currentIrHash ? { latexIrHash: currentIrHash, xmdIrHash: currentIrHash } : null),
              lastEditedFormat: 'latex' as const,
            };
            setDocumentMetadata(nextMeta);
            await api.documents.update(actualDocumentId, {
              content,
              metadata: nextMeta,
              changeType: 'manual-save',
              changeDescription: 'Switched editor to LaTeX',
            });
          },

          markdown: async () => {
            // Fast-path reuse: if we have matching hashes and the LaTeX draft wasn't changed,
            // do not regenerate XMD (avoids lossy roundtrip for grids/tables).
            const cachedLatex = typeof meta.latex === 'string' ? meta.latex : '';
            const cachedLatexIrHash = typeof meta.latexIrHash === 'string' ? meta.latexIrHash : null;
            const cachedXmdIrHash = typeof meta.xmdIrHash === 'string' ? meta.xmdIrHash : null;
            const latexUnchanged = cachedLatex && cachedLatex === latexDraft;
            const hashesMatch = cachedLatexIrHash && cachedXmdIrHash && cachedLatexIrHash === cachedXmdIrHash;
            if (latexUnchanged && hashesMatch) {
              setEditMode('markdown');
              didInitModeRef.current = true;
              const nextMeta: EditorDocMetadata = {
                ...meta,
                lastEditedFormat: 'markdown' as const,
              };
              setDocumentMetadata(nextMeta);
              await api.documents.update(actualDocumentId, {
                content,
                metadata: nextMeta,
                changeType: 'manual-save',
                changeDescription: 'Switched editor to Markdown',
              });
              return;
            }

            // Canonical IR is always kept up to date while editing. Switching modes should never parse;
            // it only serializes the current canonical IR.
            const nextIrHash = currentIrHash || null;
            const canReuseXmd = Boolean(nextIrHash && cachedXmdIrHash && cachedXmdIrHash === nextIrHash);
            const nextContent = canReuseXmd ? content : irToXmd(currentIr);

            setEditMode('markdown');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = {
              ...meta,
              latex: latexDraft,
              ...(nextIrHash ? { xmdIrHash: nextIrHash, latexIrHash: nextIrHash } : null),
              lastEditedFormat: 'markdown' as const,
            };
            setDocumentMetadata(nextMeta);

            const contentChanged = !canReuseXmd && nextContent !== content;

            if (contentChanged) updateContent(nextContent);
            await api.documents.update(actualDocumentId, {
              content: contentChanged ? nextContent : content,
              metadata: nextMeta,
              changeType: 'manual-save',
              changeDescription: 'Switched editor to Markdown',
            });
          },
        };

        await switchImpl[next]();
      } catch (e) {
        console.error('Failed to switch edit mode:', e);
        setEditMode(next);
        didInitModeRef.current = true;
      }
    },
    [actualDocumentId, content, documentMetadata, editMode, getCurrentIr, latexDraft, setDocumentMetadata, updateContent]
  );

  return { editMode, setEditMode, latexDraft, setLatexDraft, handleEditModeChange };
}


