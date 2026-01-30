import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';
import type { DocumentNode } from '@zadoox/shared';
import { irToLatexDocument, irToXmd } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
import { ensureLatexPreambleForLatexContent } from './latex-preamble';

export type EditMode = 'markdown' | 'latex';

function isLatexManifest(v: unknown): v is { bucket?: string; basePrefix?: string; entryPath?: string } {
  if (!v || typeof v !== 'object') return false;
  const o = v as any;
  return typeof o.basePrefix === 'string' && typeof o.entryPath === 'string';
}

export type EditorDocMetadata = {
  lastEditedFormat?: EditMode;
  xmdIrHash?: string;
} & Record<string, any>;

export function useEditorEditMode(params: {
  actualDocumentId: string | undefined;
  documentId: string;
  content: string;
  getCurrentIr: () => DocumentNode | null;
  documentMetadata: EditorDocMetadata | undefined;
  documentLatex: any | null | undefined;
  setDocumentLatex: React.Dispatch<React.SetStateAction<any | null>>;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  updateContent: (next: string) => void;
}) {
  const { actualDocumentId, documentId, content, getCurrentIr, documentMetadata, documentLatex, setDocumentLatex, setDocumentMetadata, updateContent } = params;

  const [editMode, setEditMode] = useState<EditMode>('markdown');
  const [latexDraft, setLatexDraft] = useState<string>('');
  const [latexEntryLoading, setLatexEntryLoading] = useState(false);
  const [latexEntryError, setLatexEntryError] = useState<string | null>(null);
  const [latexEntryReloadNonce, setLatexEntryReloadNonce] = useState(0);

  // Important: only initialize editMode from metadata once per document.
  // Otherwise, late metadata refreshes can overwrite explicit user selection
  // (e.g. user clicks "MD" then a stale lastEditedFormat="latex" update flips it back).
  const lastDocKeyRef = useRef<string | null>(null);
  const didInitModeRef = useRef<boolean>(false);

  // Initialize edit mode from metadata.
  useEffect(() => {
    const docKey = actualDocumentId || documentId;
    if (lastDocKeyRef.current !== docKey) {
      lastDocKeyRef.current = docKey;
      didInitModeRef.current = false;
    }

    const meta: EditorDocMetadata = documentMetadata ?? {};
    const last = meta.lastEditedFormat;
    if (!didInitModeRef.current && (last === 'latex' || last === 'markdown')) {
      setEditMode(last);
      didInitModeRef.current = true;
    }
    // Fallback: imported docs can be LaTeX-first (manifest exists) while XMD content is empty.
    // If metadata doesn't specify a mode yet, prefer LaTeX when a manifest exists.
    if (!didInitModeRef.current && !last && documentLatex) {
      setEditMode('latex');
      didInitModeRef.current = true;
    }
  }, [actualDocumentId, documentId, documentMetadata, documentLatex]);

  // If we have a LaTeX manifest, load the entry file via backend.
  useEffect(() => {
    const docId = actualDocumentId || null;
    if (!docId) return;
    if (!documentLatex) return;
    const shouldLoad = latexDraft.length === 0 || editMode !== 'latex';
    if (!shouldLoad) return;

    let cancelled = false;
    (async () => {
      try {
        setLatexEntryLoading(true);
        setLatexEntryError(null);
        const res = await api.documents.latexEntryGet(docId);
        if (cancelled) return;
        if (typeof res.text === 'string') setLatexDraft(res.text);
      } catch (e) {
        const baseMsg = e instanceof Error ? e.message : String(e);
        const details =
          e instanceof ApiError && e.details
            ? (() => {
                try {
                  const s = JSON.stringify(e.details);
                  return s.length > 900 ? `${s.slice(0, 900)}…` : s;
                } catch {
                  return null;
                }
              })()
            : null;
        const msg = details ? `${baseMsg}\n\n${details}` : baseMsg;
        console.error('Failed to load LaTeX entry:', e);
        if (!cancelled) setLatexEntryError(msg);
      } finally {
        if (!cancelled) setLatexEntryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actualDocumentId, documentLatex, editMode, latexDraft, latexEntryReloadNonce]);

  const reloadLatexEntry = useCallback(() => {
    setLatexEntryReloadNonce((v) => v + 1);
  }, []);

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
            // Storage-backed LaTeX: if we have a manifest, load entry; else derive from IR and create it.
            let latexBase = latexDraft;
            if (!latexBase) {
              if (documentLatex) {
                const res = await api.documents.latexEntryGet(actualDocumentId);
                latexBase = res.text || '';
              } else {
                latexBase = irToLatexDocument(currentIr);
              }
            }
            const ensured = ensureLatexPreambleForLatexContent(latexBase);
            const latex = ensured.latex;
            setLatexDraft(latex);
            setEditMode('latex');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = {
              ...meta,
              ...(currentIrHash ? { xmdIrHash: currentIrHash } : null),
              lastEditedFormat: 'latex' as const,
            };
            setDocumentMetadata(nextMeta);
            // Persist LaTeX entry via backend (which also creates/updates the manifest in documents.latex).
            const put = await api.documents.latexEntryPut(actualDocumentId, { text: latex });
            setDocumentLatex(put.latex);
            await api.documents.update(actualDocumentId, {
              content,
              metadata: nextMeta,
              latex: put.latex,
              changeType: 'manual-save',
              changeDescription: 'Switched editor to LaTeX',
            });
          },

          markdown: async () => {
            const cachedXmdIrHash = typeof meta.xmdIrHash === 'string' ? meta.xmdIrHash : null;
            // Canonical IR is always kept up to date while editing. Switching modes should never parse;
            // it only serializes the current canonical IR.
            const nextIrHash = currentIrHash || null;
            const canReuseXmd = Boolean(nextIrHash && cachedXmdIrHash && cachedXmdIrHash === nextIrHash);
            const nextContent = canReuseXmd ? content : irToXmd(currentIr);

            setEditMode('markdown');
            didInitModeRef.current = true;

            const nextMeta: EditorDocMetadata = {
              ...meta,
              ...(nextIrHash ? { xmdIrHash: nextIrHash } : null),
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
    [actualDocumentId, content, documentLatex, documentMetadata, editMode, getCurrentIr, latexDraft, setDocumentLatex, setDocumentMetadata, updateContent]
  );

  return { editMode, setEditMode, latexDraft, setLatexDraft, handleEditModeChange, latexEntryLoading, latexEntryError, reloadLatexEntry };
}


