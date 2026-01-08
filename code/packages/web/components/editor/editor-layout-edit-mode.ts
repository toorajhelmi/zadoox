import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { DocumentNode } from '@zadoox/shared';
import { irToLatexDocument, irToXmd, parseLatexToIr, parseXmdToIr } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

export type EditMode = 'markdown' | 'latex';

// Bump this whenever the IR->LaTeX generator changes in a way that requires regenerating cached LaTeX
// even if the IR hash is unchanged.
const LATEX_GEN_VERSION = 'v4_disable_wrapfigure_generation';

export type EditorDocMetadata = {
  lastEditedFormat?: EditMode;
  latex?: string;
  latexIrHash?: string;
  xmdIrHash?: string;
  latexGenVersion?: string;
} & Record<string, any>;

export function useEditorEditMode(params: {
  actualDocumentId: string | undefined;
  documentId: string;
  content: string;
  ir: DocumentNode | null;
  documentMetadata: EditorDocMetadata | undefined;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  updateContent: (next: string) => void;
}) {
  const { actualDocumentId, documentId, content, ir, documentMetadata, setDocumentMetadata, updateContent } = params;

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
    const cachedGenVersion = typeof meta.latexGenVersion === 'string' ? meta.latexGenVersion : '';
    const cachedLatex = typeof latex === 'string' ? latex : '';
    if (!didInitModeRef.current && (last === 'latex' || last === 'markdown')) {
      setEditMode(last);
      didInitModeRef.current = true;
    }
    // If last mode is LaTeX but generator has changed, auto-regenerate + persist so publish compiles
    // the same LaTeX the user is seeing (no manual toggle required).
    // Auto-upgrade only when we detect stale generator artifacts (e.g. old wrapfigure output),
    // so we don't overwrite user-authored LaTeX drafts.
    const needsUpgrade =
      last === 'latex' &&
      cachedGenVersion !== LATEX_GEN_VERSION &&
      (cachedLatex.includes('\\begin{wrapfigure}') || cachedLatex.includes('\\usepackage{wrapfig}'));
    if (needsUpgrade && actualDocumentId && actualDocumentId !== 'default') {
      let upgraded = false;
      try {
        const currentIr = ir ?? parseXmdToIr({ docId: actualDocumentId, xmd: content });
        const currentIrHash = computeDocIrHash(currentIr);
        const latexBase = irToLatexDocument(currentIr);
        const ensured = ensureLatexPreambleForLatexContent(latexBase);
        const nextLatex = ensured.latex;
        setLatexDraft(nextLatex);
        const nextMeta: EditorDocMetadata = {
          ...meta,
          latex: nextLatex,
          ...(currentIrHash ? { latexIrHash: currentIrHash, xmdIrHash: currentIrHash } : null),
          latexGenVersion: LATEX_GEN_VERSION,
          lastEditedFormat: 'latex' as const,
        };
        setDocumentMetadata(nextMeta);
        upgraded = true;
        // Best-effort persist; never block rendering.
        void api.documents
          .update(actualDocumentId, {
            content,
            metadata: nextMeta,
            changeType: 'auto-save',
            changeDescription: 'Auto-upgraded generated LaTeX',
          })
          .catch(() => {});
      } catch {
        // If upgrade fails, fall back to existing cached LaTeX below.
      }
      if (upgraded) return;
    }

    if (typeof latex === 'string') {
      // Avoid overwriting while the user is actively typing in LaTeX (prevents cursor/scroll reset).
      // The LaTeX draft is treated as the persisted editing surface when lastEditedFormat === 'latex'.
      const shouldAdopt = latexDraft.length === 0 || editMode !== 'latex';
      if (shouldAdopt) setLatexDraft(latex);
    } else if (last === 'latex' && !latexDraft) {
      // If last mode is LaTeX but we have no cached latex yet, derive it from IR/XMD.
      try {
        if (ir) setLatexDraft(irToLatexDocument(ir));
      } catch {
        // ignore
      }
    }
  }, [actualDocumentId, content, documentId, documentMetadata, editMode, ir, latexDraft, setDocumentMetadata]);

  const handleEditModeChange = useCallback(
    async (next: EditMode) => {
      if (next === editMode) return;
      if (!actualDocumentId || actualDocumentId === 'default') {
        setEditMode(next);
        didInitModeRef.current = true;
        return;
      }

      try {
        const currentIr = ir ?? parseXmdToIr({ docId: actualDocumentId, xmd: content });
        const currentIrHash = computeDocIrHash(currentIr);
        const meta: EditorDocMetadata = documentMetadata ?? {};

        const switchImpl: Record<EditMode, () => Promise<void>> = {
          latex: async () => {
            const cachedLatex = typeof meta.latex === 'string' ? meta.latex : '';
            const cachedLatexIrHash = typeof meta.latexIrHash === 'string' ? meta.latexIrHash : null;
            const cachedGenVersion = typeof meta.latexGenVersion === 'string' ? meta.latexGenVersion : '';
            const canReuse = Boolean(
              currentIrHash &&
                cachedLatex &&
                cachedLatexIrHash === currentIrHash &&
                cachedGenVersion === LATEX_GEN_VERSION
            );

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
              latexGenVersion: LATEX_GEN_VERSION,
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
            let nextContent = content;
            let nextIrHash: string | null = currentIrHash;
            try {
              const cachedLatexIrHash = typeof meta.latexIrHash === 'string' ? meta.latexIrHash : null;
              const cachedLatex = typeof meta.latex === 'string' ? meta.latex : '';
              const latexDraftLen = String(latexDraft ?? '').length;

              const latexIsDerived =
                Boolean(currentIrHash && cachedLatexIrHash && cachedLatexIrHash === currentIrHash) &&
                Boolean(cachedLatex) &&
                String(latexDraft ?? '') === cachedLatex;

              if (latexIsDerived) {
                nextContent = irToXmd(currentIr);
              } else {
                const nextIr = parseLatexToIr({ docId: actualDocumentId, latex: latexDraft });
                nextContent = irToXmd(nextIr);
                nextIrHash = computeDocIrHash(nextIr);
              }

            } catch {
              // If conversion fails, keep the last known XMD content (never block switching).
            }

            setEditMode('markdown');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = {
              ...meta,
              latex: latexDraft,
              ...(nextIrHash ? { xmdIrHash: nextIrHash } : null),
              lastEditedFormat: 'markdown' as const,
            };
            setDocumentMetadata(nextMeta);

            const contentChanged = nextContent !== content;

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
    [actualDocumentId, content, documentMetadata, editMode, ir, latexDraft, setDocumentMetadata, updateContent]
  );

  return { editMode, setEditMode, latexDraft, setLatexDraft, handleEditModeChange };
}


