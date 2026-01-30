import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentNode } from '@zadoox/shared';
import { parseLatexToIr, parseXmdToIr } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';
import { api } from '@/lib/api/client';

export function useCanonicalIrState(params: {
  docKey: string | null;
  editMode: 'markdown' | 'latex';
  content: string;
  latexDraft: string;
  mdIr: DocumentNode | null;
  documentMetadata: Record<string, any> | undefined;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  latexEditNonce: number;
  documentLatex: unknown | null | undefined;
}) {
  const { docKey, editMode, content, latexDraft, mdIr, documentMetadata, setDocumentMetadata, latexEditNonce, documentLatex } = params;

  const [canonicalIr, setCanonicalIr] = useState<DocumentNode | null>(null);
  const canonicalIrRef = useRef<DocumentNode | null>(null);
  const latexIrParseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastParsedLatexNonceRef = useRef<number>(-1);
  const didInitFromLatexDocKeyRef = useRef<string | null>(null);

  useEffect(() => {
    canonicalIrRef.current = canonicalIr;
  }, [canonicalIr]);

  const getCurrentIr = useCallback(() => canonicalIrRef.current, []);

  // Persist xmdIrHash only when the user is editing XMD/Markdown (meaning: XMD is the source of truth).
  const xmdIrHash = useMemo(() => computeDocIrHash(mdIr), [mdIr]);
  useEffect(() => {
    if (!docKey) return;
    if (editMode !== 'markdown') return;
    if (!xmdIrHash) return;
    setDocumentMetadata((prev) => {
      const p = (prev || {}) as any;
      if (p.xmdIrHash === xmdIrHash) return prev;
      return { ...p, xmdIrHash };
    });
  }, [docKey, editMode, setDocumentMetadata, xmdIrHash]);

  // Canonical IR:
  // - Updated continuously from the active editing surface (MD or LaTeX)
  // - Preview/outline always render from this canonical IR
  useEffect(() => {
    if (!docKey) return;

    if (editMode === 'markdown') {
      if (latexIrParseTimeoutRef.current) {
        clearTimeout(latexIrParseTimeoutRef.current);
        latexIrParseTimeoutRef.current = null;
      }

      if (mdIr) {
        setCanonicalIr(mdIr);
        return;
      }

      // Fall back to a synchronous parse if the debounced hook hasn't produced IR yet.
      try {
        const next = parseXmdToIr({ docId: docKey, xmd: content });
        setCanonicalIr(next);
      } catch {
        // keep last good IR
      }
      return;
    }

    // editMode === 'latex'
    // Rule:
    // - On initial load for LaTeX-first docs, we MUST build canonical IR once so preview/outline work.
    // - After that, we only re-parse on user edits (latexEditNonce).
    const meta = (documentMetadata || {}) as any;
    // We no longer rely on metadata.lastEditedFormat here (it's not guaranteed/persisted).
    // If the document has a LaTeX manifest, treat it as LaTeX-first and bootstrap IR once.
    const shouldInitFromLatexOnLoad = Boolean(documentLatex) && didInitFromLatexDocKeyRef.current !== docKey;
    const shouldParseFromLatexEdit = latexEditNonce !== lastParsedLatexNonceRef.current;

    if (!shouldInitFromLatexOnLoad && !shouldParseFromLatexEdit) {
      if (latexIrParseTimeoutRef.current) {
        clearTimeout(latexIrParseTimeoutRef.current);
        latexIrParseTimeoutRef.current = null;
      }
      return;
    }

    if (latexIrParseTimeoutRef.current) {
      clearTimeout(latexIrParseTimeoutRef.current);
    }

    latexIrParseTimeoutRef.current = setTimeout(() => {
      (async () => {
        // On initial load for LaTeX docs, prefer backend-expanded IR so multi-file imports (\input/\include)
        // produce a complete outline. On user edits, fall back to local parse (fast).
        // IMPORTANT: For LaTeX-first docs with a manifest, we MUST prefer the backend-expanded IR.
        // Local parsing cannot expand includes, which breaks tables/figures in real arXiv sources.
        if ((shouldInitFromLatexOnLoad || shouldParseFromLatexEdit) && documentLatex) {
          try {
            const built = await api.documents.latexIrGet(docKey, { cacheBust: String(Date.now()) });
            const nextIr = (built as any)?.ir as DocumentNode | null;
            if (nextIr) {
              setCanonicalIr(nextIr);
              didInitFromLatexDocKeyRef.current = docKey;
              // Mark the edit nonce as handled so we don't immediately re-run.
              if (shouldParseFromLatexEdit) lastParsedLatexNonceRef.current = latexEditNonce;
              return;
            }
          } catch {
            // If backend expansion fails, keep last good IR.
            // (Local parse is not reliable for LaTeX bundle docs.)
            return;
          }
        }

        try {
          const nextIr = parseLatexToIr({ docId: docKey, latex: latexDraft });
          setCanonicalIr(nextIr);
          didInitFromLatexDocKeyRef.current = docKey;
          lastParsedLatexNonceRef.current = latexEditNonce;
        } catch {
          // keep last good IR
        }
      })().catch(() => {
        // ignore
      });
    }, 250);

    return () => {
      if (latexIrParseTimeoutRef.current) {
        clearTimeout(latexIrParseTimeoutRef.current);
        latexIrParseTimeoutRef.current = null;
      }
    };
  }, [content, docKey, documentMetadata, documentLatex, editMode, latexDraft, latexEditNonce, mdIr, setDocumentMetadata]);

  return { canonicalIr, getCurrentIr };
}


