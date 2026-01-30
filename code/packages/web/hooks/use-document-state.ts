'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';
import type { ParagraphMode, SemanticGraph } from '@zadoox/shared';

const AUTO_SAVE_DELAY = 2000; // single debounce for all persistence (content + metadata + SG)

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (v: any): any => {
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return null;
    seen.add(v);
    if (Array.isArray(v)) return v.map(normalize);
    const keys = Object.keys(v).sort();
    const out: Record<string, any> = {};
    for (const k of keys) out[k] = normalize(v[k]);
    return out;
  };
  return JSON.stringify(normalize(value));
}

function stableHashString(value: string): string {
  // Cheap stable hash for change detection (avoid pulling in crypto deps on web).
  // Not cryptographically secure; used only for avoiding redundant saves.
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return String(h >>> 0);
}

function normalizeSemanticGraphForCompare(sg: SemanticGraph | null): any {
  if (!sg) return null;
  const s: any = sg as any;
  // `updatedAt` is inherently volatile; do not let it cause saves on its own.
  const { updatedAt: _updatedAt, ...rest } = s;
  // Ensure stable ordering (backend/LLM might return different ordering without semantic changes).
  const nodes = Array.isArray(rest.nodes) ? [...rest.nodes].sort((a, b) => String(a.id).localeCompare(String(b.id))) : [];
  const edges = Array.isArray(rest.edges)
    ? [...rest.edges].sort((a, b) => `${a.from}->${a.to}`.localeCompare(`${b.from}->${b.to}`))
    : [];
  return { ...rest, nodes, edges };
}

function deriveTitleFromXmd(xmd: string): string | null {
  const lines = xmd.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // XMD Title marker: "@ Title"
    const t = /^@\s+(.+)$/.exec(trimmed);
    if (t) {
      const title = (t[1] || '').trim();
      if (!title) return null;
      return title.length > 160 ? `${title.slice(0, 157)}...` : title;
    }
    // Only H1: "# Title" (not "##")
    const m = /^#(?!#)\s+(.+)$/.exec(trimmed);
    if (!m) continue;
    const title = (m[1] || '').trim();
    if (!title) return null;
    // Keep titles reasonably short for UI.
    return title.length > 160 ? `${title.slice(0, 157)}...` : title;
  }
  return null;
}

export function useDocumentState(documentId: string, projectId: string) {
  const [content, setContent] = useState('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actualDocumentId, setActualDocumentId] = useState<string>(documentId);
  const [paragraphModes, setParagraphModes] = useState<Record<string, ParagraphMode>>({});
  const [documentMetadata, setDocumentMetadata] = useState<Record<string, any>>({});
  const [semanticGraph, setSemanticGraph] = useState<SemanticGraph | null>(null);
  const [documentLatex, setDocumentLatex] = useState<any | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest state in refs so the single debounced save always persists the newest snapshot.
  const contentRef = useRef<string>('');
  const metaRef = useRef<Record<string, any>>({});
  const sgRef = useRef<SemanticGraph | null>(null);
  const modesRef = useRef<Record<string, ParagraphMode>>({});
  const latexRef = useRef<any | null>(null);
  const latexEntryDraftRef = useRef<string>(''); // entry .tex text (storage-backed)
  const lastPersistedLatexEntrySigRef = useRef<string>(''); // hash of last saved entry text
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    metaRef.current = documentMetadata || {};
  }, [documentMetadata]);
  useEffect(() => {
    sgRef.current = semanticGraph ?? null;
  }, [semanticGraph]);
  useEffect(() => {
    latexRef.current = documentLatex ?? null;
  }, [documentLatex]);
  useEffect(() => {
    modesRef.current = paragraphModes || {};
  }, [paragraphModes]);

  const lastPersistedSigRef = useRef<string>(''); // single signature for “what the server has”
  const pendingChangeTypeRef = useRef<'auto-save' | 'ai-action'>('auto-save');

  // Load document content (or create "Untitled Document" if project has no documents)
  useEffect(() => {
    async function loadDocument() {
      try {
        setIsLoading(true);
        
        // Try to get existing document by ID
          const document = await api.documents.get(documentId);
          setActualDocumentId(document.id);
          const loadedContent = document.content || '';
          setContent(loadedContent);
          setDocumentTitle(deriveTitleFromXmd(loadedContent) ?? document.title);
          setLastSaved(new Date(document.updatedAt));
          setParagraphModes(document.metadata?.paragraphModes || {});
          setDocumentMetadata(document.metadata || {});
          setSemanticGraph((document as any).semanticGraph ?? null);
          // Back-compat: older docs stored LaTeX source under metadata.latex (string).
          // Newer docs store a storage-backed manifest under documents.latex.
          const loadedLatex = (document as any).latex ?? (document.metadata as any)?.latex ?? null;
          setDocumentLatex(loadedLatex);
          // Initialize “persisted signature” so we don’t attempt to save without a real user change.
          lastPersistedSigRef.current = stableStringify({
            content: loadedContent,
            metadata: document.metadata || {},
            semanticGraph: normalizeSemanticGraphForCompare((document as any).semanticGraph ?? null),
            latex: loadedLatex,
          });
          setIsLoading(false);
      } catch (error) {
        console.error('Failed to load document:', error);
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [documentId, projectId]);

  const performSave = useCallback(
    async (changeType: 'auto-save' | 'ai-action') => {
      if (!actualDocumentId) return;

      const nextContent = contentRef.current;
      const nextMeta = metaRef.current || {};
      const nextModes = modesRef.current || {};
      const nextSg = sgRef.current ?? null;
      const nextLatex = latexRef.current ?? null;
      const latexEntrySig =
        (nextMeta as any)?.lastEditedFormat === 'latex' ? stableHashString(latexEntryDraftRef.current || '') : '';

      const sig = stableStringify({
        content: nextContent,
        metadata: { ...nextMeta, paragraphModes: nextModes },
        semanticGraph: normalizeSemanticGraphForCompare(nextSg),
        latex: nextLatex,
        latexEntrySig,
      });

      if (changeType === 'auto-save' && sig === lastPersistedSigRef.current) return;

      setIsSaving(true);
      try {
        // If LaTeX entry text changed, persist it first (uploads to storage and returns an updated manifest).
        let latexManifestToSave = nextLatex;
        if (
          (nextMeta as any)?.lastEditedFormat === 'latex' &&
          latexEntrySig &&
          latexEntrySig !== lastPersistedLatexEntrySigRef.current
        ) {
          const put = await api.documents.latexEntryPut(actualDocumentId, { text: latexEntryDraftRef.current || '' });
          latexManifestToSave = put.latex ?? latexManifestToSave;
          setDocumentLatex(latexManifestToSave);
          latexRef.current = latexManifestToSave;
          lastPersistedLatexEntrySigRef.current = latexEntrySig;
        }

        const derivedTitle = deriveTitleFromXmd(nextContent);
        const document = await api.documents.update(actualDocumentId, {
          ...(derivedTitle ? { title: derivedTitle } : null),
          content: nextContent,
          metadata: { ...nextMeta, paragraphModes: nextModes },
          latex: latexManifestToSave,
          semanticGraph: nextSg,
          changeType,
        });
        setDocumentTitle(document.title);
        setLastSaved(new Date(document.updatedAt));
        setParagraphModes(document.metadata?.paragraphModes || {});
        setDocumentMetadata(document.metadata || {});
        setSemanticGraph((document as any).semanticGraph ?? nextSg);
        setDocumentLatex((document as any).latex ?? latexManifestToSave);
        lastPersistedSigRef.current = stableStringify({
          content: document.content || nextContent,
          metadata: document.metadata || { ...nextMeta, paragraphModes: nextModes },
          semanticGraph: normalizeSemanticGraphForCompare((document as any).semanticGraph ?? nextSg),
          latex: (document as any).latex ?? latexManifestToSave,
          latexEntrySig,
        });
      } catch (error) {
        console.error('Failed to save document:', error);
      } finally {
        setIsSaving(false);
      }
    },
    [actualDocumentId]
  );

  const scheduleSave = useCallback(
    (changeType: 'auto-save' | 'ai-action') => {
      pendingChangeTypeRef.current = changeType === 'ai-action' ? 'ai-action' : pendingChangeTypeRef.current;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        const ct = pendingChangeTypeRef.current;
        pendingChangeTypeRef.current = 'auto-save';
        void performSave(ct);
      }, AUTO_SAVE_DELAY);
    },
    [performSave]
  );

  // Update content with auto-save
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      const derivedTitle = deriveTitleFromXmd(newContent);
      if (derivedTitle) {
        setDocumentTitle(derivedTitle);
      }
      scheduleSave('auto-save');
    },
    [scheduleSave]
  );

  // Set content without triggering auto-save (for viewing older versions)
  const setContentWithoutSave = useCallback((newContent: string) => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setContent(newContent);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const saveMetadataPatch = useCallback(
    (patch: Record<string, any>, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      // Don't save if we don't have an actual document ID yet
      if (!actualDocumentId) return;

      // Optimistically update local metadata immediately, then schedule a unified save.
      setDocumentMetadata((prev) => ({ ...(prev || {}), ...(patch || {}) }));
      scheduleSave(changeType);
    },
    [actualDocumentId, scheduleSave]
  );

  const saveSemanticGraphPatch = useCallback(
    (next: SemanticGraph, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (!actualDocumentId) return;

      // Optimistically update local SG immediately.
      setSemanticGraph(next);
      scheduleSave(changeType);
    },
    [actualDocumentId, scheduleSave]
  );

  const saveLatexEntryPatch = useCallback(
    (text: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (!actualDocumentId) return;
      latexEntryDraftRef.current = String(text ?? '');
      scheduleSave(changeType);
    },
    [actualDocumentId, scheduleSave]
  );

  // Handle mode toggle
  const handleModeToggle = useCallback(
    async (paragraphId: string, newMode: ParagraphMode) => {
      if (!actualDocumentId) {
        return;
      }

      // Update local state immediately for responsive UI
      setParagraphModes(prev => ({
        ...prev,
        [paragraphId]: newMode,
      }));

      // Get current document to preserve existing metadata
      try {
        const currentDocument = await api.documents.get(actualDocumentId);
        const updatedModes = {
          ...(currentDocument.metadata?.paragraphModes || {}),
          [paragraphId]: newMode,
        };

        // Update document metadata
        await api.documents.update(actualDocumentId, {
          metadata: {
            ...currentDocument.metadata,
            paragraphModes: updatedModes,
          },
        });
      } catch (error) {
        console.error('Failed to update paragraph mode:', error);
        // Revert local state on error
        setParagraphModes(prev => {
          const next = { ...prev };
          delete next[paragraphId];
          return next;
        });
      }
    },
    [actualDocumentId]
  );

  const refreshSemanticGraph = useCallback(async () => {
    if (!actualDocumentId) return;
    try {
      const document = await api.documents.get(actualDocumentId);
      setSemanticGraph((document as any).semanticGraph ?? null);
      setLastSaved(new Date(document.updatedAt));
    } catch (error) {
      console.error('Failed to refresh semantic graph:', error);
    }
  }, [actualDocumentId]);

  return {
    content,
    documentTitle,
    updateContent,
    setContentWithoutSave,
    isSaving,
    lastSaved,
    isLoading,
    documentId: actualDocumentId,
    paragraphModes,
    documentMetadata,
    setDocumentMetadata,
    documentLatex,
    setDocumentLatex,
    saveLatexEntryPatch,
    saveMetadataPatch,
    semanticGraph,
    saveSemanticGraphPatch,
    refreshSemanticGraph,
    handleModeToggle,
    saveDocument: async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      setContent(contentToSave);
      if (changeType === 'ai-action') {
        // Immediate save for AI-driven changes.
        await performSave('ai-action');
        return;
      }
      scheduleSave(changeType);
    },
  };
}

