import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DocumentNode } from '@zadoox/shared';
import { parseLatexToIr, parseXmdToIr } from '@zadoox/shared';
import { computeDocIrHash } from './ir-hash';

export function useCanonicalIrState(params: {
  docKey: string | null;
  editMode: 'markdown' | 'latex';
  content: string;
  latexDraft: string;
  mdIr: DocumentNode | null;
  documentMetadata: Record<string, any> | undefined;
  setDocumentMetadata: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  latexEditNonce: number;
}) {
  const { docKey, editMode, content, latexDraft, mdIr, documentMetadata, setDocumentMetadata, latexEditNonce } = params;

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
    // Rule: IR changes only on user edits. Mode switches do not parse.
    // We treat `latexEditNonce` as the single source of truth for “user edited LaTeX”.
    const meta = (documentMetadata || {}) as any;
    const lastEdited = meta.lastEditedFormat;
    const shouldInitFromLatexOnLoad = lastEdited === 'latex' && didInitFromLatexDocKeyRef.current !== docKey;
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
      try {
        const nextIr = parseLatexToIr({ docId: docKey, latex: latexDraft });
        setCanonicalIr(nextIr);
        didInitFromLatexDocKeyRef.current = docKey;
        lastParsedLatexNonceRef.current = latexEditNonce;

        // Phase 17: LaTeX is stored separately (storage-backed) and we no longer persist latexIrHash in metadata.
      } catch {
        // keep last good IR
      }
    }, 250);

    return () => {
      if (latexIrParseTimeoutRef.current) {
        clearTimeout(latexIrParseTimeoutRef.current);
        latexIrParseTimeoutRef.current = null;
      }
    };
  }, [content, docKey, documentMetadata, editMode, latexDraft, latexEditNonce, mdIr, setDocumentMetadata]);

  return { canonicalIr, getCurrentIr };
}


