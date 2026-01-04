import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import type { DocumentNode } from '@zadoox/shared';
import { irToLatexDocument, irToXmd, parseLatexToIr, parseXmdToIr } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

export type EditMode = 'markdown' | 'latex';

export type EditorDocMetadata = {
  lastEditedFormat?: EditMode;
  latex?: string;
  latexIrHash?: string | null;
} & Record<string, unknown>;

export function useEditorEditMode(params: {
  actualDocumentId: string | undefined;
  documentId: string;
  content: string;
  ir: DocumentNode | null;
  documentMetadata: EditorDocMetadata;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<EditorDocMetadata>>;
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

    const meta = documentMetadata;
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
        if (ir) setLatexDraft(irToLatexDocument(ir));
      } catch {
        // ignore
      }
    }
  }, [actualDocumentId, documentId, documentMetadata, editMode, ir, latexDraft]);

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
        const meta = documentMetadata;

        const switchImpl: Record<EditMode, () => Promise<void>> = {
          latex: async () => {
            const cachedLatex = typeof meta.latex === 'string' ? meta.latex : '';
            const cachedLatexIrHash = typeof meta.latexIrHash === 'string' ? meta.latexIrHash : null;
            const canReuse = Boolean(currentIrHash && cachedLatex && cachedLatexIrHash === currentIrHash);

            const latexBase = canReuse ? cachedLatex : irToLatexDocument(currentIr);
            const ensured = ensureLatexPreambleForLatexContent(latexBase);
            const latex = ensured.latex;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'switch-churn',hypothesisId:'H17',location:'editor-layout-edit-mode.ts:handleEditModeChange',message:'Switch to LaTeX ensured preamble packages',data:{currentIrHash,canReuse,addedPackages:ensured.added,latexLen:String(latex??'').length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log

            setLatexDraft(latex);
            setEditMode('latex');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = { ...meta, latex, latexIrHash: currentIrHash, lastEditedFormat: 'latex' as const };
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
              }

              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'switch-churn',hypothesisId:'H16',location:'editor-layout-edit-mode.ts:handleEditModeChange',message:'Switch to Markdown using IR hash cache',data:{currentIrHash,latexDraftLen,latexIsDerived,cachedLatexLen:String(cachedLatex??'').length,xmdLen:String(nextContent??'').length,assetRefs:(String(nextContent??'').split('zadoox-asset://').length-1),hasGridHeader:String(nextContent??'').includes('::: cols=')},timestamp:Date.now()})}).catch(()=>{});
              // #endregion agent log
            } catch {
              // If conversion fails, keep the last known XMD content (never block switching).
            }

            setEditMode('markdown');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = { ...meta, latex: latexDraft, lastEditedFormat: 'markdown' as const };
            setDocumentMetadata(nextMeta);

            const contentChanged = nextContent !== content;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/7204edcf-b69f-4375-b0dd-9edf2b67f01a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'switch-churn',hypothesisId:'H15',location:'editor-layout-edit-mode.ts:handleEditModeChange',message:'Switch LaTeX->Markdown apply content',data:{contentChanged,prevLen:String(content??'').length,nextLen:String(nextContent??'').length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion agent log

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


