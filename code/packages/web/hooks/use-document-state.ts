'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api/client';
import { ApiError } from '@/lib/api/client';
import type { ParagraphMode, SemanticGraph } from '@zadoox/shared';

const AUTO_SAVE_DELAY = 2000; // 2 seconds after last edit
const AUTO_SAVE_METADATA_DELAY = 2000; // metadata-only debounce
const AUTO_SAVE_SG_DELAY = 2000; // SG-only debounce

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
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveMetadataTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveSgTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          setIsLoading(false);
      } catch (error) {
        console.error('Failed to load document:', error);
        setIsLoading(false);
      }
    }

    loadDocument();
  }, [documentId, projectId]);

  // Auto-save function
  const saveDocument = useCallback(
    async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Don't save if we don't have an actual document ID yet
      if (!actualDocumentId) {
        return;
      }

      setIsSaving(true);
      try {
        const derivedTitle = deriveTitleFromXmd(contentToSave);
        // Get current document to preserve metadata (especially paragraphModes)
        const currentDocument = await api.documents.get(actualDocumentId);
        // Merge server metadata with local metadata, but DO NOT allow a stale autosave to wipe
        // `metadata.latex` / `metadata.latexIrHash` / `metadata.lastEditedFormat` that were just
        // set by a mode switch. This was the root cause of "I switched and saw correct LaTeX,
        // but publish compiled older LaTeX".
        const serverMeta = (currentDocument.metadata || {}) as Record<string, any>;
        const localMeta = (documentMetadata || {}) as Record<string, any>;
        const mergedMetadata: Record<string, any> = {
          ...serverMeta,
          ...localMeta,
          paragraphModes: paragraphModes, // Preserve current paragraph modes
        };

        const serverLatex = typeof serverMeta.latex === 'string' ? serverMeta.latex : null;
        const localLatex = typeof localMeta.latex === 'string' ? localMeta.latex : null;
        const localHasLatex = typeof localLatex === 'string' && localLatex.trim().length > 0;
        const serverHasLatex = typeof serverLatex === 'string' && serverLatex.trim().length > 0;

        // If local metadata doesn't have LaTeX, preserve the server's LaTeX fields.
        if (!localHasLatex && serverHasLatex) {
          mergedMetadata.latex = serverMeta.latex;
          mergedMetadata.latexIrHash = serverMeta.latexIrHash;
          mergedMetadata.lastEditedFormat = serverMeta.lastEditedFormat;
        }
        
        // Update document with content change, preserving existing metadata
        const document = await api.documents.update(actualDocumentId, {
          ...(derivedTitle ? { title: derivedTitle } : null),
          content: contentToSave,
          metadata: mergedMetadata,
          changeType,
        });
        setDocumentTitle(document.title);
        setLastSaved(new Date(document.updatedAt));
        setParagraphModes(document.metadata?.paragraphModes || {});
        setDocumentMetadata(document.metadata || {});
      } catch (error) {
        console.error('Failed to save document:', error);
        // Don't update lastSaved on error - user will see "Not saved" status
      } finally {
        setIsSaving(false);
      }
    },
    [actualDocumentId, paragraphModes, documentMetadata]
  );

  // Update content with auto-save
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      const derivedTitle = deriveTitleFromXmd(newContent);
      if (derivedTitle) {
        setDocumentTitle(derivedTitle);
      }

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveDocument(newContent, 'auto-save');
      }, AUTO_SAVE_DELAY);
    },
    [saveDocument]
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
      if (saveMetadataTimeoutRef.current) {
        clearTimeout(saveMetadataTimeoutRef.current);
      }
      if (saveSgTimeoutRef.current) {
        clearTimeout(saveSgTimeoutRef.current);
      }
    };
  }, []);

  const saveMetadataPatch = useCallback(
    (patch: Record<string, any>, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      // Keep the latest patch/localMeta available to the debounced callback without relying
      // on React state having updated synchronously.
      const localMetaSnapshot = (documentMetadata || {}) as Record<string, any>;
      const patchSnapshot = (patch || {}) as Record<string, any>;

      if (saveMetadataTimeoutRef.current) {
        clearTimeout(saveMetadataTimeoutRef.current);
      }

      // Don't save if we don't have an actual document ID yet
      if (!actualDocumentId) return;

      // Optimistically update local metadata immediately
      setDocumentMetadata((prev) => ({ ...(prev || {}), ...patchSnapshot }));

      saveMetadataTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const currentDocument = await api.documents.get(actualDocumentId);
          const serverMeta = (currentDocument.metadata || {}) as Record<string, any>;
          const localMeta = localMetaSnapshot;

          const mergedMetadata: Record<string, any> = {
            ...serverMeta,
            ...localMeta,
            ...patchSnapshot,
            paragraphModes: paragraphModes,
          };

          // Preserve server LaTeX fields if local is missing them (same rule as content autosave)
          const serverLatex = typeof serverMeta.latex === 'string' ? serverMeta.latex : null;
          const localLatex = typeof localMeta.latex === 'string' ? localMeta.latex : null;
          const localHasLatex = typeof localLatex === 'string' && localLatex.trim().length > 0;
          const serverHasLatex = typeof serverLatex === 'string' && serverLatex.trim().length > 0;
          if (!localHasLatex && serverHasLatex) {
            mergedMetadata.latex = serverMeta.latex;
            mergedMetadata.latexIrHash = serverMeta.latexIrHash;
            mergedMetadata.lastEditedFormat = serverMeta.lastEditedFormat;
          }

          const document = await api.documents.update(actualDocumentId, {
            metadata: mergedMetadata,
            changeType,
          });
          setLastSaved(new Date(document.updatedAt));
          setParagraphModes(document.metadata?.paragraphModes || {});
          setDocumentMetadata(document.metadata || {});
        } catch (error) {
          console.error('Failed to save document metadata:', error);
        } finally {
          setIsSaving(false);
        }
      }, AUTO_SAVE_METADATA_DELAY);
    },
    [actualDocumentId, documentMetadata, paragraphModes]
  );

  const saveSemanticGraphPatch = useCallback(
    (next: SemanticGraph, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      if (saveSgTimeoutRef.current) {
        clearTimeout(saveSgTimeoutRef.current);
      }

      if (!actualDocumentId) return;

      // Optimistically update local SG immediately.
      setSemanticGraph(next);

      saveSgTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          const document = await api.documents.update(actualDocumentId, {
            semanticGraph: next,
            changeType,
          });
          setLastSaved(new Date(document.updatedAt));
          setSemanticGraph((document as any).semanticGraph ?? next);
        } catch (error) {
          console.error('Failed to save semantic graph:', error);
        } finally {
          setIsSaving(false);
        }
      }, AUTO_SAVE_SG_DELAY);
    },
    [actualDocumentId]
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
    saveMetadataPatch,
    semanticGraph,
    saveSemanticGraphPatch,
    handleModeToggle,
    saveDocument: async (contentToSave: string, changeType: 'auto-save' | 'ai-action' = 'auto-save') => {
      await saveDocument(contentToSave, changeType);
    },
  };
}

